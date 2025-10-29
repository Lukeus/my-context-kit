import { describe, it, expect } from 'vitest';
import type { ConversationTurn } from '@shared/assistant/types';
import { ConversationManager, type ProviderAssistantMessage } from '~main/services/conversationManager';

function buildBaseTimeline(manager: ConversationManager, systemPrompt: string): ConversationTurn[] {
  const base = manager.initialiseConversation({
    provider: 'azure-openai',
    systemPrompt,
    activeTools: []
  });

  return manager.appendUserTurn(base, {
    content: 'Summarise the active spec',
    metadata: {
      intent: 'context.read',
      attachments: ['docs/spec.md']
    }
  });
}

describe('ConversationManager', () => {
  it('normalises assistant responses so Azure and Ollama share role sequencing and metadata', () => {
    const timestamp = new Date('2025-10-28T18:45:00.000Z');
    const manager = new ConversationManager({ clock: () => timestamp });
    const baseTimeline = buildBaseTimeline(manager, 'You are a helpful context assistant.');

    const azureResponse: ProviderAssistantMessage = {
      provider: 'azure-openai',
      content: 'Here is a short summary of the spec with key changes.',
      finishReason: 'stop',
      references: [
        {
          path: 'docs/spec.md',
          title: 'AI Assistant Specification',
          ranges: [{ start: 1, end: 24 }]
        }
      ],
      usage: {
        promptTokens: 120,
        completionTokens: 42,
        totalTokens: 162
      }
    };

    const ollamaResponse: ProviderAssistantMessage = {
      provider: 'ollama',
      content: 'Here is a short summary of the spec with key changes.',
      finishReason: 'stop',
      references: [
        {
          path: 'docs/spec.md',
          title: 'AI Assistant Specification',
          ranges: [{ start: 1, end: 24 }]
        }
      ],
      usage: {
        promptTokens: 118,
        completionTokens: 40,
        totalTokens: 158
      }
    };

    const azureTimeline = manager.appendAssistantResponse(baseTimeline, azureResponse);
    const ollamaTimeline = manager.appendAssistantResponse(baseTimeline, ollamaResponse);

    const azureAssistantTurn = azureTimeline.at(-1);
    const ollamaAssistantTurn = ollamaTimeline.at(-1);

    expect(azureAssistantTurn?.role).toBe('assistant');
    expect(ollamaAssistantTurn?.role).toBe('assistant');

    expect(azureAssistantTurn?.content).toBe(ollamaAssistantTurn?.content);
    expect(azureAssistantTurn?.metadata).toEqual({
      provider: 'azure-openai',
      finishReason: 'stop',
      references: [
        {
          path: 'docs/spec.md',
          title: 'AI Assistant Specification',
          ranges: [{ start: 1, end: 24 }]
        }
      ],
      usage: {
        promptTokens: 120,
        completionTokens: 42,
        totalTokens: 162
      },
      timestamp: timestamp.toISOString()
    });

    expect(ollamaAssistantTurn?.metadata).toEqual({
      provider: 'ollama',
      finishReason: 'stop',
      references: [
        {
          path: 'docs/spec.md',
          title: 'AI Assistant Specification',
          ranges: [{ start: 1, end: 24 }]
        }
      ],
      usage: {
        promptTokens: 118,
        completionTokens: 40,
        totalTokens: 158
      },
      timestamp: timestamp.toISOString()
    });

    const azureRoles = azureTimeline.map(turn => turn.role);
    const ollamaRoles = ollamaTimeline.map(turn => turn.role);

    expect(azureRoles).toEqual(['system', 'user', 'assistant']);
    expect(ollamaRoles).toEqual(['system', 'user', 'assistant']);
  });
});
