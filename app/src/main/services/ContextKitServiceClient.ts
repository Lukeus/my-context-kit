/**
 * Context Kit Service Client
 * 
 * Manages the Python FastAPI service lifecycle including:
 * - Starting/stopping the service
 * - Health monitoring
 * - uv virtual environment management
 * - Graceful cleanup on app quit
 */

import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import { AICredentialResolver } from './AICredentialResolver';

export interface ServiceStatus {
  running: boolean;
  healthy: boolean;
  port: number;
  uptime?: number;
  lastError?: string;
}

export interface ServiceConfig {
  port: number;
  host: string;
  pythonServicePath: string;
  uvEnvPath?: string;
  autoStart: boolean;
  healthCheckInterval: number;
}

export class ContextKitServiceClient {
  private process: ChildProcess | null = null;
  private config: ServiceConfig;
  private status: ServiceStatus;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  constructor(config?: Partial<ServiceConfig>) {
    // Default configuration
    // app.getAppPath() returns the 'app' directory in dev, or packaged app directory in prod
    // In development: app.getAppPath() = .../my-context-kit/app
    // In production: app.getAppPath() = .../resources/app
    const isDev = !app.isPackaged;
    const appPath = app.getAppPath();
    
    // In dev, go up one level from 'app' to workspace root
    // In prod, go up two levels from 'resources/app' to app root
    const workspaceRoot = isDev 
      ? join(appPath, '..')  // my-context-kit/app -> my-context-kit
      : join(appPath, '..', '..');  // resources/app -> app root
    
    console.log('[ContextKitServiceClient] App path:', appPath);
    console.log('[ContextKitServiceClient] Workspace root:', workspaceRoot);
    
    this.config = {
      port: 8000,
      host: '127.0.0.1',
      pythonServicePath: join(workspaceRoot, 'context-kit-service'),
      uvEnvPath: join(workspaceRoot, 'context-kit-service', '.venv'),
      autoStart: true,
      healthCheckInterval: 30000, // 30 seconds
      ...config,
    };

    this.status = {
      running: false,
      healthy: false,
      port: this.config.port,
    };

    // Register cleanup handlers
    app.on('before-quit', () => { void this.stop(); });
    process.on('exit', () => { void this.stop(); });
  }

  /**
   * Start the Python service
   */
  async start(): Promise<void> {
    if (this.process) {
      console.log('⚠️ Context Kit Service already running');
      return;
    }

    console.log('🚀 Starting Context Kit Service...');
    console.log(`   Path: ${this.config.pythonServicePath}`);
    console.log(`   Port: ${this.config.port}`);

    try {
      // Check if service directory exists
      if (!existsSync(this.config.pythonServicePath)) {
        throw new Error(`Service path not found: ${this.config.pythonServicePath}`);
      }

      // Check if uv is available
      await this.ensureUvInstalled();

      // Setup virtual environment if needed
      await this.ensureVirtualEnvironment();

      // Resolve Azure OpenAI credentials from Electron's secure storage
      const credentialResolver = new AICredentialResolver();
      const azureApiKey = await credentialResolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true,
      });

      // Get endpoint from environment (user configures this in AI Settings)
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.MODEL_NAME;

      // Start the service using pnpm (which uses uv)
      this.process = spawn(
        'pnpm',
        ['start'],
        {
          cwd: this.config.pythonServicePath,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          env: {
            ...process.env,
            PORT: String(this.config.port),
            HOST: this.config.host,
            // Pass Azure OpenAI credentials from Electron's secure storage to Python service
            ...(azureApiKey && { AZURE_OPENAI_API_KEY: azureApiKey }),
            ...(azureEndpoint && { AZURE_OPENAI_ENDPOINT: azureEndpoint }),
            ...(azureDeployment && { AZURE_OPENAI_DEPLOYMENT: azureDeployment }),
          },
        }
      );

      this.startTime = Date.now();
      this.status.running = true;

