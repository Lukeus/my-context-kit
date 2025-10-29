import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';
import type { PendingAction } from '@shared/assistant/types';

describe('assistantStore pending approvals', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    // Provide a fake assistant bridge on the window api for tests
    (global as any).window.api = (global as any).window.api || {};
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
      resolvePendingAction: vi.fn(async (_sessionId: string, actionId: string, payload: any) => {
        if (payload.decision === 'approve') {
          return { id: actionId, sessionId: 'sess-1', toolId: 'git.preparePr', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), approvalState: 'approved', metadata: { prUrl: 'https://example.com/pr/1' } } as PendingAction;
        }
        return { id: actionId, sessionId: 'sess-1', toolId: 'git.preparePr', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), approvalState: 'rejected' } as PendingAction;
      }),
      listTelemetry: vi.fn(async () => [])
    };
  });

  it('can add and open a pending approval', () => {
    const store = useAssistantStore();
    const pending: PendingAction = {
      id: 'p-1',
      sessionId: 'sess-1',
      toolId: 'context.write',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      approvalState: 'pending',
      diffPreview: '--- a/file\n+++ b/file\n+hello',
      metadata: { requestedBy: 'test' }
    };

    expect(store.pendingCount).toBe(0);
    store.addPendingLocally(pending);
    expect(store.pendingCount).toBe(1);

    store.openPendingApproval('p-1');
    expect(store.activePendingId).toBe('p-1');
    expect(store.activePending?.id).toBe('p-1');
  });

  it('approves a pending action via the bridge', async () => {
    const store = useAssistantStore();
    // create a session so resolvePendingAction has an active session
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });
    const pending: PendingAction = {
      id: 'p-2',
      sessionId: 'sess-1',
      toolId: 'git.preparePr',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      approvalState: 'pending'
    };

    store.addPendingLocally(pending);
    const resolved = await store.approvePending('p-2', 'LGTM');
    expect(resolved.approvalState).toBe('approved');
    expect(resolved.metadata).toHaveProperty('prUrl');
    // store should remove the pending since approvalState !== 'pending'
    expect(store.getPendingById('p-2')).toBeUndefined();
  });

  it('rejects a pending action via the bridge', async () => {
    const store = useAssistantStore();
    // create a session so resolvePendingAction has an active session
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });
    const pending: PendingAction = {
      id: 'p-3',
      sessionId: 'sess-1',
      toolId: 'git.preparePr',
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      approvalState: 'pending'
    };

    store.addPendingLocally(pending);
    const resolved = await store.rejectPending('p-3', 'Not ready');
    expect(resolved.approvalState).toBe('rejected');
    expect(store.getPendingById('p-3')).toBeUndefined();
  });
});
