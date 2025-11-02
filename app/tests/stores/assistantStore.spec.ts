import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';
import type { PendingAction } from '@shared/assistant/types';

// Mock the health module to provide fast polling for tests
vi.mock('@/services/langchain/health', async () => {
  const actual = await vi.importActual('@/services/langchain/health');
  return {
    ...actual,
    createHealthPoller: (options?: any) => {
      return new (actual as any).LangChainHealthPoller({
        ...options,
        intervalMs: 50, // Fast polling for tests
        initialDelayMs: 0 // No delay
      });
    }
  };
});

describe('assistantStore pending approvals', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    // Mock fetch for health polling to return healthy state by default
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy', latencyMs: 50 })
    }) as any;

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
        updatedAt: new Date().toISOString(),
        tasks: [],
        telemetryContext: {
          repoRoot: '/repo',
          featureBranch: 'main',
          specificationPath: 'specs/feature.md',
          langchainSessionId: 'lc-123'
        }
      })),
      sendMessage: vi.fn(async (_sessionId: string, payload: any) => {
        return {
          taskId: 'task-1',
          actionType: 'message.dispatch' as const,
          status: 'completed' as const,
          outputs: [{ summary: `Echo: ${payload.content}` }],
          timestamps: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          provenance: { cost: { estimated: 12 } }
        };
      }),
      resolvePendingAction: vi.fn(async (_sessionId: string, actionId: string, payload: any) => {
        if (payload.decision === 'approve') {
          return { id: actionId, sessionId: 'sess-1', toolId: 'git.preparePr', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), approvalState: 'approved', metadata: { prUrl: 'https://example.com/pr/1' } } as PendingAction;
        }
        return { id: actionId, sessionId: 'sess-1', toolId: 'git.preparePr', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), approvalState: 'rejected' } as PendingAction;
      }),
      listTelemetry: vi.fn(async () => [])
    };
  });

  afterEach(() => {
    // Clean up health polling to prevent leaked timers
    const store = useAssistantStore();
    store.stopHealthPolling();
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

  it('creates extended session with provenance & empty tasks', async () => {
    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });
    expect(store.session).not.toBeNull();
    expect(store.tasks.length).toBe(0);
    expect(store.provenance).toMatchObject({ repoRoot: '/repo', featureBranch: 'main', langchainSessionId: 'lc-123' });
  });

  it('adds task envelope on sendMessage', async () => {
    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });
    
    // Wait for health poll to complete (tests use 50ms interval)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const envelope = await store.sendMessage({ content: 'Hello world' });
    expect(envelope).not.toBeNull();
    expect(store.tasks.length).toBe(1);
    expect(store.tasks[0].outputs[0].summary).toContain('Echo: Hello world');
  });

  it('reset clears tasks and provenance', async () => {
    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });
    
    // Wait for health poll to complete (tests use 50ms interval)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await store.sendMessage({ content: 'Ping' });
    expect(store.tasks.length).toBe(1);
    store.reset();
    expect(store.tasks.length).toBe(0);
    expect(store.provenance).toBeNull();
  });
});

describe('assistantStore health transitions (T018)', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());

    // Mock fetch for health polling
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    // Provide a fake assistant bridge
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
        updatedAt: new Date().toISOString(),
        tasks: [],
        telemetryContext: {
          repoRoot: '/repo',
          featureBranch: 'main',
          specificationPath: 'specs/feature.md',
          langchainSessionId: 'lc-123'
        }
      })),
      sendMessage: vi.fn(async () => ({
        taskId: 'task-2',
        actionType: 'message.dispatch' as const,
        status: 'completed' as const,
        outputs: [{ summary: 'Response' }],
        timestamps: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        provenance: { cost: { estimated: 10 } }
      })),
      resolvePendingAction: vi.fn(async () => ({ id: 'p-1', approvalState: 'approved' } as PendingAction)),
      listTelemetry: vi.fn(async () => [])
    };
  });

  afterEach(() => {
    // Clean up health polling to prevent leaked timers
    const store = useAssistantStore();
    store.stopHealthPolling();
  });

  it('starts health polling on session creation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy', latencyMs: 50 })
    });

    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });

    // Wait for initial health poll
    await new Promise(resolve => setTimeout(resolve, 100));

    // Health should be initialized after session creation
    expect(store.health).not.toBeNull();
    expect(store.healthStatus).toBe('healthy');
  });

  it('blocks sendMessage when unhealthy', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable'
    });

    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });

    // Wait for health poll to detect unhealthy state
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(store.isUnhealthy).toBe(true);
    expect(store.canExecuteRisky).toBe(false);

    // Should throw when unhealthy
    await expect(store.sendMessage({ content: 'test' })).rejects.toThrow(/unavailable/);
  });

  it('allows operations when degraded', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'degraded', latencyMs: 500 })
    });

    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });

    // Wait for health poll
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(store.isDegraded).toBe(true);
    expect(store.canExecuteRisky).toBe(true);

    // Should succeed when degraded (slow but operational)
    const result = await store.sendMessage({ content: 'test' });
    expect(result).toBeDefined();
  });

  it('transitions health state on retry', async () => {
    let callCount = 0;
    let shouldFail = true; // Control when to transition
    
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (shouldFail) {
        // Return unhealthy until we explicitly change shouldFail
        return { ok: false, statusText: 'Service Unavailable' };
      }
      // Return healthy after transition
      return {
        ok: true,
        json: async () => ({ status: 'healthy', latencyMs: 30 })
      };
    });

    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });

    // Wait for poller to establish unhealthy state (at least 2 polls)
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should be unhealthy now
    expect(store.isUnhealthy).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(2);

    // Now switch to healthy responses
    shouldFail = false;
    
    // Retry health check - this restarts the poller with healthy endpoint
    store.retryHealth();
    
    // Wait for the new poll to complete and establish healthy state
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should transition to healthy
    expect(store.isHealthy).toBe(true);
    expect(callCount).toBeGreaterThan(2);
  });

  it('cleans up health polling on stopHealthPolling', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'healthy' })
    });

    const store = useAssistantStore();
    await store.createSession({ provider: 'azure-openai', systemPrompt: 'sys' });
    
    // Wait for initial poll
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(store.health).not.toBeNull();

    store.stopHealthPolling();
    expect(store.health).toBeNull();
  });
});
