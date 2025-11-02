import { ipcMain } from 'electron';
import type { AssistantPipelineName, AssistantProvider, AssistantSession } from '@shared/assistant/types';
import {
  ToolOrchestrator,
  type ExecuteToolOptions,
  type PipelineRunOptions,
  type PipelineRunResult,
  type ToolExecutionResult
} from '../../services/toolOrchestrator';
import { loadProviderConfiguration } from '../../services/providerConfig';
import { ContextService } from '../../services/ContextService';
import { createTelemetryWriter } from '../../services/telemetryWriter';
import { AssistantSessionManager } from '../../services/assistantSessionManager';
import { readContextFile } from '../../services/tools/readContextFile';
import { searchContextRepository } from '../../services/tools/searchContextRepository';
import { getEntityDetails } from '../../services/tools/getEntityDetails';
import { findSimilarEntities } from '../../services/tools/findSimilarEntities';
import { openPullRequest } from '../../services/tools/openPullRequest';
import { LangChainAIService } from '../../services/LangChainAIService';
import type { PendingAction } from '@shared/assistant/types';
import { broadcastAssistantStream } from '../streamingEmitter';

interface PipelineRunPayload {
  sessionId: string;
  repoPath: string;
  pipeline: AssistantPipelineName;
  args?: Record<string, unknown>;
}

const telemetryWriter = createTelemetryWriter();
const sessionManager = new AssistantSessionManager();
const orchestrator = new ToolOrchestrator({
  loadConfiguration: loadProviderConfiguration,
  runPipeline: runContextPipeline,
  readContextFile,
  searchContextRepository,
  getEntityDetails,
  findSimilarEntities,
  getAIConfig: async (repoPath: string) => {
    const service = new LangChainAIService();
    return service.getConfig(repoPath);
  },
  telemetryWriter,
});

export function registerAssistantHandlers(): void {
  ipcMain.handle('assistant:createSession', async (_event, payload: { provider: AssistantProvider; systemPrompt: string; activeTools?: string[] }) => {
    // Returns extended session including telemetry context and tasks list
    const session = await sessionManager.createSession(payload);
    return session;
  });

  ipcMain.handle('assistant:pipelineRun', async (_event, payload: PipelineRunPayload) => {
    const session = sessionManager.getSession(payload.sessionId);
    if (!session) {
      throw new Error('Assistant session not found. Create a session before running pipelines.');
    }

    const execution = await orchestrator.executeTool(toExecuteToolOptions(session.id, session.provider, payload));

    sessionManager.updateSession(session.id, current => ({
      ...current,
      updatedAt: new Date().toISOString()
    }));

    if (!execution.ok) {
      throw new Error(execution.error ?? 'Pipeline execution failed.');
    }

    return {
      result: execution.result ?? null,
      pending: null,
      telemetryId: execution.telemetry?.id ?? null
    };
  });

  ipcMain.handle('assistant:listTelemetry', async (_event, payload: { sessionId: string }) => {
    const records = await telemetryWriter.getRecordsForSession(payload.sessionId);
    return records;
  });

  ipcMain.handle('assistant:executeTool', async (_event, payload: { sessionId: string; toolId: string; repoPath: string; parameters?: Record<string, unknown> }) => {
    const session = sessionManager.getSession(payload.sessionId);
    if (!session) {
      throw new Error('Assistant session not found. Create a session before executing tools.');
    }

    if (!payload.repoPath || typeof payload.repoPath !== 'string') {
      throw new Error('Repository path is required to execute tools.');
    }

    const activeTool = session.activeTools.find(tool => tool.id === payload.toolId);
    if (!activeTool) {
      throw new Error(`Tool ${payload.toolId} is not active for the current session.`);
    }

    const parameters = payload.parameters ?? {};
    const options: ExecuteToolOptions = {
      sessionId: session.id,
      provider: session.provider,
      toolId: payload.toolId,
      repoPath: payload.repoPath,
      parameters
    };

    if (payload.toolId === 'context.read') {
      return executeContextReadTool(session, options, parameters);
    }

    const execution = await orchestrator.executeTool(options);
    const updatedSession = sessionManager.updateSession(session.id, current => ({
      ...current,
      updatedAt: new Date().toISOString()
    }));

    if (!execution.ok) {
      throw new Error(execution.error ?? 'Tool execution failed.');
    }

    return {
      result: execution.result ?? null,
      pending: null,
      telemetryId: execution.telemetry?.id ?? null,
      error: undefined,
      conversation: updatedSession.messages,
      session: updatedSession
    };
  });

  ipcMain.handle('assistant:sendMessage', async (_event, payload: { sessionId: string; content: string; mode?: 'general' | 'improvement' | 'clarification' }) => {
    const { sessionId, content, mode = 'general' } = payload;
    const envelope = await sessionManager.dispatchMessage(sessionId, content, mode);
    return envelope; // TaskEnvelope | null (null when remote session unavailable)
  });

  // Streaming placeholders (T010): will connect to LangChain SSE in T012/T013
  ipcMain.handle('assistant:task:startStream', async (_event, payload: { sessionId: string; taskId: string }) => {
    // TODO(StreamStart): Initiate SSE subscription for taskId and forward chunks via assistant:task:stream-event
    return { ok: false, error: 'Streaming not yet implemented', taskId: payload.taskId };
  });
  ipcMain.handle('assistant:task:cancelStream', async (_event, payload: { sessionId: string; taskId: string }) => {
    // TODO(StreamCancel): Cancel SSE subscription
    return { ok: false, error: 'Streaming cancellation not yet implemented', taskId: payload.taskId };
  });

  ipcMain.handle('assistant:resolvePendingAction', async (_event, payload: { sessionId: string; actionId: string; decision: 'approve' | 'reject'; notes?: string }) => {
    const { sessionId, actionId, decision, notes } = payload;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Assistant session not found.');
    }

    const pending = session.pendingApprovals.find(p => p.id === actionId);
    if (!pending) {
      throw new Error(`Pending action ${actionId} not found.`);
    }

    let updated: PendingAction = { ...pending };

    try {
      if (decision === 'approve') {
        // If metadata includes changes and a repoPath, attempt to prepare a PR
        const changes = Array.isArray(pending.metadata?.changes) ? (pending.metadata!.changes as Array<{ path: string; content: string }>) : [];
        const repoPath = typeof pending.metadata?.repoPath === 'string' ? (pending.metadata!.repoPath as string) : '';

        let prResult: Record<string, unknown> | null = null;
        if (changes.length > 0 && repoPath) {
          const prResponse = await openPullRequest({ repoPath, title: notes ?? 'Assistant proposed change', body: '', changes });
          prResult = prResponse.result ?? null;
        }

        updated = {
          ...pending,
          approvalState: 'approved',
          metadata: {
            ...(pending.metadata ?? {}),
            ...(prResult ? { pr: prResult } : {}),
            approvedBy: 'user',
            notes: notes ?? null
          }
        };

        // record telemetry for approval
        try {
          await telemetryWriter.recordApproval(sessionId, actionId, 'approved', updated.metadata as Record<string, unknown> | undefined);
        } catch {
          // swallow telemetry errors
        }
      } else {
        // reject
        updated = {
          ...pending,
          approvalState: 'rejected',
          metadata: {
            ...(pending.metadata ?? {}),
            approvedBy: 'user',
            notes: notes ?? null
          }
        };

        try {
          await telemetryWriter.recordApproval(sessionId, actionId, 'rejected', updated.metadata as Record<string, unknown> | undefined);
        } catch {
          // swallow
        }
      }

      // Update session pending approvals (remove resolved ones)
      sessionManager.updateSession(sessionId, current => ({
        ...current,
        pendingApprovals: current.pendingApprovals.filter(p => p.id !== actionId),
        updatedAt: new Date().toISOString()
      }));

      return updated;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve pending action.';
      throw new Error(message);
    }
  });
}

