import { randomUUID } from 'node:crypto';
import type {
  AssistantProvider,
  ToolDescriptor,
  TaskEnvelope,
  AssistantSessionExtended
} from '@shared/assistant/types';
import {
  ConversationManager,
  type AppendUserTurnPayload,
  type ProviderAssistantMessage
} from './conversationManager';
import { loadProviderConfiguration } from './providerConfig';
import { createLangChainClient, type ProviderConfig } from '../../renderer/services/langchain/client'; // NOTE: relies on shared code path via bundler alias
import { resolveLangChainConfig } from '../../renderer/services/langchain/config';
import { resolveRepositoryPaths } from '../ipc/handlers/path-resolution.handlers';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LangChainAIService } from '../services/LangChainAIService';

// Phase 3 T009 Refactor: Integrate LangChain orchestration.
// Responsibilities added:
// - Bootstrap remote session via /assistant/sessions
// - Post messages via /assistant/sessions/{id}/messages returning TaskEnvelope
// - Track task envelopes inside extended session (AssistantSessionExtended)
// - Defer streaming to preload bridge (TODO: integrate SSE for T012/T013 requirements)

type CreateSessionOptions = {
  provider: AssistantProvider;
  systemPrompt: string;
  activeTools?: string[];
};

type SessionRecord = AssistantSessionExtended;

/**
 * Load sidecar configuration from config file.
 * Falls back to defaults if file doesn't exist.
 */
async function getSidecarConfig(repoPath?: string): Promise<ProviderConfig | null> {
  try {
    // Get default repo path if not provided
    if (!repoPath) {
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'default-repo-path.txt');
      try {
        repoPath = await fs.readFile(configPath, 'utf-8').then(p => p.trim());
      } catch {
        console.log('[getSidecarConfig] No default repo path configured');
        return null;
      }
    }

    // repoPath is guaranteed to be defined here if we got past the check above
    if (!repoPath) return null;
    
    // Try to read sidecar config
    // Config is stored in context-repo/.context-kit/sidecar-config.json
    const configFilePath = path.join(repoPath, '.context-kit', 'sidecar-config.json');
    try {
      const configContent = await fs.readFile(configFilePath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // Get API key from secure storage if needed
      let apiKey: string | undefined;
      if (config.provider === 'azure-openai') {
        try {
          const aiService = new LangChainAIService();
          const credKey = 'sidecar-' + config.provider;
          const hasKey = await aiService.hasCredentials(credKey);
          if (hasKey) {
            apiKey = await aiService.getStoredCredentials(credKey) || undefined;
            console.log('[getSidecarConfig] Retrieved API key from secure storage');
          } else {
            console.warn('[getSidecarConfig] No API key found in secure storage for', credKey);
          }
        } catch (err) {
          console.error('[getSidecarConfig] Failed to retrieve API key:', err);
        }
      }
      
      return {
        provider: config.provider || 'ollama',
        endpoint: config.endpoint || 'http://localhost:11434',
        model: config.model || 'llama2',
        apiKey,
        apiVersion: config.apiVersion || '2024-02-15-preview',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens,
      };
    } catch (err) {
      console.log('[getSidecarConfig] No sidecar config file, will use defaults');
      return null;
    }
  } catch (err) {
    console.error('[getSidecarConfig] Failed to load sidecar config:', err);
    return null;
  }
}

export class AssistantSessionManager {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly conversationManager = new ConversationManager();

