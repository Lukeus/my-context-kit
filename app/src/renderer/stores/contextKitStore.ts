/**
 * Context Kit Store
 * 
 * Manages state and operations for the Context Kit service integration.
 * Provides access to inspect, spec generation, promptification, and code generation.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useCache } from '@/composables/useCache';

export interface ServiceStatus {
  running: boolean;
  healthy: boolean;
  port: number;
  uptime?: number;
  lastError?: string;
}

export interface EntitySummary {
  id: string;
  type: string;
  title?: string;
  status?: string;
  relationships: Record<string, string[]>;
}

export interface InspectResponse {
  overview: {
    total_entities: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
  };
  entities: EntitySummary[];
  relationships: Record<string, Array<{ from: string; to: string; type: string }>>;
  gaps: string[];
  recommendations: string[];
  duration_ms: number;
}

export interface SpecGenerateResponse {
  spec_id: string;
  spec_content: string;
  related_entities: string[];
  metadata: Record<string, unknown>;
  log_entry_id: string;
  duration_ms: number;
}

export interface PromptifyResponse {
  spec_id: string;
  prompt: string;
  context_included: string[];
  metadata: Record<string, unknown>;
  log_entry_id: string;
  duration_ms: number;
}

export interface CodeArtifact {
  path: string;
  content: string;
  language: string;
  description?: string;
}

export interface CodegenResponse {
  spec_id: string;
  artifacts: CodeArtifact[];
  summary: string;
  metadata: Record<string, unknown>;
  log_entry_id: string;
  duration_ms: number;
}

export type LoadingOperation = 
  | 'service-start' 
  | 'service-stop' 
  | 'service-status' 
  | 'inspect' 
  | 'spec-generate' 
  | 'promptify' 
  | 'codegen'
  | null;

export interface OperationProgress {
  operation: LoadingOperation;
  message: string;
  progress?: number; // 0-100
  startTime: number;
  cancelable: boolean;
}

export const useContextKitStore = defineStore('contextKit', () => {
  // State
  const serviceStatus = ref<ServiceStatus | null>(null);
  const isLoading = ref(false);
  const currentOperation = ref<OperationProgress | null>(null);
  const lastError = ref<string | null>(null);
  
  // Abort controller for cancellable operations
  let currentAbortController: AbortController | null = null;
  
  // Cache for performance
  const { cache } = useCache();
  
  // Inspection results
  const lastInspection = ref<InspectResponse | null>(null);
  
  // Spec generation results
  const generatedSpecs = ref<Map<string, SpecGenerateResponse>>(new Map());
  
  // Promptify results
  const generatedPrompts = ref<Map<string, PromptifyResponse>>(new Map());
  
  // Code generation results
  const generatedCode = ref<Map<string, CodegenResponse>>(new Map());

  // Computed
  const isServiceHealthy = computed(() => serviceStatus.value?.healthy ?? false);
  const isServiceRunning = computed(() => serviceStatus.value?.running ?? false);

  // Helper to set loading state with operation details
  function setLoading(operation: LoadingOperation, message: string, cancelable: boolean = false): void {
    // Create new AbortController for cancelable operations
    if (cancelable) {
      currentAbortController = new AbortController();
    }
    
    isLoading.value = true;
    currentOperation.value = {
      operation,
      message,
      startTime: Date.now(),
      cancelable,
    };
  }

  function clearLoading(): void {
    isLoading.value = false;
    currentOperation.value = null;
    
    // Clean up abort controller
    if (currentAbortController) {
      currentAbortController = null;
    }
  }
  
  function cancelCurrentOperation(): void {
    if (currentAbortController && currentOperation.value?.cancelable) {
      currentAbortController.abort();
      lastError.value = 'Operation cancelled by user';
      clearLoading();
    }
  }

  function updateProgress(progress: number, message?: string): void {
    if (currentOperation.value) {
      currentOperation.value.progress = progress;
      if (message) {
        currentOperation.value.message = message;
      }
    }
  }

  // Actions
  async function checkServiceStatus(): Promise<ServiceStatus | null> {
    try {
      const status = await window.api.contextKit.status();
      serviceStatus.value = status as ServiceStatus;
      return status as ServiceStatus;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Failed to check service status';
      return null;
    }
  }

  async function startService(): Promise<boolean> {
    try {
      setLoading('service-start', 'Starting Context Kit service...');
      lastError.value = null;
      
      const result = await window.api.contextKit.start();
      
      if ('success' in result && result.success) {
        updateProgress(80, 'Verifying service health...');
        await checkServiceStatus();
        return true;
      }
      
      if ('error' in result) {
        lastError.value = result.error as string;
      }
      return false;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Failed to start service';
      return false;
    } finally {
      clearLoading();
    }
  }

  async function stopService(): Promise<boolean> {
    try {
      setLoading('service-stop', 'Stopping Context Kit service...');
      lastError.value = null;
      
      const result = await window.api.contextKit.stop();
      
      if ('success' in result && result.success) {
        updateProgress(80, 'Verifying service stopped...');
        await checkServiceStatus();
        return true;
      }
      
      if ('error' in result) {
        lastError.value = result.error as string;
      }
      return false;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Failed to stop service';
      return false;
    } finally {
      clearLoading();
    }
  }

  async function inspectContext(
    repoPath: string,
    includeTypes?: string[],
    depth: number = 2
  ): Promise<InspectResponse | null> {
    try {
      setLoading('inspect', 'Analyzing repository structure...');
      lastError.value = null;
      
      // Create cache key based on inspection parameters
      const cacheKey = `inspect:${repoPath}:${(includeTypes || []).join(',')}:${depth}`;
      
      // Check cache first (5 minute TTL)
      const cached = cache.get<InspectResponse>(cacheKey);
      if (cached) {
        lastInspection.value = cached;
        clearLoading();
        return cached;
      }
      
      updateProgress(20, 'Loading context repository...');
      const result = await window.api.contextKit.inspect(repoPath, includeTypes, depth);
      
      if ('success' in result && result.success && 'data' in result) {
        updateProgress(90, 'Processing inspection results...');
        const inspectionData = result.data as InspectResponse;
        
        // Cache the result
        cache.set(cacheKey, inspectionData, 300000); // 5 minutes
        
        lastInspection.value = inspectionData;
        return inspectionData;
      }
      
      if ('error' in result) {
        lastError.value = result.error as string;
      }
      return null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Inspection failed';
      return null;
    } finally {
      clearLoading();
    }
  }

  async function generateSpec(
    repoPath: string,
    entityIds: string[],
    userPrompt: string,
    templateId?: string,
    includeRag: boolean = true
  ): Promise<SpecGenerateResponse | null> {
    try {
      console.log('[contextKitStore] generateSpec called');
      console.log('[contextKitStore] repoPath:', repoPath, typeof repoPath);
      console.log('[contextKitStore] entityIds:', entityIds, Array.isArray(entityIds), entityIds.constructor.name);
      console.log('[contextKitStore] userPrompt:', userPrompt.substring(0, 50), typeof userPrompt);
      console.log('[contextKitStore] templateId:', templateId);
      console.log('[contextKitStore] includeRag:', includeRag);
      
      // Convert to plain values to avoid Vue Proxy issues
      const plainEntityIds = Array.isArray(entityIds) ? [...entityIds] : [];
      const plainRepoPath = String(repoPath);
      const plainUserPrompt = String(userPrompt);
      const plainIncludeRag = Boolean(includeRag);
      
      console.log('[contextKitStore] Converted to plain values:', { plainRepoPath, plainEntityIds, plainUserPrompt, plainIncludeRag });
      
      setLoading('spec-generate', 'Preparing spec generation...', true);
      lastError.value = null;
      
      updateProgress(10, 'Loading context entities...');
      console.log('[contextKitStore] About to call window.api.contextKit.specGenerate');
      const result = await window.api.contextKit.specGenerate(
        plainRepoPath,
        plainEntityIds,
        plainUserPrompt,
        templateId,
        plainIncludeRag
      );
      console.log('[contextKitStore] Result received:', result);
      
      if ('success' in result && result.success && 'data' in result) {
        updateProgress(90, 'Finalizing specification...');
        const specResponse = result.data as SpecGenerateResponse;
        generatedSpecs.value.set(specResponse.spec_id, specResponse);
        return specResponse;
      }
      
      if ('error' in result) {
        lastError.value = result.error as string;
      }
      return null;
    } catch (error) {
      // Check if operation was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        lastError.value = 'Spec generation cancelled';
        return null;
      }
      lastError.value = error instanceof Error ? error.message : 'Spec generation failed';
      return null;
    } finally {
      clearLoading();
    }
  }

  async function promptifySpec(
    repoPath: string,
    specId: string,
    specContent?: string,
    targetAgent: string = 'codegen',
    includeContext: boolean = true
  ): Promise<PromptifyResponse | null> {
    try {
      setLoading('promptify', 'Building prompt from specification...');
      lastError.value = null;
      
      updateProgress(20, 'Loading specification context...');
      const result = await window.api.contextKit.promptify(
        repoPath,
        specId,
        specContent,
        targetAgent,
        includeContext
      );
      
      if ('success' in result && result.success && 'data' in result) {
        updateProgress(90, 'Finalizing prompt...');
        const promptResponse = result.data as PromptifyResponse;
        generatedPrompts.value.set(promptResponse.spec_id, promptResponse);
        return promptResponse;
      }
      
      if ('error' in result) {
        lastError.value = result.error as string;
      }
      return null;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Promptification failed';
      return null;
    } finally {
      clearLoading();
    }
  }

  async function generateCode(
    repoPath: string,
    specId: string,
    prompt?: string,
    language?: string,
    framework?: string,
    styleGuide?: string
  ): Promise<CodegenResponse | null> {
    try {
      setLoading('codegen', 'Preparing code generation...', true);
      lastError.value = null;
      
      updateProgress(10, 'Loading specification and context...');
      const result = await window.api.contextKit.codegen(
        repoPath,
        specId,
        prompt,
        language,
        framework,
        styleGuide
      );
      
      if ('success' in result && result.success && 'data' in result) {
        updateProgress(90, 'Processing generated code...');
        const codegenResponse = result.data as CodegenResponse;
        generatedCode.value.set(codegenResponse.spec_id, codegenResponse);
        return codegenResponse;
      }
      
      if ('error' in result) {
        lastError.value = result.error as string;
      }
      return null;
    } catch (error) {
      // Check if operation was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        lastError.value = 'Code generation cancelled';
        return null;
      }
      lastError.value = error instanceof Error ? error.message : 'Code generation failed';
      return null;
    } finally {
      clearLoading();
    }
  }

  function clearError(): void {
    lastError.value = null;
  }

  function getGeneratedSpec(specId: string): SpecGenerateResponse | undefined {
    return generatedSpecs.value.get(specId);
  }

  function getGeneratedPrompt(specId: string): PromptifyResponse | undefined {
    return generatedPrompts.value.get(specId);
  }

  function getGeneratedCode(specId: string): CodegenResponse | undefined {
    return generatedCode.value.get(specId);
  }

  // Initialize service status on store creation
  void checkServiceStatus();

  return {
    // State
    serviceStatus,
    isLoading,
    currentOperation,
    lastError,
    lastInspection,
    generatedSpecs,
    generatedPrompts,
    generatedCode,
    
    // Computed
    isServiceHealthy,
    isServiceRunning,
    
    // Actions
    checkServiceStatus,
    startService,
    stopService,
    inspectContext,
    generateSpec,
    promptifySpec,
    generateCode,
    clearError,
    cancelCurrentOperation,
    updateProgress,
    getGeneratedSpec,
    getGeneratedPrompt,
    getGeneratedCode,
  };
});
