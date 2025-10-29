import { randomUUID } from 'node:crypto';
import type {
  AssistantProvider,
  AssistantSession,
  ToolDescriptor
} from '@shared/assistant/types';
import {
  ConversationManager,
  type AppendUserTurnPayload,
  type ProviderAssistantMessage
} from './conversationManager';
import { loadProviderConfiguration } from './providerConfig';

type CreateSessionOptions = {
  provider: AssistantProvider;
  systemPrompt: string;
  activeTools?: string[];
};

type SessionRecord = AssistantSession;

export class AssistantSessionManager {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly conversationManager = new ConversationManager();

  createSession(options: CreateSessionOptions): AssistantSession {
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

    const session: AssistantSession = {
      id: randomUUID(),
      provider: options.provider,
      systemPrompt: options.systemPrompt,
      messages: seededConversation,
      activeTools,
      pendingApprovals: [],
      telemetryId: randomUUID(),
      createdAt: now,
      updatedAt: now
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): AssistantSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updater: (session: AssistantSession) => AssistantSession): AssistantSession {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new Error(`Assistant session ${sessionId} not found.`);
    }

    const updated = updater(existing);
    this.sessions.set(sessionId, updated);
    return updated;
  }

  appendUserTurn(sessionId: string, payload: AppendUserTurnPayload): AssistantSession {
    return this.updateSession(sessionId, session => {
      const nextConversation = this.conversationManager.appendUserTurn(session.messages, payload);
      return {
        ...session,
        messages: nextConversation,
        updatedAt: new Date().toISOString()
      };
    });
  }

  appendAssistantResponse(sessionId: string, payload: ProviderAssistantMessage): AssistantSession {
    return this.updateSession(sessionId, session => {
      const nextConversation = this.conversationManager.appendAssistantResponse(session.messages, payload);
      return {
        ...session,
        messages: nextConversation,
        updatedAt: new Date().toISOString()
      };
    });
  }

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

// TODO: Persist session metadata so renderer can resume previous assistant runs after a restart.
