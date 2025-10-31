/**
 * IPC Handlers for Context Kit Service
 * 
 * Provides communication bridge between Electron renderer and Python FastAPI service.
 */

import { ipcMain } from 'electron';
import type { ContextKitServiceClient } from '../services/ContextKitServiceClient';

export interface InspectRequest {
  repoPath: string;
  includeTypes?: string[];
  depth?: number;
}

export interface SpecGenerateRequest {
  repoPath: string;
  entityIds: string[];
  userPrompt: string;
  templateId?: string;
  includeRag?: boolean;
}

export interface PromptifyRequest {
  repoPath: string;
  specId: string;
  specContent?: string;
  targetAgent?: string;
  includeContext?: boolean;
}

export interface CodegenRequest {
  repoPath: string;
  specId: string;
  prompt?: string;
  language?: string;
  framework?: string;
  styleGuide?: string;
}

/**
 * Register all Context Kit IPC handlers
 */
export function registerContextKitHandlers(serviceClient: ContextKitServiceClient): void {
  // Service status
  ipcMain.handle('context-kit:status', async () => {
    return serviceClient.getStatus();
  });

  // Start service manually
  ipcMain.handle('context-kit:start', async () => {
    try {
      await serviceClient.start();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start service',
      };
    }
  });

  // Stop service manually
  ipcMain.handle('context-kit:stop', async () => {
    try {
      await serviceClient.stop();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop service',
      };
    }
  });

  // Context inspection
  ipcMain.handle('context-kit:inspect', async (_, request: InspectRequest) => {
    try {
      const response = await serviceClient.request('/context/inspect', {
        method: 'POST',
        body: JSON.stringify({
          repo_path: request.repoPath,
          include_types: request.includeTypes,
          depth: request.depth || 2,
        }),
      });

      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Inspection failed',
      };
    }
  });

  // Specification generation
  ipcMain.handle('context-kit:spec-generate', async (_, request: SpecGenerateRequest) => {
    try {
      const response = await serviceClient.request('/spec/generate', {
        method: 'POST',
        body: JSON.stringify({
          repo_path: request.repoPath,
          entity_ids: request.entityIds,
          user_prompt: request.userPrompt,
          template_id: request.templateId,
          include_rag: request.includeRag ?? true,
        }),
      });

      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Spec generation failed',
      };
    }
  });

  // Promptification
  ipcMain.handle('context-kit:promptify', async (_, request: PromptifyRequest) => {
    try {
      const response = await serviceClient.request('/spec/promptify', {
        method: 'POST',
        body: JSON.stringify({
          repo_path: request.repoPath,
          spec_id: request.specId,
          spec_content: request.specContent,
          target_agent: request.targetAgent || 'codegen',
          include_context: request.includeContext ?? true,
        }),
      });

      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Promptification failed',
      };
    }
  });

  // Code generation
  ipcMain.handle('context-kit:codegen', async (_, request: CodegenRequest) => {
    try {
      const response = await serviceClient.request('/codegen/from-spec', {
        method: 'POST',
        body: JSON.stringify({
          repo_path: request.repoPath,
          spec_id: request.specId,
          prompt: request.prompt,
          language: request.language,
          framework: request.framework,
          style_guide: request.styleGuide,
        }),
      });

      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Code generation failed',
      };
    }
  });

  console.log('✓ Context Kit IPC handlers registered');
}

/**
 * Unregister all Context Kit IPC handlers
 */
export function unregisterContextKitHandlers(): void {
  ipcMain.removeHandler('context-kit:status');
  ipcMain.removeHandler('context-kit:start');
  ipcMain.removeHandler('context-kit:stop');
  ipcMain.removeHandler('context-kit:inspect');
  ipcMain.removeHandler('context-kit:spec-generate');
  ipcMain.removeHandler('context-kit:promptify');
  ipcMain.removeHandler('context-kit:codegen');

  console.log('✓ Context Kit IPC handlers unregistered');
}
