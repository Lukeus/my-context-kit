import { describe, expect, it } from 'vitest';
import { exportSession } from '@/services/assistant/exporter';
import type {
  AssistantSessionExtended,
  ToolDescriptor
} from '@shared/assistant/types';

function createMockTool(id: string, title: string): ToolDescriptor {
  return {
    id,
    title,
    description: `${title} description`,
    capability: 'read',
    requiresApproval: false,
    allowedProviders: ['azure-openai'],
    inputSchema: {},
    outputSchema: {}
  };
}

describe('exportSession JSON schema (FR-019)', () => {
  it('emits canonical message field ordering and optional metadata', () => {
    const createdAt = new Date('2025-11-01T10:00:00Z').toISOString();
    const updatedAt = new Date('2025-11-01T10:05:00Z').toISOString();

    const session: AssistantSessionExtended = {
      id: 'session-001',
      provider: 'azure-openai',
      systemPrompt: 'Be helpful and safe.',
      messages: [
        {
          role: 'user',
          content: 'Summarize repo status.',
          timestamp: createdAt,
          metadata: {
            id: 'msg-user-001',
            safetyClass: 'readOnly',
            approvals: []
          }
        },
        {
          role: 'assistant',
          content: 'Repository is healthy.',
          timestamp: updatedAt,
          metadata: {
            id: 'msg-assistant-001',
            safetyClass: 'readOnly',
            tool: {
              id: 'context.read',
              title: 'Read Context'
            },
            approvals: [
              {
                toolId: 'context.read',
                status: 'approved'
              }
            ]
          }
        }
      ],
      activeTools: [createMockTool('context.read', 'Read Context')],
      pendingApprovals: [],
      telemetryId: 'telemetry-001',
      createdAt,
      updatedAt,
      capabilityProfile: undefined,
      telemetryContext: undefined,
      capabilityFlags: undefined,
      tasks: []
    };

    const json = exportSession(session, undefined, undefined, {
      format: 'json',
      includeMetadata: true,
      includeSystemPrompt: true,
      includeApprovals: true,
      includeTelemetry: false,
      sanitize: false
    });

    const parsed = JSON.parse(json) as {
      version: string;
      exportedAt: string;
      session: {
        messages: Array<Record<string, unknown>>;
        systemPrompt: string;
      };
    };

    expect(parsed.version).toBe('1.0.0');
    expect(parsed.session.systemPrompt).toBe(session.systemPrompt);

    const [userMessage, assistantMessage] = parsed.session.messages;
    expect(Object.keys(userMessage)).toEqual([
      'id',
      'role',
      'content',
      'createdAt',
      'safetyClass',
      'toolMeta',
      'approvals'
    ]);

    expect(Object.keys(assistantMessage)).toEqual([
      'id',
      'role',
      'content',
      'createdAt',
      'safetyClass',
      'toolMeta',
      'approvals'
    ]);

    expect(userMessage.safetyClass).toBe('readOnly');
    expect(userMessage.toolMeta).toBeNull();
    expect(Array.isArray(userMessage.approvals)).toBe(true);
    expect(assistantMessage.toolMeta).toMatchObject({ id: 'context.read' });
    expect(Array.isArray(assistantMessage.approvals)).toBe(true);
  });
});
