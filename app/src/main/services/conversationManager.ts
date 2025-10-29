import type { AssistantProvider, ConversationTurn, ToolDescriptor } from '@shared/assistant/types';

export type ConversationManagerOptions = {
  clock?: () => Date;
};

export type InitialiseConversationOptions = {
  provider: AssistantProvider;
  systemPrompt: string;
  activeTools?: ToolDescriptor[];
};

export type AppendUserTurnPayload = {
  content: string;
  metadata?: Record<string, unknown>;
};

export type ReferenceRange = {
  start: number;
  end: number;
};

export type ProviderReference = {
  path: string;
  title?: string;
  ranges?: ReferenceRange[];
};

export type ProviderUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ProviderAssistantMessage = {
  provider: AssistantProvider;
  content: string;
  finishReason: string;
  references?: ProviderReference[];
  usage?: ProviderUsage;
  metadata?: Record<string, unknown>;
};

export class ConversationManager {
  private readonly clock: () => Date;

  constructor(options: ConversationManagerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  initialiseConversation(options: InitialiseConversationOptions): ConversationTurn[] {
    const timestamp = this.timestamp();
    const systemMetadata: Record<string, unknown> = {
      provider: options.provider,
      kind: 'session.systemPrompt',
      timestamp
    };
    if (options.activeTools) {
      systemMetadata.activeTools = options.activeTools;
    }

    return [
      {
        role: 'system',
        content: options.systemPrompt,
        timestamp,
        metadata: systemMetadata
      }
    ];
  }

  appendUserTurn(history: ConversationTurn[], payload: AppendUserTurnPayload): ConversationTurn[] {
    const next = [...history];
    const timestamp = this.timestamp();
    next.push({
      role: 'user',
      content: payload.content,
      timestamp,
      metadata: {
        ...(payload.metadata ?? {}),
        timestamp
      }
    });
    return next;
  }

  appendAssistantResponse(history: ConversationTurn[], payload: ProviderAssistantMessage): ConversationTurn[] {
    this.ensureSeeded(history);
    const next = [...history];
    const timestamp = this.timestamp();

    const metadata: Record<string, unknown> = {
      provider: payload.provider,
      finishReason: payload.finishReason,
      timestamp
    };

    if (payload.references?.length) {
      metadata.references = payload.references.map(reference => ({
        path: reference.path,
        ...(reference.title ? { title: reference.title } : {}),
        ...(reference.ranges ? { ranges: reference.ranges.map(range => ({ start: range.start, end: range.end })) } : {})
      }));
    }

    if (payload.usage) {
      metadata.usage = { ...payload.usage };
    }

    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      metadata.additionalMetadata = { ...payload.metadata };
    }

    next.push({
      role: 'assistant',
      content: payload.content,
      timestamp,
      metadata
    });

    return next;
  }

  private ensureSeeded(history: ConversationTurn[]): void {
    if (history.length === 0 || history[0].role !== 'system') {
      throw new Error('Conversation history must start with a system prompt before appending assistant messages.');
    }
  }

  private timestamp(): string {
    return this.clock().toISOString();
  }
}
