/**
 * Sidecar Manager
 * 
 * Manages the Python FastAPI sidecar process lifecycle from Electron.
 * Handles starting, stopping, health checking, and monitoring the sidecar.
 */

import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import axios from 'axios';

export interface SidecarConfig {
  port: number;
  host: string;
  pythonPath?: string;
  servicePath?: string;
  startupTimeout?: number;
  healthCheckInterval?: number;
}

const DEFAULT_CONFIG: Required<Omit<SidecarConfig, 'pythonPath' | 'servicePath'>> = {
  port: 8000,
  host: '127.0.0.1',
  startupTimeout: 30000, // 30 seconds
  healthCheckInterval: 5000, // 5 seconds
};

export enum SidecarStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  ERROR = 'error',
  STOPPING = 'stopping',
}

export class SidecarManager {
  private process: ChildProcess | null = null;
  private status: SidecarStatus = SidecarStatus.STOPPED;
  private config: Required<SidecarConfig>;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startupCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SidecarConfig> = {}) {
    // Resolve paths relative to app root
    const appPath = app.isPackaged
      ? path.dirname(app.getPath('exe'))
      : app.getAppPath();

    const servicePath = config.servicePath || path.join(
      appPath,
      '..',
      'context-kit-service'
    );

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      pythonPath: config.pythonPath || 'python',
      servicePath,
    };
  }

  /**
   * Start the sidecar process
   */
  async start(): Promise<void> {
    if (this.status === SidecarStatus.RUNNING) {
      console.log('[SidecarManager] Already running');
      return;
    }

    if (this.status === SidecarStatus.STARTING) {
      console.log('[SidecarManager] Already starting');
      return;
    }

    console.log('[SidecarManager] Starting sidecar...');
    this.status = SidecarStatus.STARTING;

    try {
      // Check if port is available
      const isPortFree = await this.checkPortFree();
      if (!isPortFree) {
        // Port is in use - try to connect to existing service
        const isHealthy = await this.checkHealth();
        if (isHealthy) {
          console.log('[SidecarManager] Found existing sidecar on port', this.config.port);
          this.status = SidecarStatus.RUNNING;
          this.startHealthChecking();
          return;
        }
        throw new Error(`Port ${this.config.port} is in use but sidecar is not responding`);
      }

      // Start the sidecar process
      await this.spawnProcess();

      // Wait for sidecar to be ready
      await this.waitForReady();

      console.log('[SidecarManager] Sidecar started successfully');
      this.status = SidecarStatus.RUNNING;
      this.startHealthChecking();
    } catch (error) {
      console.error('[SidecarManager] Failed to start:', error);
      this.status = SidecarStatus.ERROR;
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the sidecar process
   */
  async stop(): Promise<void> {
    if (this.status === SidecarStatus.STOPPED) {
      return;
    }

    console.log('[SidecarManager] Stopping sidecar...');
    this.status = SidecarStatus.STOPPING;

    this.stopHealthChecking();

    try {
      // Try graceful shutdown via API
      await this.sendShutdownSignal();
    } catch (error) {
      console.warn('[SidecarManager] Graceful shutdown failed:', error);
    }

    await this.cleanup();
    this.status = SidecarStatus.STOPPED;
    console.log('[SidecarManager] Sidecar stopped');
  }

  /**
   * Get current status
   */
  getStatus(): SidecarStatus {
    return this.status;
  }

  /**
   * Get base URL for the sidecar
   */
  getBaseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Check if sidecar is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.getBaseUrl()}/health`, {
        timeout: 2000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Spawn the sidecar process
   */
  private async spawnProcess(): Promise<void> {
    const args = [
      '-m',
      'uvicorn',
      'context_kit_service.main:app',
      '--host',
      this.config.host,
      '--port',
      this.config.port.toString(),
    ];

    console.log('[SidecarManager] Spawning:', this.config.pythonPath, args.join(' '));

    this.process = spawn(this.config.pythonPath, args, {
      cwd: this.config.servicePath,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: false,
    });

    // Handle process events
    this.process.on('error', (error) => {
      console.error('[SidecarManager] Process error:', error);
      this.status = SidecarStatus.ERROR;
    });

    this.process.on('exit', (code, signal) => {
      console.log(`[SidecarManager] Process exited with code ${code}, signal ${signal}`);
      if (this.status === SidecarStatus.RUNNING) {
        this.status = SidecarStatus.ERROR;
      }
      this.process = null;
    });

    // Log output
    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        console.log('[Sidecar]', data.toString().trim());
      });
    }

    if (this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        console.error('[Sidecar Error]', data.toString().trim());
      });
    }
  }

  /**
   * Wait for sidecar to be ready
   */
  private async waitForReady(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.startupTimeout;

    while (Date.now() - startTime < timeout) {
      if (await this.checkHealth()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error('Sidecar failed to start within timeout');
  }

  /**
   * Check if port is free
   */
  private async checkPortFree(): Promise<boolean> {
    try {
      await axios.get(`http://${this.config.host}:${this.config.port}`, {
        timeout: 1000,
      });
      return false; // Port is in use
    } catch {
      return true; // Port is free
    }
  }

  /**
   * Send shutdown signal to sidecar
   */
  private async sendShutdownSignal(): Promise<void> {
    try {
      await axios.post(`${this.getBaseUrl()}/shutdown`, {}, {
        timeout: 5000,
      });
      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
      // Ignore errors - we'll force kill if needed
    }
  }

  /**
   * Cleanup process and resources
   */
  private async cleanup(): Promise<void> {
    if (this.startupCheckTimer) {
      clearTimeout(this.startupCheckTimer);
      this.startupCheckTimer = null;
    }

    if (this.process) {
      if (!this.process.killed) {
        this.process.kill('SIGTERM');
        
        // Force kill after 5 seconds
        await new Promise<void>((resolve) => {
          const forceKillTimer = setTimeout(() => {
            if (this.process && !this.process.killed) {
              console.warn('[SidecarManager] Force killing process');
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          if (this.process) {
            this.process.once('exit', () => {
              clearTimeout(forceKillTimer);
              resolve();
            });
          } else {
            clearTimeout(forceKillTimer);
            resolve();
          }
        });
      }
      this.process = null;
    }
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking(): void {
    this.stopHealthChecking();

    this.healthCheckTimer = setInterval(() => {
      void (async () => {
        if (this.status === SidecarStatus.RUNNING) {
          const healthy = await this.checkHealth();
          if (!healthy) {
            console.warn('[SidecarManager] Health check failed');
            this.status = SidecarStatus.ERROR;
            this.stopHealthChecking();
          }
        }
      })();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checking
   */
  private stopHealthChecking(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// Singleton instance
let sidecarManager: SidecarManager | null = null;

/**
 * Get or create the singleton SidecarManager instance
 */
export function getSidecarManager(config?: Partial<SidecarConfig>): SidecarManager {
  if (!sidecarManager) {
    sidecarManager = new SidecarManager(config);
  }
  return sidecarManager;
}

/**
 * Reset the singleton (for testing)
 */
export function resetSidecarManager(): void {
  if (sidecarManager) {
    sidecarManager.stop().catch(console.error);
    sidecarManager = null;
  }
}