  async createSession(options: CreateSessionOptions): Promise<AssistantSessionExtended> {
    const config = loadProviderConfiguration();
    const providerSettings = config.providers[options.provider];
    if (!providerSettings) {
      throw new Error(`Assistant provider ${options.provider} is not configured.`);
    }

    const allowedTools = providerSettings.tools;
    const activeTools = this.resolveActiveTools(allowedTools, options.activeTools);
    const seededConversation = this.conversationManager.initialiseConversation({
      provider: options.provider,
      systemPrompt: options.systemPrompt,
      activeTools
    });
    const now = new Date().toISOString();

    // Resolve repository paths for provenance using direct service call
    const pathResolution = await resolveRepositoryPaths({ includeSpecPaths: true });
    const repoRoot: string | undefined = pathResolution.repoRoot;
    const featureBranch: string | undefined = pathResolution.currentBranch || undefined;
    const specificationPath: string | undefined = pathResolution.specPaths?.spec || undefined;

    // Get sidecar configuration from context-repo directory
    const contextRepoPath = pathResolution.contextDir;
    const sidecarConfig = await getSidecarConfig(contextRepoPath);
    console.log('[assistantSessionManager] Loaded sidecar config from', contextRepoPath, ':', sidecarConfig ? 'found' : 'not found');
    
    // Create remote LangChain session
    const lcConfig = resolveLangChainConfig();
    const client = createLangChainClient(lcConfig.baseUrl);
    let langchainSessionId: string | null = null;
    let capabilityFlags = {} as Record<string, any>;
    try {
      console.log('[assistantSessionManager] Creating LangChain session with payload:', {
        userId: 'local-user',
        clientVersion: lcConfig.telemetryDefaults.appVersion,
        provider: options.provider,
        systemPrompt: options.systemPrompt?.substring(0, 100),
        activeTools: options.activeTools,
        hasConfig: !!sidecarConfig
      });
      
      const remote = await client.createSession({
        userId: 'local-user',
        clientVersion: lcConfig.telemetryDefaults.appVersion,
        provider: options.provider,
        systemPrompt: options.systemPrompt,
        activeTools: options.activeTools,
        config: sidecarConfig || undefined
      });
      langchainSessionId = remote.sessionId;
      if (remote.capabilityProfile?.capabilities) {
        capabilityFlags = remote.capabilityProfile.capabilities;
      }
    } catch (err) {
      console.error('[assistantSessionManager] Failed to create remote session:', err);
      // Non-fatal: allow local session creation while remote unavailable
      // TODO(RemoteFallback): surface health indicator to store
    }

    // Use the LangChain session ID as the primary session ID for consistency
    // If LangChain service is unavailable, fall back to a local UUID
    const sessionId = langchainSessionId ?? randomUUID();
    console.log('[assistantSessionManager] Using session ID:', sessionId, '(from LangChain:', langchainSessionId, ')');

    const session: AssistantSessionExtended = {
      id: sessionId,
      provider: options.provider,
      systemPrompt: options.systemPrompt,
      messages: seededConversation,
      activeTools,
      pendingApprovals: [],
      telemetryId: randomUUID(),
      createdAt: now,
      updatedAt: now,
      capabilityProfile: undefined,
      telemetryContext: {
        repoRoot,
        featureBranch,
        specificationPath,
        langchainSessionId
      },
      capabilityFlags,
      tasks: []
    };

    this.sessions.set(session.id, session);
    console.log('[assistantSessionManager] Session stored with ID:', session.id, 'Total sessions:', this.sessions.size);
    return session;
  }

  getSession(sessionId: string): AssistantSessionExtended | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updater: (session: AssistantSessionExtended) => AssistantSessionExtended): AssistantSessionExtended {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new Error(`Assistant session ${sessionId} not found.`);
    }

    const updated = updater(existing);
    this.sessions.set(sessionId, updated);
    return updated;
  }

  appendUserTurn(sessionId: string, payload: AppendUserTurnPayload): AssistantSessionExtended {
    return this.updateSession(sessionId, session => {
      const nextConversation = this.conversationManager.appendUserTurn(session.messages, payload);
      return {
        ...session,
        messages: nextConversation,
        updatedAt: new Date().toISOString()
      };
    });
  }

  appendAssistantResponse(sessionId: string, payload: ProviderAssistantMessage): AssistantSessionExtended {
    return this.updateSession(sessionId, session => {
      const nextConversation = this.conversationManager.appendAssistantResponse(session.messages, payload);
      return {
        ...session,
        messages: nextConversation,
        updatedAt: new Date().toISOString()
      };
    });
  }

  // Post a user message to LangChain orchestrator and attach returned TaskEnvelope
  async dispatchMessage(sessionId: string, content: string, mode: 'general' | 'improvement' | 'clarification'): Promise<TaskEnvelope | null> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    const lcId = session.telemetryContext?.langchainSessionId as string | undefined;
    if (!lcId) {
      // No remote session; append locally only
      this.appendUserTurn(sessionId, { content });
      return null;
    }
    this.appendUserTurn(sessionId, { content, metadata: { mode } });
    const client = createLangChainClient(resolveLangChainConfig().baseUrl);
    try {
      const response = await client.postMessage(lcId, { content, mode });
      console.log('[assistantSessionManager] Received response from LangChain:', response);
      
      // The response might be wrapped in { task: TaskEnvelope } structure
      const envelope = (response as any).task || response;
      console.log('[assistantSessionManager] Extracted envelope:', envelope);
      
      this.updateSession(sessionId, current => ({
        ...current,
        tasks: [...(current.tasks || []), envelope],
        updatedAt: new Date().toISOString()
      }));
      return envelope;
    } catch {
      // TODO(DispatchError): Surface failure to UI + telemetry
      return null;
    }
  }

  // TODO(StreamIntegration T012/T013): integrate SSE via preload to update task envelopes incrementally.

  private resolveActiveTools(allTools: ToolDescriptor[], requested?: string[]): ToolDescriptor[] {
    if (!requested || requested.length === 0) {
      return allTools;
    }
    const requestedSet = new Set(requested);
    const filtered = allTools.filter(tool => requestedSet.has(tool.id));
    if (filtered.length === 0) {
      throw new Error('Requested active tools are not enabled for this provider.');
    }
    return filtered;
  }
}

// Note: Session persistence requires defining storage strategy (file-based vs. SQLite).
// Current in-memory sessions reset on app restart, which is acceptable for MVP workflows.
