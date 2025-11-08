/**
 * IPC Handlers for Context Kit Service
 * 
 * Provides communication bridge between Electron renderer and Python FastAPI service.
 */

import { ipcMain } from 'electron';
import { inspect } from 'node:util';
import type { ContextKitServiceClient } from '../services/ContextKitServiceClient';

/**
 * Sanitize data for IPC transfer by ensuring it's JSON-serializable
 */
function sanitizeForIpc<T>(data: T): T {
  try {
    // structuredClone preserves more native types when available
    return structuredClone(data);
  } catch (cloneError) {
    console.warn('structuredClone failed, falling back to JSON serialization', cloneError);
    logNonCloneable(data);
  }

  try {
    const replacer = (_key: string, value: unknown): unknown => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (value instanceof Map) {
        return Object.fromEntries(value.entries());
      }
      if (value instanceof Set) {
        return Array.from(value.values());
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value instanceof Uint8Array || value instanceof Uint16Array || value instanceof Uint32Array) {
        return Array.from(value);
      }
      return value;
    };

    return JSON.parse(JSON.stringify(data, replacer)) as T;
  } catch (error) {
    console.error('Failed to sanitize data for IPC transfer', error);
    console.error('Offending payload preview:', data);
    logNonCloneable(data);
    throw error;
  }
}

function logNonCloneable(value: unknown, path = 'root', seen = new WeakSet<object>()): void {
  if (typeof value !== 'object' || value === null) {
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
      console.warn(`Non-cloneable value at ${path}:`, typeof value);
    }
    return;
  }

  if (seen.has(value as object)) {
    return;
  }
  seen.add(value as object);

  if (value instanceof WeakMap || value instanceof WeakSet) {
    console.warn(`Non-cloneable weak collection at ${path}`);
    return;
  }

  if (value instanceof Map || value instanceof Set || value instanceof Date || ArrayBuffer.isView(value)) {
    console.debug(`Cloneable exotic value at ${path}:`, inspect(value, { depth: 1 }));
  }

  const entries = Array.isArray(value) ? value.entries() : Object.entries(value as Record<string, unknown>);
  for (const [key, nested] of entries) {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${String(key)}`;
    if (typeof nested === 'function' || typeof nested === 'symbol' || typeof nested === 'bigint') {
      console.warn(`Non-cloneable value at ${childPath}:`, typeof nested);
      continue;
    }
    if (typeof nested === 'object' && nested !== null) {
      logNonCloneable(nested, childPath, seen);
    }
  }
}

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
          depth: request.depth ?? 2,
        }),
      });

      const sanitized = sanitizeForIpc(response);
      return { success: true, data: sanitized };
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

      console.log('[spec-generate] Response type:', typeof response);
      console.log('[spec-generate] Response keys:', Object.keys(response as any));
      console.log('[spec-generate] Response preview:', JSON.stringify(response, null, 2).substring(0, 500));
      
      // Deep clone via JSON to ensure all data is serializable
      const serializable = JSON.parse(JSON.stringify(response));
      console.log('[spec-generate] Serializable data created successfully');
      
      return { success: true, data: serializable };
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

      const sanitized = sanitizeForIpc(response);
      return { success: true, data: sanitized };
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

      const sanitized = sanitizeForIpc(response);
      return { success: true, data: sanitized };
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
