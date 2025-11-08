/**
 * IPC Handlers for Python Sidecar Operations
 * 
 * Provides IPC handlers that bridge renderer process requests to the
 * Python sidecar via SidecarClient and SidecarManager.
 */

import { ipcMain } from 'electron';
import { getSidecarClient } from '../../../shared/sidecar/SidecarClient';
import { getSidecarManager, SidecarStatus } from '../../services/SidecarManager';
import type {
  GenerateEntityRequest,
  AssistStreamRequest,
  ToolExecutionRequest,
  RAGQueryRequest,
} from '../../../shared/sidecar/schemas';

// =============================================================================
// Sidecar Lifecycle Handlers
// =============================================================================

/**
 * Start the sidecar process
 */
ipcMain.handle('sidecar:start', async () => {
  try {
    const manager = getSidecarManager();
    await manager.start();
    
    // Initialize the client once sidecar is running
    const baseUrl = manager.getBaseUrl();
    getSidecarClient({ baseUrl });
    
    return { success: true, baseUrl };
  } catch (error) {
    console.error('[IPC] Failed to start sidecar:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

/**
 * Stop the sidecar process
 */
ipcMain.handle('sidecar:stop', async () => {
  try {
    const manager = getSidecarManager();
    await manager.stop();
    return { success: true };
  } catch (error) {
    console.error('[IPC] Failed to stop sidecar:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});

/**
 * Get sidecar status
 */
ipcMain.handle('sidecar:status', async () => {
  const manager = getSidecarManager();
  const status = manager.getStatus();
  const baseUrl = status === SidecarStatus.RUNNING ? manager.getBaseUrl() : null;
  
  return { status, baseUrl };
});

/**
 * Check sidecar health
 */
ipcMain.handle('sidecar:health', async () => {
  try {
    const manager = getSidecarManager();
    const healthy = await manager.checkHealth();
    return { healthy };
  } catch {
    return { healthy: false };
  }
});

// =============================================================================
// AI Operation Handlers
// =============================================================================

/**
 * Generate an entity using AI
 */
ipcMain.handle('sidecar:generate-entity', async (_event, request: GenerateEntityRequest) => {
  try {
    const client = getSidecarClient();
    const response = await client.generateEntity(request);
    return { success: true, data: response };
  } catch (error) {
    console.error('[IPC] Entity generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Stream AI assistance
 * 
 * Note: This returns a stream ID that can be used to listen to events
 */
ipcMain.handle('sidecar:assist-stream', async (event, request: AssistStreamRequest) => {
  try {
    const client = getSidecarClient();
    const streamId = `stream-${Date.now()}`;
    
    // Start streaming
    const cleanup = await client.streamAssist(
      request,
      (token: string, metadata?: unknown) => {
        // Send token events to renderer
        event.sender.send('sidecar:stream-token', {
          streamId,
          token,
          metadata,
        });
      },
      (fullContent: string, metadata?: unknown) => {
        // Send completion event
        event.sender.send('sidecar:stream-complete', {
          streamId,
          fullContent,
          metadata,
        });
      },
      (error: Error) => {
        // Send error event
        event.sender.send('sidecar:stream-error', {
          streamId,
          error: error.message,
        });
      }
    );
    
    // Store cleanup function for cancellation
    streamCleanupMap.set(streamId, cleanup);
    
    return { success: true, streamId };
  } catch (error) {
    console.error('[IPC] Stream assistance failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Cancel an active stream
 */
ipcMain.handle('sidecar:cancel-stream', async (_event, streamId: string) => {
  const cleanup = streamCleanupMap.get(streamId);
  if (cleanup) {
    cleanup();
    streamCleanupMap.delete(streamId);
    return { success: true };
  }
  return { success: false, error: 'Stream not found' };
});

/**
 * Execute a tool
 */
ipcMain.handle('sidecar:execute-tool', async (_event, request: ToolExecutionRequest) => {
  try {
    const client = getSidecarClient();
    const response = await client.executeTool(request);
    return { success: true, data: response };
  } catch (error) {
    console.error('[IPC] Tool execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Execute a RAG query
 */
ipcMain.handle('sidecar:rag-query', async (_event, request: RAGQueryRequest) => {
  try {
    const client = getSidecarClient();
    const response = await client.ragQuery(request);
    return { success: true, data: response };
  } catch (error) {
    console.error('[IPC] RAG query failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// =============================================================================
// Stream Management
// =============================================================================

// Map to store stream cleanup functions
const streamCleanupMap = new Map<string, () => void>();

/**
 * Cleanup all active streams
 */
export function cleanupAllStreams(): void {
  streamCleanupMap.forEach((cleanup) => cleanup());
  streamCleanupMap.clear();
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize sidecar handlers
 * 
 * This should be called from the main process entry point
 */
export function initializeSidecarHandlers(): void {
  console.log('[IPC] Sidecar handlers initialized');
  
  // Auto-start sidecar on app ready
  const manager = getSidecarManager();
  manager.start().catch((error) => {
    console.error('[IPC] Failed to auto-start sidecar:', error);
  });
}

/**
 * Cleanup sidecar resources
 * 
 * This should be called before app quit
 */
export async function cleanupSidecarHandlers(): Promise<void> {
  console.log('[IPC] Cleaning up sidecar handlers');
  
  // Cancel all active streams
  cleanupAllStreams();
  
  // Stop sidecar
  const manager = getSidecarManager();
  await manager.stop();
}