      // Handle process output
      this.process.stdout?.on('data', (data: Buffer) => {
        console.log(`[Context Kit Service] ${data.toString().trim()}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        // Ignore INFO level uvicorn logs in stderr
        if (!message.includes('INFO:') && !message.includes('Started server')) {
          console.error(`[Context Kit Service Error] ${message}`);
        }
      });

      this.process.on('error', (error: Error) => {
        console.error('❌ Context Kit Service process error:', error);
        this.status.lastError = error.message;
        this.status.running = false;
        this.status.healthy = false;
      });

      this.process.on('exit', (code: number | null) => {
        console.log(`Context Kit Service exited with code ${code}`);
        this.status.running = false;
        this.status.healthy = false;
        this.process = null;
      });

      // Wait for service to become healthy
      await this.waitForHealthy();

      // Start health monitoring
      this.startHealthMonitoring();

      console.log('✅ Context Kit Service started successfully');
    } catch (error) {
      console.error('❌ Failed to start Context Kit Service:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Stop the Python service and clean up resources
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    console.log('👋 Stopping Context Kit Service...');

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Kill the process
    this.process.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.process = null;
    this.status.running = false;
    this.status.healthy = false;

    // Note: We intentionally don't clean up the virtual environment
    // to preserve installed dependencies between runs

    console.log('✓ Context Kit Service stopped');
  }

  /**
   * Get current service status
   */
  getStatus(): ServiceStatus {
    return {
      ...this.status,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : undefined,
    };
  }

  /**
   * Check if service is running and healthy
   */
  async checkHealth(): Promise<boolean> {
    if (!this.status.running) {
      return false;
    }

    try {
      const response = await fetch(`http://${this.config.host}:${this.config.port}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        this.status.healthy = data.status === 'healthy' || data.status === 'degraded';
        return this.status.healthy;
      }

      this.status.healthy = false;
      return false;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastError = error instanceof Error ? error.message : 'Health check failed';
      return false;
    }
  }

  /**
   * Make a request to the service
   */
  async request<T = unknown>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    if (!this.status.healthy) {
      throw new Error('Context Kit Service is not healthy');
    }

    const url = `http://${this.config.host}:${this.config.port}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        signal: options?.signal || AbortSignal.timeout(60000), // 60s timeout
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Context Kit Service request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Ensure uv is installed
   */
  private async ensureUvInstalled(): Promise<void> {
    try {
      const { execa } = await import('execa');
      await execa('uv', ['--version']);
      console.log('✓ uv is installed');
    } catch {
      console.log('Installing uv...');
      const { execa } = await import('execa');
      
      // Run bootstrap script to install uv
      await execa(
        'pnpm',
        ['run', 'bootstrap'],
        {
          cwd: this.config.pythonServicePath,
          shell: true,
        }
      );
      
      console.log('✓ uv installed successfully');
    }
  }

  /**
   * Ensure virtual environment is set up
   */
  private async ensureVirtualEnvironment(): Promise<void> {
    const venvPath = this.config.uvEnvPath || join(this.config.pythonServicePath, '.venv');

    // Check if venv exists - if it does, assume it's valid to avoid unnecessary reinstalls
    if (existsSync(venvPath)) {
      console.log('✓ Virtual environment exists');
      return;
    }

    console.log('Setting up virtual environment...');
    const { execa } = await import('execa');

    // Run pnpm setup to create venv and install dependencies
    const setupProcess = execa(
      'pnpm',
      ['run', 'setup:dev'],
      {
        cwd: this.config.pythonServicePath,
        shell: true,
      }
    );

    // Stream output to console
    setupProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[Setup] ${data.toString().trim()}`);
    });
    setupProcess.stderr?.on('data', (data: Buffer) => {
      console.log(`[Setup] ${data.toString().trim()}`);
    });

    await setupProcess;

    console.log('✓ Virtual environment ready');
  }

  /**
   * Clean up virtual environment on shutdown
   */
  private async cleanupVirtualEnvironment(): Promise<void> {
    const venvPath = this.config.uvEnvPath || join(this.config.pythonServicePath, '.venv');

    if (!existsSync(venvPath)) {
      return;
    }

    console.log('Cleaning up virtual environment...');

    try {
      // Optional: Run diagnostics before cleanup
      const { execa } = await import('execa');
      try {
        const { stdout } = await execa(
          'pnpm',
          ['run', 'freeze'],
          {
            cwd: this.config.pythonServicePath,
            shell: true,
            timeout: 5000,
          }
        );
        console.log('Virtual environment packages:', stdout);
      } catch (diagError) {
        // Ignore diagnostics failures
        void diagError;
      }

      // Remove virtual environment directory
      await rm(venvPath, { recursive: true, force: true });
      console.log('✓ Virtual environment cleaned up');
    } catch (error) {
      console.error('Failed to clean up virtual environment:', error);
      // Don't throw - cleanup failures shouldn't prevent app from closing
    }
  }

  /**
   * Wait for service to become healthy
   */
  private async waitForHealthy(maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const healthy = await this.checkHealth();
      if (healthy) {
        return;
      }

      console.log(`Waiting for service to become healthy... (${i + 1}/${maxAttempts})`);
    }

    throw new Error('Service failed to become healthy within timeout');
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      const wasHealthy = this.status.healthy;
      void this.checkHealth().then(() => {
        if (wasHealthy && !this.status.healthy) {
          console.warn('⚠️ Context Kit Service became unhealthy');
        } else if (!wasHealthy && this.status.healthy) {
          console.log('✓ Context Kit Service is healthy again');
        }
      });
    }, this.config.healthCheckInterval);
  }
}