function toExecuteToolOptions(sessionId: string, provider: AssistantProvider, payload: PipelineRunPayload): ExecuteToolOptions {
  return {
    sessionId,
    provider,
    toolId: 'pipeline.run',
    repoPath: payload.repoPath,
    parameters: {
      pipeline: payload.pipeline,
      ...(payload.args ? { args: payload.args } : {})
    }
  };
}

async function runContextPipeline(options: PipelineRunOptions): Promise<PipelineRunResult> {
  const service = new ContextService(options.repoPath);

  try {
    switch (options.pipeline) {
      case 'validate':
        return await runValidatePipeline(service);
      case 'build-graph':
        return await runBuildGraphPipeline(service);
      case 'impact':
        return await runImpactPipeline(service, options.args);
      case 'generate':
        return await runGeneratePipeline(service, options.args);
      default:
        throw new Error(`Unsupported pipeline ${options.pipeline}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pipeline execution failed.';
    return {
      status: 'failed',
      error: message
    };
  }
}

async function runValidatePipeline(service: ContextService): Promise<PipelineRunResult> {
  const result = await service.validate();
  const succeeded = result.ok !== false;
  return {
    status: succeeded ? 'succeeded' : 'failed',
    output: result,
    error: succeeded ? undefined : result.error ?? 'Validation pipeline reported failures.'
  };
}

async function runBuildGraphPipeline(service: ContextService): Promise<PipelineRunResult> {
  const result = await service.buildGraph();
  const succeeded = result.ok !== false && !result.error;
  return {
    status: succeeded ? 'succeeded' : 'failed',
    output: result,
    error: succeeded ? undefined : result.error ?? 'Graph pipeline reported failures.'
  };
}

async function runImpactPipeline(service: ContextService, args?: Record<string, unknown>): Promise<PipelineRunResult> {
  const changedIds = extractStringArray(args, 'changedIds');
  if (changedIds.length === 0) {
    throw new Error('Impact pipeline requires one or more changedIds.');
  }
  const result = await service.calculateImpact(changedIds);
  const succeeded = result.ok !== false;
  return {
    status: succeeded ? 'succeeded' : 'failed',
    output: result,
    error: succeeded ? undefined : result.error ?? 'Impact pipeline reported failures.'
  };
}

async function runGeneratePipeline(service: ContextService, args?: Record<string, unknown>): Promise<PipelineRunResult> {
  const ids = extractStringArray(args, 'ids');
  if (ids.length === 0) {
    throw new Error('Generate pipeline requires one or more ids.');
  }
  const result = await service.generate(ids);
  const succeeded = result.ok !== false;
  return {
    status: succeeded ? 'succeeded' : 'failed',
    output: result,
    artifacts: result.generated ?? [],
    error: succeeded ? undefined : result.error ?? 'Generate pipeline reported failures.'
  };
}

function extractStringArray(args: Record<string, unknown> | undefined, key: string): string[] {
  if (!args) {
    return [];
  }

  const raw = args[key];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.split(',').map(item => item.trim()).filter(Boolean);
  }

  return [];
}

async function executeContextReadTool(session: AssistantSession, options: ExecuteToolOptions, parameters: Record<string, unknown>) {
  const repoPath = options.repoPath;
  const requestPath = typeof parameters.path === 'string' ? parameters.path.trim() : '';
  const userMetadata: Record<string, unknown> = {
    intent: 'context.read',
    path: requestPath || null,
    repoPath,
    toolId: options.toolId
  };

  let workingSession = sessionManager.appendUserTurn(session.id, {
    content: describeContextReadRequest(requestPath),
    metadata: userMetadata
  });

  let execution: ToolExecutionResult | null = null;

  try {
    execution = await orchestrator.executeTool(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Context read failed.';
    workingSession = sessionManager.appendAssistantResponse(session.id, {
      provider: session.provider,
      content: `Context read failed: ${message}`,
      finishReason: 'error',
      metadata: {
        toolId: options.toolId,
        error: message
      }
    });

    return {
      result: null,
      pending: null,
      telemetryId: null,
      error: message,
      conversation: workingSession.messages,
      session: workingSession
    };
  }

  if (!execution) {
    return {
      result: null,
      pending: null,
      telemetryId: null,
      error: 'Context read did not return a result.',
      conversation: workingSession.messages,
      session: workingSession
    };
  }

  const resultPayload = (execution.result ?? {}) as Record<string, unknown>;
  const repoRelativePath = typeof resultPayload.repoRelativePath === 'string'
    ? (resultPayload.repoRelativePath as string)
    : requestPath;
  const size = typeof resultPayload.size === 'number' ? (resultPayload.size as number) : undefined;
  const truncated = Boolean(resultPayload.truncated);
  const encoding = typeof resultPayload.encoding === 'string' ? (resultPayload.encoding as string) : undefined;
  const summary = execution.ok
    ? describeContextReadSuccess(repoRelativePath, size, truncated)
    : `Context read failed: ${execution.error ?? 'Unknown error.'}`;

  // Stream partial assistant messages (simulate token stream)
  try {
    const chunks = summary.match(/(.|[\r\n]){1,120}/g) ?? [summary];
    for (const chunk of chunks) {
      broadcastAssistantStream({ type: 'assistant.chunk', sessionId: session.id, content: chunk, partial: true });
      // small delay to simulate streaming; non-blocking in main process
      await new Promise(resolve => setTimeout(resolve, 8));
    }
  } catch {
    // ignore streaming failures
  }

  workingSession = sessionManager.appendAssistantResponse(session.id, {
    provider: session.provider,
    content: summary,
    finishReason: execution.ok ? 'stop' : 'error',
    references: repoRelativePath ? [{ path: repoRelativePath }] : undefined,
    metadata: {
      toolId: options.toolId,
      repoPath,
      size,
      encoding,
      truncated,
      ...(execution.ok ? {} : { error: execution.error ?? 'Unknown error.' })
    }
  });

  return {
    result: execution.result ?? null,
    pending: null,
    telemetryId: execution.telemetry?.id ?? null,
    error: execution.ok ? undefined : execution.error ?? 'Context read failed.',
    conversation: workingSession.messages,
    session: workingSession
  };
}

function describeContextReadRequest(path: string): string {
  if (!path) {
    return 'Requesting repository context read (no path specified).';
  }
  return `Requesting repository context for ${path}.`;
}

function describeContextReadSuccess(path: string | undefined, size: number | undefined, truncated: boolean): string {
  const location = path && path.length > 0 ? path : 'requested file';
  const sizeText = typeof size === 'number' ? formatByteSize(size) : 'unknown size';
  const suffix = truncated ? ' (preview truncated).' : '.';
  return `Provided ${location} (${sizeText})${suffix}`;
}

function formatByteSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

// Note: Streaming conversation support is available via assistant:stream-event channel.
// Full provider adapter streaming is pending Azure OpenAI streaming integration.
