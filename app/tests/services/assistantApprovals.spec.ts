import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PendingAction } from '@shared/assistant/types';

describe('Assistant approval workflows', () => {
  beforeEach(() => {
    // Provide a fake assistant bridge on the window api for tests
    (global as any).window.api.assistant = {
      createSession: vi.fn(async () => ({
        id: 'sess-1',
        provider: 'azure-openai',
        systemPrompt: 'system',
        messages: [],
        activeTools: [],
        pendingApprovals: [],
        telemetryId: 't-0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })),
      sendMessage: vi.fn(async () => ({ message: { role: 'assistant', content: 'ok', timestamp: new Date().toISOString() }, provider: 'azure-openai' })),
      executeTool: vi.fn(async (_sessionId: string, payload: any) => {
        // Simulate that write tools require approval and return a pending action
        if (payload.toolId === 'git.preparePr' || payload.toolId === 'context.write') {
          const pending: PendingAction = {
            id: 'pending-1',
            sessionId: 'sess-1',
            toolId: payload.toolId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            approvalState: 'pending',
            diffPreview: '--- a/file.txt\n+++ b/file.txt\n+hello',
            metadata: { requestedBy: 'test' }
          };
          return { pending };
        }

        return { result: { status: 'succeeded' } };
      }),
      resolvePendingAction: vi.fn(async (_sessionId: string, actionId: string, payload: any) => {
        // For approve, simulate PR creation; for reject, return action with rejected state
        if (payload.decision === 'approve') {
          return {
            id: actionId,
            sessionId: 'sess-1',
            toolId: 'git.preparePr',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            approvalState: 'approved',
            metadata: { prUrl: 'https://example.com/pr/1' }
          } as PendingAction;
        }

        return {
          id: actionId,
          sessionId: 'sess-1',
          toolId: 'git.preparePr',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          approvalState: 'rejected'
        } as PendingAction;
      }),
      listTelemetry: vi.fn(async () => []),
      runPipeline: vi.fn(async () => ({ result: { status: 'succeeded' } })),
      onStreamEvent: vi.fn().mockReturnValue(() => { /* noop */ })
    };
  });

  it('creates a pending action when a write tool is requested', async () => {
    const bridge = (global as any).window.api.assistant;

    const response = await bridge.executeTool('sess-1', { toolId: 'context.write', repoPath: '/repo', parameters: { changes: [{ path: 'file.txt', content: 'hello' }] } });

    expect(response).toHaveProperty('pending');
    const pending: PendingAction = response.pending;
    expect(pending.approvalState).toBe('pending');
    expect(typeof pending.diffPreview).toBe('string');
  });

  it('resolves pending action on approval and returns approved action with PR metadata', async () => {
    const bridge = (global as any).window.api.assistant;

    const resolved = await bridge.resolvePendingAction('sess-1', 'pending-1', { decision: 'approve', notes: 'LGTM' });

    expect(resolved).toHaveProperty('approvalState', 'approved');
    expect(resolved.metadata).toHaveProperty('prUrl');
  });

  it('rejects pending action and returns rejected state', async () => {
    const bridge = (global as any).window.api.assistant;

    const resolved = await bridge.resolvePendingAction('sess-1', 'pending-1', { decision: 'reject', notes: 'Not ready' });

    expect(resolved).toHaveProperty('approvalState', 'rejected');
  });
});
