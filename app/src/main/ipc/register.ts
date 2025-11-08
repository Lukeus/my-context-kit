import { registerContextHandlers } from './handlers/context.handlers';
import { registerGitHandlers } from './handlers/git.handlers';
import { registerFileSystemHandlers } from './handlers/filesystem.handlers';
import { registerRepoHandlers } from './handlers/repo.handlers';
import { registerBuilderHandlers } from './handlers/builder.handlers';
import { registerSettingsHandlers } from './handlers/settings.handlers';
import { registerClipboardHandlers } from './handlers/clipboard.handlers';
import { registerDialogHandlers } from './handlers/dialog.handlers';
import { registerAIHandlers } from './handlers/ai.handlers';
import { registerLangChainAIHandlers } from './handlers/langchain-ai.handlers';
import { registerRAGHandlers } from './handlers/rag.handlers';
import { registerSpeckitHandlers } from './handlers/speckit.handlers';
import { registerC4Handlers } from './handlers/c4.handlers';
import { registerAssistantHandlers } from './handlers/assistant.handlers';
import { registerAgentHandlers } from './handlers/agent.handlers';
import { registerPathResolutionHandlers } from './handlers/path-resolution.handlers';
import { ContextKitServiceClient } from '../services/ContextKitServiceClient';
import { registerContextKitHandlers } from './contextKitHandlers';
import { initializeSidecarHandlers } from './handlers/sidecar.handlers';

// Global Context Kit service client instance
let contextKitServiceClient: ContextKitServiceClient | null = null;

/**
 * Initialize Context Kit Service
 * 
 * Starts the Python FastAPI service in the background.
 */
export async function initializeContextKitService(): Promise<void> {
  try {
    // Create service client (don't auto-start yet)
    if (!contextKitServiceClient) {
      contextKitServiceClient = new ContextKitServiceClient({
        autoStart: false,
      });
    }
    
    if (contextKitServiceClient.getStatus().running) {
      console.log('Context Kit Service already running');
      return;
    }
    
    // Attempt to start service
    await contextKitServiceClient.start();
    console.log('✓ Context Kit Service initialized');
  } catch (error) {
    console.error('Failed to initialize Context Kit Service:', error);
    console.log('Service can be started manually from the Context Kit UI');
    // Don't fail app startup if service fails to start
    // Service can be started manually from UI
  }
}

/**
 * Registers all IPC handlers for the application
 * 
 * This is called once during app initialization to set up
 * all communication channels between main and renderer processes.
 */
export async function registerAllHandlers(): Promise<void> {
  // Core context operations
  registerContextHandlers();
  
  // Git operations
  registerGitHandlers();
  
  // File system operations
  registerFileSystemHandlers();
  
  // Repository registry handlers
  registerRepoHandlers();
  
  // Context builder operations
  registerBuilderHandlers();
  
  // Application settings
  registerSettingsHandlers();
  
  // Clipboard operations
  registerClipboardHandlers();
  
  // Native dialog operations
  registerDialogHandlers();
  
  // AI operations (unified LangChain-powered implementation)
  registerAIHandlers();
  
  // LangChain-specific IPC handlers (for langchainStore compatibility)
  registerLangChainAIHandlers();
  
  // RAG operations
  registerRAGHandlers();

  // Assistant safe tooling operations
  registerAssistantHandlers();
  
  // Agent profile management
  registerAgentHandlers();
  
  // Path resolution (LangChain foundational integration)
  registerPathResolutionHandlers();
  
  // Speckit (SDD workflow) operations
  registerSpeckitHandlers();
  
  // C4 diagram operations
  registerC4Handlers();
  
  // Context Kit service operations
  // Initialize service client and register handlers (service start happens in background)
  try {
    await initializeContextKitService();
  } catch (error) {
    console.error('Context Kit service initialization error (non-fatal):', error);
  }
  
  // Always register handlers even if service failed to start
  // This allows UI to show service controls and attempt manual start
  if (!contextKitServiceClient) {
    contextKitServiceClient = new ContextKitServiceClient({ autoStart: false });
  }
  registerContextKitHandlers(contextKitServiceClient);
  
  // Sidecar handlers (Phase 4 - Python AI service)
  initializeSidecarHandlers();
}
