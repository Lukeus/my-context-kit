import { contextBridge, ipcRenderer } from 'electron';
import type {
  SpecKitEntityType,
  SpecKitFetchPipelineResult,
  SpecKitPipelineReport,
  SpecKitPreviewListResponse,
} from '@shared/speckit';
import { createAssistantBridge } from '../preload/assistantBridge';
import type {
  CreateSessionPayload,
  ExecuteToolPayload,
  ResolvePendingActionPayload,
  SendMessagePayload,
  MessageResponse,
  ToolExecutionResponse,
  RunPipelinePayload
} from '../preload/assistantBridge';
import type {
  AssistantSession,
  PendingAction,
  ToolInvocationRecord
} from '@shared/assistant/types';
import { agentBridge, type AgentBridge } from '../preload/agentBridge';

// Expose IPC API to renderer process
contextBridge.exposeInMainWorld('api', {
  app: {
    getDefaultRepoPath: () => ipcRenderer.invoke('app:getDefaultRepoPath'),
    restart: () => ipcRenderer.invoke('app:restart'),
  },
  repos: {
    list: () => ipcRenderer.invoke('repos:list'),
    add: (payload: { label: string; path: string; setActive?: boolean; autoDetected?: boolean }) =>
      ipcRenderer.invoke('repos:add', payload),
    update: (payload: { id: string; label?: string; path?: string; autoDetected?: boolean }) =>
      ipcRenderer.invoke('repos:update', payload),
    remove: (id: string) => ipcRenderer.invoke('repos:remove', { id }),
    setActive: (id: string) => ipcRenderer.invoke('repos:setActive', { id }),
    watch: (dir: string) => ipcRenderer.invoke('repo:watch', { dir }),
    unwatch: (dir: string) => ipcRenderer.invoke('repo:unwatch', { dir }),
    onFileChanged: (listener: (payload: any) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('repo:fileChanged', wrapped);
      return () => ipcRenderer.removeListener('repo:fileChanged', wrapped);
    },
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', { key }),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', { key, value }),
  },
  context: {
    validate: (dir: string) => ipcRenderer.invoke('context:validate', { dir }),
    buildGraph: (dir: string) => ipcRenderer.invoke('context:buildGraph', { dir }),
    impact: (dir: string, changedIds: string[]) => ipcRenderer.invoke('context:impact', { dir, changedIds }),
    generate: (dir: string, ids: string[]) => ipcRenderer.invoke('context:generate', { dir, ids }),
    nextId: (dir: string, entityType: string) => ipcRenderer.invoke('context:nextId', { dir, entityType }),
    createEntity: (dir: string, entity: any, entityType: string) => ipcRenderer.invoke('context:createEntity', { dir, entity, entityType }),
    getSuggestions: (dir: string, command: string, params: any[]) => ipcRenderer.invoke('context:getSuggestions', { dir, command, params }),
    getTemplates: (dir: string, entityType?: string) => ipcRenderer.invoke('context:getTemplates', { dir, entityType }),
    scaffoldNewRepo: (dir: string, repoName: string, projectPurpose?: string, constitutionSummary?: string) => ipcRenderer.invoke('context:scaffoldNewRepo', { dir, repoName, projectPurpose, constitutionSummary }),
  },
  fs: {
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', { filePath }),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', { filePath, content }),
    findEntityFile: (dir: string, entityType: string, entityId: string) => ipcRenderer.invoke('fs:findEntityFile', { dir, entityType, entityId }),
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', { text }),
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  },
  git: {
    status: (dir: string) => ipcRenderer.invoke('git:status', { dir }),
    diff: (dir: string, filePath?: string) => ipcRenderer.invoke('git:diff', { dir, filePath }),
    commit: (dir: string, message: string, files?: string[]) => ipcRenderer.invoke('git:commit', { dir, message, files }),
    branch: (dir: string) => ipcRenderer.invoke('git:branch', { dir }),
    createBranch: (dir: string, branchName: string, checkout?: boolean) => ipcRenderer.invoke('git:createBranch', { dir, branchName, checkout }),
    checkout: (dir: string, branchName: string) => ipcRenderer.invoke('git:checkout', { dir, branchName }),
    revertFile: (dir: string, filePath: string) => ipcRenderer.invoke('git:revertFile', { dir, filePath }),
    push: (dir: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:push', { dir, remote, branch }),
    createPR: (dir: string, title: string, body: string, base?: string) => ipcRenderer.invoke('git:createPR', { dir, title, body, base }),
  },
  ai: {
    getConfig: (dir: string) => ipcRenderer.invoke('ai:getConfig', { dir }),
    saveConfig: (dir: string, config: any) => ipcRenderer.invoke('ai:saveConfig', { dir, config }),
    saveCredentials: (provider: string, apiKey: string) => ipcRenderer.invoke('ai:saveCredentials', { provider, apiKey }),
    getCredentials: (provider: string) => ipcRenderer.invoke('ai:getCredentials', { provider }),
    testConnection: (dir: string, provider: string, endpoint: string, model: string, useStoredKey: boolean) => 
      ipcRenderer.invoke('ai:testConnection', { dir, provider, endpoint, model, useStoredKey }),
    generate: (dir: string, entityType: string, userPrompt: string) => 
      ipcRenderer.invoke('ai:generate', { dir, entityType, userPrompt }),
    assist: (dir: string, question: string, mode?: string, focusId?: string) =>
      ipcRenderer.invoke('ai:assist', { dir, question, mode, focusId }),
    // Streaming API
    assistStreamStart: (dir: string, question: string, mode?: string, focusId?: string) =>
      ipcRenderer.invoke('ai:assistStreamStart', { dir, question, mode, focusId }),
    assistStreamCancel: (streamId: string) => ipcRenderer.invoke('ai:assistStreamCancel', { streamId }),
    onAssistStreamEvent: (listener: (payload: any) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('ai:assistStream:event', wrapped);
      return () => ipcRenderer.removeListener('ai:assistStream:event', wrapped);
    },
    onAssistStreamEnd: (listener: (payload: any) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('ai:assistStream:end', wrapped);
      return () => ipcRenderer.removeListener('ai:assistStream:end', wrapped);
    },
    applyEdit: (dir: string, filePath: string, updatedContent: string, summary?: string) =>
      ipcRenderer.invoke('ai:applyEdit', { dir, filePath, updatedContent, summary }),
        pingEndpoint: (endpoint: string, model: string) => ipcRenderer.invoke('ai:pingEndpoint', { endpoint, model }),
    // Per-provider configuration
    getProviderConfigs: (dir: string) => ipcRenderer.invoke('ai:getProviderConfigs', { dir }),
    saveProviderConfig: (dir: string, provider: string, config: { endpoint: string; model: string }) =>
      ipcRenderer.invoke('ai:saveProviderConfig', { dir, provider, config }),
  },
  // LangChain AI API (feature-flagged implementation)
  langchain: {
    isEnabled: () => ipcRenderer.invoke('langchain:isEnabled'),
    testConnection: (payload: { provider: string; endpoint: string; model: string; apiKey?: string }) =>
      ipcRenderer.invoke('langchain:testConnection', payload),
    generateEntity: (dir: string, entityType: string, userPrompt: string, apiKey?: string) =>
      ipcRenderer.invoke('langchain:generateEntity', { dir, entityType, userPrompt, apiKey }),
    assistStreamStart: (dir: string, question: string, conversationHistory?: Array<{ role: string; content: string }>, contextSnapshot?: any) =>
      ipcRenderer.invoke('langchain:assistStreamStart', { dir, question, conversationHistory, contextSnapshot }),
    assistStreamCancel: (streamId: string) => ipcRenderer.invoke('langchain:assistStreamCancel', { streamId }),
    onAssistStreamToken: (listener: (payload: { streamId: string; token: string; type: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('langchain:assistStream:token', wrapped);
      return () => ipcRenderer.removeListener('langchain:assistStream:token', wrapped);
    },
    onAssistStreamEnd: (listener: (payload: { streamId: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('langchain:assistStream:end', wrapped);
      return () => ipcRenderer.removeListener('langchain:assistStream:end', wrapped);
    },
    onAssistStreamError: (listener: (payload: { streamId: string; error: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('langchain:assistStream:error', wrapped);
      return () => ipcRenderer.removeListener('langchain:assistStream:error', wrapped);
    },
    clearCache: () => ipcRenderer.invoke('langchain:clearCache'),
  },
  // RAG API (Retrieval-Augmented Generation)
  rag: {
    isEnabled: () => ipcRenderer.invoke('rag:isEnabled'),
    indexRepository: (repoPath: string, config: any) =>
      ipcRenderer.invoke('rag:indexRepository', { repoPath, config }),
    query: (repoPath: string, config: any, question: string, topK?: number) =>
      ipcRenderer.invoke('rag:query', { repoPath, config, question, topK }),
    queryStream: (repoPath: string, config: any, question: string, topK: number, streamId: string) =>
      ipcRenderer.invoke('rag:queryStream', { repoPath, config, question, topK, streamId }),
    findSimilar: (repoPath: string, config: any, entityId: string, limit?: number) =>
      ipcRenderer.invoke('rag:findSimilar', { repoPath, config, entityId, limit }),
    search: (repoPath: string, config: any, query: string, limit?: number) =>
      ipcRenderer.invoke('rag:search', { repoPath, config, query, limit }),
    getEntityContext: (repoPath: string, config: any, entityId: string) =>
      ipcRenderer.invoke('rag:getEntityContext', { repoPath, config, entityId }),
    getStatus: (repoPath: string, config: any) =>
      ipcRenderer.invoke('rag:getStatus', { repoPath, config }),
    clearIndex: (repoPath: string, config: any) =>
      ipcRenderer.invoke('rag:clearIndex', { repoPath, config }),
    onIndexProgress: (listener: (progress: { total: number; processed: number; percentage: number; currentEntity?: string }) => void) => {
      const wrapped = (_e: any, progress: any) => listener(progress);
      ipcRenderer.on('rag:indexProgress', wrapped);
      return () => ipcRenderer.removeListener('rag:indexProgress', wrapped);
    },
    onStreamChunk: (listener: (payload: { streamId: string; type: 'source' | 'token' | 'done'; data?: any }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('rag:streamChunk', wrapped);
      return () => ipcRenderer.removeListener('rag:streamChunk', wrapped);
    },
    onStreamError: (listener: (payload: { streamId: string; error: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('rag:streamError', wrapped);
      return () => ipcRenderer.removeListener('rag:streamError', wrapped);
    },
    cancelQuery: (repoPath: string, config: any) =>
      ipcRenderer.invoke('rag:cancelQuery', { repoPath, config }),
    cancelStream: (streamId: string) => ipcRenderer.invoke('rag:cancelStream', { streamId }),
  },
  assistant: createAssistantBridge(ipcRenderer),
  agent: agentBridge,
  speckit: {
    specify: (repoPath: string, description: string) =>
      ipcRenderer.invoke('speckit:specify', { repoPath, description }),
    plan: (repoPath: string, specPath: string, techStack?: string[]) =>
      ipcRenderer.invoke('speckit:plan', { repoPath, specPath, techStack }),
    tasks: (repoPath: string, planPath: string) =>
      ipcRenderer.invoke('speckit:tasks', { repoPath, planPath }),
    fetch: (repoPath: string, releaseTag?: string, forceRefresh?: boolean): Promise<SpecKitFetchPipelineResult> =>
      ipcRenderer.invoke('speckit:fetch', { repoPath, releaseTag, forceRefresh }),
    listPreviews: (repoPath: string): Promise<SpecKitPreviewListResponse> =>
      ipcRenderer.invoke('speckit:listPreviews', { repoPath }),
    runPipelines: (
      repoPath: string,
      options?: {
        createdPaths?: string[];
        entityMetadata?: Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>;
        sourcePreviewPaths?: string[];
      },
    ): Promise<{ ok: boolean; data?: SpecKitPipelineReport; error?: string }> =>
      ipcRenderer.invoke('speckit:runPipelines', {
        repoPath,
        ...(options ?? {}),
      }),
    toEntity: (
      repoPath: string,
      specPath: string,
      options?: { createFeature?: boolean; createStories?: boolean; sourcePreviewPaths?: string[] }
    ) =>
      ipcRenderer.invoke('speckit:toEntity', { repoPath, specPath, options }),
    tasksToEntity: (repoPath: string, tasksPath: string) =>
      ipcRenderer.invoke('speckit:tasksToEntity', { repoPath, tasksPath }),
    aiGenerateSpec: (repoPath: string, description: string) =>
      ipcRenderer.invoke('speckit:aiGenerateSpec', { repoPath, description }),
    aiRefineSpec: (repoPath: string, specPath: string, feedback: string) =>
      ipcRenderer.invoke('speckit:aiRefineSpec', { repoPath, specPath, feedback }),
  },
  c4: {
    loadDiagrams: (dir: string) => ipcRenderer.invoke('c4:load-diagrams', { dir }),
    analyze: (filePath: string) => ipcRenderer.invoke('c4:analyze', { filePath }),
  },
  sidecar: {
    start: () => ipcRenderer.invoke('sidecar:start'),
    stop: () => ipcRenderer.invoke('sidecar:stop'),
    status: () => ipcRenderer.invoke('sidecar:status'),
    health: () => ipcRenderer.invoke('sidecar:health'),
    generateEntity: (request: any) => ipcRenderer.invoke('sidecar:generate-entity', request),
    assistStream: (request: any) => ipcRenderer.invoke('sidecar:assist-stream', request),
    cancelStream: (streamId: string) => ipcRenderer.invoke('sidecar:cancel-stream', streamId),
    executeTool: (request: any) => ipcRenderer.invoke('sidecar:execute-tool', request),
    ragQuery: (request: any) => ipcRenderer.invoke('sidecar:rag-query', request),
    onStreamToken: (listener: (payload: { streamId: string; token: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('sidecar:stream-token', wrapped);
      return () => ipcRenderer.removeListener('sidecar:stream-token', wrapped);
    },
    onStreamComplete: (listener: (payload: { streamId: string; fullContent: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('sidecar:stream-complete', wrapped);
      return () => ipcRenderer.removeListener('sidecar:stream-complete', wrapped);
    },
    onStreamError: (listener: (payload: { streamId: string; error: string }) => void) => {
      const wrapped = (_e: any, payload: any) => listener(payload);
      ipcRenderer.on('sidecar:stream-error', wrapped);
      return () => ipcRenderer.removeListener('sidecar:stream-error', wrapped);
    },
  },
  contextKit: {
    status: () => ipcRenderer.invoke('context-kit:status'),
    start: () => ipcRenderer.invoke('context-kit:start'),
    stop: () => ipcRenderer.invoke('context-kit:stop'),
    inspect: (repoPath: string, includeTypes?: string[], depth?: number) =>
      ipcRenderer.invoke('context-kit:inspect', { repoPath, includeTypes, depth }),
    specGenerate: (repoPath: string, entityIds: string[], userPrompt: string, templateId?: string, includeRag?: boolean) =>
      ipcRenderer.invoke('context-kit:spec-generate', { repoPath, entityIds, userPrompt, templateId, includeRag }),
    promptify: (repoPath: string, specId: string, specContent?: string, targetAgent?: string, includeContext?: boolean) =>
      ipcRenderer.invoke('context-kit:promptify', { repoPath, specId, specContent, targetAgent, includeContext }),
    codegen: (repoPath: string, specId: string, prompt?: string, language?: string, framework?: string, styleGuide?: string) =>
      ipcRenderer.invoke('context-kit:codegen', { repoPath, specId, prompt, language, framework, styleGuide }),
  },
});

// Type definitions for window.api
declare global {
  interface Window {
    api: {
      repos: {
        list: () => Promise<RepoRegistryResponse>;
        add: (payload: { label: string; path: string; setActive?: boolean; autoDetected?: boolean }) => Promise<RepoRegistryResponse>;
        update: (payload: { id: string; label?: string; path?: string; autoDetected?: boolean }) => Promise<RepoRegistryResponse>;
        remove: (id: string) => Promise<RepoRegistryResponse>;
        setActive: (id: string) => Promise<RepoRegistryResponse>;
        watch: (dir: string) => Promise<{ ok: boolean; error?: string }>;
        unwatch: (dir: string) => Promise<{ ok: boolean; error?: string }>;
        onFileChanged: (listener: (payload: any) => void) => (() => void);
      };
      settings: {
        get: (key: string) => Promise<{ ok: boolean; value?: any; error?: string }>;
        set: (key: string, value: any) => Promise<{ ok: boolean; error?: string }>;
      };
      context: {
        validate: (dir: string) => Promise<any>;
        buildGraph: (dir: string) => Promise<any>;
        impact: (dir: string, changedIds: string[]) => Promise<any>;
        generate: (dir: string, ids: string[]) => Promise<any>;
        nextId: (dir: string, entityType: string) => Promise<{ ok: boolean; id?: string; error?: string }>;
        createEntity: (dir: string, entity: any, entityType: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
        getSuggestions: (dir: string, command: string, params: any[]) => Promise<any>;
        getTemplates: (dir: string, entityType?: string) => Promise<{ ok: boolean; templates: any[]; error?: string }>;
        scaffoldNewRepo: (dir: string, repoName: string, projectPurpose?: string, constitutionSummary?: string) => Promise<{ ok: boolean; path?: string; error?: string; warning?: string }>;
      };
      fs: {
        readFile: (filePath: string) => Promise<{ ok: boolean; content?: string; error?: string }>;
        writeFile: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>;
        findEntityFile: (dir: string, entityType: string, entityId: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
      };
      clipboard: {
        writeText: (text: string) => Promise<{ ok: boolean; error?: string }>;
      };
      dialog: {
        selectDirectory: () => Promise<{ ok: boolean; paths: string[]; error?: string }>;
      };
      git: {
        status: (dir: string) => Promise<any>;
        diff: (dir: string, filePath?: string) => Promise<any>;
        commit: (dir: string, message: string, files?: string[]) => Promise<any>;
        branch: (dir: string) => Promise<any>;
        createBranch: (dir: string, branchName: string, checkout?: boolean) => Promise<any>;
        checkout: (dir: string, branchName: string) => Promise<any>;
        revertFile: (dir: string, filePath: string) => Promise<{ ok: boolean; error?: string }>;
        push: (dir: string, remote?: string, branch?: string) => Promise<any>;
        createPR: (dir: string, title: string, body: string, base?: string) => Promise<any>;
      };
      ai: {
        getConfig: (dir: string) => Promise<{ ok: boolean; config?: any; error?: string }>;
        saveConfig: (dir: string, config: any) => Promise<{ ok: boolean; error?: string }>;
        saveCredentials: (provider: string, apiKey: string) => Promise<{ ok: boolean; error?: string }>;
        getCredentials: (provider: string) => Promise<{ ok: boolean; hasCredentials?: boolean; error?: string }>;
        testConnection: (dir: string, provider: string, endpoint: string, model: string, useStoredKey: boolean) => 
          Promise<{ ok: boolean; message?: string; error?: string }>;
        generate: (dir: string, entityType: string, userPrompt: string) => 
          Promise<{ ok: boolean; entity?: any; usage?: any; error?: string; rawContent?: string }>;
        assist: (dir: string, question: string, mode?: string, focusId?: string) =>
          Promise<{
            ok: boolean;
            answer?: string;
            improvements?: Array<{ target?: string; suggestion?: string; impact?: string }>;
            clarifications?: string[];
            followUps?: string[];
            references?: Array<{ type?: string; id?: string; note?: string }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            snapshot?: Record<string, unknown>;
            error?: string;
            rawContent?: string;
            edits?: Array<{ targetId?: string; filePath: string; summary: string; updatedContent: string }>;
          }>;
        assistStreamStart: (dir: string, question: string, mode?: string, focusId?: string) => Promise<{ ok: boolean; streamId?: string; error?: string }>;
        assistStreamCancel: (streamId: string) => Promise<{ ok: boolean; error?: string }>;
        onAssistStreamEvent: (listener: (payload: any) => void) => (() => void);
        onAssistStreamEnd: (listener: (payload: any) => void) => (() => void);
        applyEdit: (dir: string, filePath: string, updatedContent: string, summary?: string) =>
          Promise<{ ok: boolean; error?: string }>;
      };
      langchain: {
        isEnabled: () => Promise<{ ok: boolean; enabled?: boolean; error?: string }>;
        testConnection: (payload: { provider: string; endpoint: string; model: string; apiKey?: string }) =>
          Promise<{ ok: boolean; message?: string; error?: string }>;
        generateEntity: (dir: string, entityType: string, userPrompt: string, apiKey?: string) =>
          Promise<{ ok: boolean; entity?: any; message?: string; error?: string }>;
        assistStreamStart: (dir: string, question: string, conversationHistory?: Array<{ role: string; content: string }>, contextSnapshot?: any) =>
          Promise<{ ok: boolean; streamId?: string; error?: string }>;
        assistStreamCancel: (streamId: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
        onAssistStreamToken: (listener: (payload: { streamId: string; token: string; type: string }) => void) => (() => void);
        onAssistStreamEnd: (listener: (payload: { streamId: string }) => void) => (() => void);
        onAssistStreamError: (listener: (payload: { streamId: string; error: string }) => void) => (() => void);
        clearCache: () => Promise<{ ok: boolean; cleared?: boolean; error?: string }>;
      };
      rag: {
        isEnabled: () => Promise<{ ok: boolean; enabled?: boolean; error?: string }>;
        indexRepository: (repoPath: string, config: any) => Promise<{ ok: boolean; documentCount?: number; error?: string }>;
        query: (repoPath: string, config: any, question: string, topK?: number) => 
          Promise<{ ok: boolean; answer?: string; sources?: Array<{ id: string; title?: string; type: string; relevance: number; excerpt: string }>; tokensUsed?: number; usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }; toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>; error?: string }>;
        queryStream: (repoPath: string, config: any, question: string, topK: number, streamId: string) =>
          Promise<{ ok: boolean; streamId?: string; error?: string }>;
        findSimilar: (repoPath: string, config: any, entityId: string, limit?: number) =>
          Promise<{ ok: boolean; similar?: Array<{ id: string; similarity: number; title?: string; type: string }>; error?: string }>;
        search: (repoPath: string, config: any, query: string, limit?: number) =>
          Promise<{ ok: boolean; results?: Array<{ id: string; relevance: number; title?: string; type: string; excerpt: string }>; error?: string }>;
        getEntityContext: (repoPath: string, config: any, entityId: string) =>
          Promise<{ ok: boolean; answer?: string; sources?: Array<{ id: string; title?: string; type: string; relevance: number; excerpt: string }>; error?: string }>;
        getStatus: (repoPath: string, config: any) =>
          Promise<{ ok: boolean; indexed?: boolean; documentCount?: number; error?: string }>;
        clearIndex: (repoPath: string, config: any) => Promise<{ ok: boolean; error?: string }>;
        onIndexProgress: (listener: (progress: { total: number; processed: number; percentage: number; currentEntity?: string }) => void) => (() => void);
        onStreamChunk: (listener: (payload: { streamId: string; type: 'source' | 'token' | 'done'; data?: any }) => void) => (() => void);
        onStreamError: (listener: (payload: { streamId: string; error: string }) => void) => (() => void);
        cancelQuery: (repoPath: string, config: any) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
        cancelStream: (streamId: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
      };
      speckit: {
        specify: (repoPath: string, description: string) => Promise<{
          ok: boolean;
          specNumber?: string;
          branchName?: string;
          specPath?: string;
          created?: boolean;
          message?: string;
          error?: string;
          stack?: string;
        }>;
        plan: (repoPath: string, specPath: string, techStack?: string[]) => Promise<{
          ok: boolean;
          planPath?: string;
          gates?: {
            passed: boolean;
            warnings: string[];
            checks?: {
              simplicity?: { passed: boolean; issues: string[] };
              antiAbstraction?: { passed: boolean; issues: string[] };
              integrationFirst?: { passed: boolean; issues: string[] };
            };
          };
          created?: boolean;
          message?: string;
          error?: string;
          stack?: string;
        }>;
        tasks: (repoPath: string, planPath: string) => Promise<{
          ok: boolean;
          tasksPath?: string;
          tasks?: Array<{ id: string; description: string; parallel: boolean }>;
          parallelGroups?: Array<{ groupId: number; taskIds: string[] }>;
          created?: boolean;
          message?: string;
          error?: string;
          stack?: string;
        }>;
        fetch: (repoPath: string, releaseTag?: string, forceRefresh?: boolean) => Promise<SpecKitFetchPipelineResult>;
        listPreviews: (repoPath: string) => Promise<SpecKitPreviewListResponse>;
        runPipelines: (
          repoPath: string,
          options?: {
            createdPaths?: string[];
            entityMetadata?: Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>;
            sourcePreviewPaths?: string[];
          }
        ) => Promise<{ ok: boolean; data?: SpecKitPipelineReport; error?: string }>;
        toEntity: (
          repoPath: string,
          specPath: string,
          options?: { createFeature?: boolean; createStories?: boolean; sourcePreviewPaths?: string[] }
        ) => 
          Promise<{ ok: boolean; entities?: any; created?: string[]; error?: string; stack?: string }>;
        tasksToEntity: (repoPath: string, tasksPath: string) => 
          Promise<{ ok: boolean; tasks?: any[]; created?: string[]; error?: string; stack?: string }>;
        aiGenerateSpec: (repoPath: string, description: string) => 
          Promise<{ ok: boolean; spec?: any; usage?: any; error?: string; stack?: string }>;
        aiRefineSpec: (repoPath: string, specPath: string, feedback: string) => 
          Promise<{ ok: boolean; spec?: any; usage?: any; error?: string; stack?: string }>;
      };
      assistant: {
        createSession: (payload: CreateSessionPayload) => Promise<AssistantSession>;
        sendMessage: (sessionId: string, payload: SendMessagePayload) => Promise<MessageResponse>;
        executeTool: (sessionId: string, payload: ExecuteToolPayload) => Promise<ToolExecutionResponse>;
        resolvePendingAction: (
          sessionId: string,
          actionId: string,
          payload: ResolvePendingActionPayload
        ) => Promise<PendingAction>;
        listTelemetry: (sessionId: string) => Promise<ToolInvocationRecord[]>;
        onStreamEvent: (listener: (payload: unknown) => void) => (() => void);
        runPipeline: (sessionId: string, payload: RunPipelinePayload) => Promise<ToolExecutionResponse>;
        // T016: Extended telemetry and capability endpoints
        listTelemetryEvents: (sessionId: string) => Promise<any[]>;
        fetchCapabilityManifest: () => Promise<any>;
        getHealthStatus: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'; message?: string; timestamp: string }>;
        getGatingStatus: (repoPath: string) => Promise<import('@shared/assistant/types').GatingStatus>;
      };
      agent: AgentBridge;
      c4: {
        loadDiagrams: (dir: string) => Promise<{ success: boolean; diagrams?: any[]; error?: string }>;
        analyze: (filePath: string) => Promise<{ success: boolean; analysis?: any; validation?: any; error?: string }>;
      };
      sidecar: {
        start: () => Promise<{ success: boolean; baseUrl?: string; error?: string }>;
        stop: () => Promise<void>;
        status: () => Promise<{ status: 'stopped' | 'starting' | 'running' | 'error' | 'stopping'; baseUrl: string | null }>;
        health: () => Promise<{ healthy: boolean }>;
        generateEntity: (request: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        assistStream: (request: any) => Promise<{ success: boolean; streamId?: string; error?: string }>;
        cancelStream: (streamId: string) => Promise<void>;
        executeTool: (request: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        ragQuery: (request: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        onStreamToken: (listener: (payload: { streamId: string; token: string }) => void) => (() => void);
        onStreamComplete: (listener: (payload: { streamId: string; fullContent: string }) => void) => (() => void);
        onStreamError: (listener: (payload: { streamId: string; error: string }) => void) => (() => void);
      };
      contextKit: {
        status: () => Promise<{ running: boolean; healthy: boolean; port: number; uptime?: number; lastError?: string }>;
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        inspect: (repoPath: string, includeTypes?: string[], depth?: number) => Promise<{ success: boolean; data?: any; error?: string }>;
        specGenerate: (repoPath: string, entityIds: string[], userPrompt: string, templateId?: string, includeRag?: boolean) => Promise<{ success: boolean; data?: any; error?: string }>;
        promptify: (repoPath: string, specId: string, specContent?: string, targetAgent?: string, includeContext?: boolean) => Promise<{ success: boolean; data?: any; error?: string }>;
        codegen: (repoPath: string, specId: string, prompt?: string, language?: string, framework?: string, styleGuide?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      };
      app: {
        getDefaultRepoPath: () => Promise<{ ok: boolean; path?: string; error?: string }>;
      };
    };
  }

  interface RepoRegistryEntry {
    id: string;
    label: string;
    path: string;
    createdAt: string;
    lastUsed: string;
    autoDetected?: boolean;
  }

  interface RepoRegistryPayload {
    activeRepoId: string | null;
    repos: RepoRegistryEntry[];
  }

  interface RepoRegistryResponse {
    ok: boolean;
    registry?: RepoRegistryPayload;
    error?: string;
  }
}
