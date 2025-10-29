import type {
  AssistantPipelineName,
  AssistantProvider,
  ProviderConfigurationResult,
  ToolDescriptor,
  ToolInvocationRecord,
  ToolInvocationStatus
} from '@shared/assistant/types';
import type { ReadContextFileOptions, ReadContextFileResult } from './tools/readContextFile';

export interface PipelineRunOptions {
  repoPath: string;
  pipeline: AssistantPipelineName;
  args?: Record<string, unknown>;
}

export interface PipelineRunResult {
  status: 'succeeded' | 'failed';
  artifacts?: string[];
  logPath?: string;
  error?: string;
  output?: unknown;
}

export interface StartInvocationPayload {
  sessionId: string;
  provider: AssistantProvider;
  toolId: string;
  parameters: Record<string, unknown>;
  requestedAt: string;
}

export interface CompleteInvocationPayload {
  status: ToolInvocationStatus;
  finishedAt: string;
  resultSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryWriter {
  startInvocation(payload: StartInvocationPayload): Promise<ToolInvocationRecord>;
  completeInvocation(recordId: string, payload: CompleteInvocationPayload): Promise<ToolInvocationRecord>;
}

export interface ToolOrchestratorDependencies {
  loadConfiguration: () => ProviderConfigurationResult;
  runPipeline: (options: PipelineRunOptions) => Promise<PipelineRunResult>;
  readContextFile: (options: ReadContextFileOptions) => Promise<ReadContextFileResult>;
  telemetryWriter: TelemetryWriter;
  clock?: () => Date;
}

export interface ExecuteToolOptions {
  sessionId: string;
  provider: AssistantProvider;
  toolId: string;
  repoPath: string;
  parameters: Record<string, unknown>;
}

export interface ToolExecutionResult {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
  telemetry?: ToolInvocationRecord;
}

export class ToolOrchestrator {
  private readonly loadConfiguration: () => ProviderConfigurationResult;
  private readonly runPipeline: (options: PipelineRunOptions) => Promise<PipelineRunResult>;
  private readonly readContextFile: (options: ReadContextFileOptions) => Promise<ReadContextFileResult>;
  private readonly telemetryWriter: TelemetryWriter;
  private readonly clock: () => Date;

  constructor(deps: ToolOrchestratorDependencies) {
    if (!deps?.loadConfiguration) {
      throw new Error('ToolOrchestrator requires a loadConfiguration dependency.');
    }

    if (!deps?.runPipeline) {
      throw new Error('ToolOrchestrator requires a runPipeline dependency.');
    }

    if (!deps?.readContextFile) {
      throw new Error('ToolOrchestrator requires a readContextFile dependency.');
    }

    if (!deps?.telemetryWriter) {
      throw new Error('ToolOrchestrator requires a telemetryWriter dependency.');
    }

    this.loadConfiguration = deps.loadConfiguration;
    this.runPipeline = deps.runPipeline;
    this.readContextFile = deps.readContextFile;
    this.telemetryWriter = deps.telemetryWriter;
    this.clock = deps.clock ?? (() => new Date());
  }

  async executeTool(options: ExecuteToolOptions): Promise<ToolExecutionResult> {
    const providerTools = this.resolveProviderTools(options.provider);
    const tool = providerTools.get(options.toolId);

    if (!tool) {
      throw new Error(`Tool ${options.toolId} is not enabled for provider ${options.provider}.`);
    }

    switch (tool.id) {
      case 'pipeline.run':
        return this.executePipelineTool(options);
      case 'context.read':
        return this.executeContextReadTool(options);
      default:
        throw new Error(`Tool ${tool.id} is not implemented yet.`);
    }
  }

  private resolveProviderTools(provider: AssistantProvider): Map<string, ToolDescriptor> {
    const config = this.loadConfiguration();
    const settings = config.providers[provider];

    if (!settings) {
      throw new Error(`Assistant provider ${provider} is not configured.`);
    }

    const map = new Map<string, ToolDescriptor>();
    for (const tool of settings.tools) {
      map.set(tool.id, tool);
    }
    return map;
  }

  private async executePipelineTool(options: ExecuteToolOptions): Promise<ToolExecutionResult> {
    const pipeline = this.extractPipelineName(options.parameters.pipeline);
    const args = this.extractPipelineArgs(options.parameters.args);

    const requestedAt = this.nowIso();

    const pendingRecord = await this.telemetryWriter.startInvocation({
      sessionId: options.sessionId,
      provider: options.provider,
      toolId: options.toolId,
      parameters: options.parameters,
      requestedAt
    });

    try {
      const pipelineResult = await this.runPipeline({
        repoPath: options.repoPath,
        pipeline,
        args
      });

      const finishedAt = this.nowIso();
      const succeeded = pipelineResult.status === 'succeeded';
      const completionPayload: CompleteInvocationPayload = {
        status: succeeded ? 'succeeded' : 'failed',
        finishedAt,
        resultSummary: this.describePipelineOutcome(pipeline, pipelineResult),
        metadata: {
          pipeline,
          repoPath: options.repoPath,
          result: pipelineResult
        }
      };

      const telemetry = await this.telemetryWriter.completeInvocation(pendingRecord.id, completionPayload);

      const resultPayload: Record<string, unknown> = { ...pipelineResult };

      return {
        ok: succeeded,
        result: resultPayload,
        error: succeeded ? undefined : pipelineResult.error ?? 'Pipeline execution failed.',
        telemetry
      };
    } catch (error: unknown) {
      const finishedAt = this.nowIso();
      const message = error instanceof Error ? error.message : 'Unknown pipeline execution error.';

      let telemetry: ToolInvocationRecord | undefined;

      try {
        telemetry = await this.telemetryWriter.completeInvocation(pendingRecord.id, {
          status: 'failed',
          finishedAt,
          resultSummary: message,
          metadata: {
            pipeline,
            repoPath: options.repoPath,
            error: message
          }
        });
      } catch {
        // If telemetry completion fails we still surface the original error.
      }

      return {
        ok: false,
        error: message,
        telemetry
      };
    }
  }

  private async executeContextReadTool(options: ExecuteToolOptions): Promise<ToolExecutionResult> {
    const path = this.extractReadPath(options.parameters.path);
    const encoding = this.extractReadEncoding(options.parameters.encoding);
    const requestedAt = this.nowIso();

    const pendingRecord = await this.telemetryWriter.startInvocation({
      sessionId: options.sessionId,
      provider: options.provider,
      toolId: options.toolId,
      parameters: options.parameters,
      requestedAt
    });

    try {
      const fileResult = await this.readContextFile({
        repoPath: options.repoPath,
        path,
        encoding
      });

      const finishedAt = this.nowIso();

      const telemetry = await this.telemetryWriter.completeInvocation(pendingRecord.id, {
        status: 'succeeded',
        finishedAt,
        resultSummary: `Read ${fileResult.repoRelativePath} (${fileResult.size} bytes).`,
        metadata: {
          path: fileResult.repoRelativePath,
          repoPath: options.repoPath,
          size: fileResult.size,
          truncated: fileResult.truncated
        }
      });

      const resultPayload: Record<string, unknown> = {
        path: fileResult.absolutePath,
        repoRelativePath: fileResult.repoRelativePath,
        content: fileResult.content,
        encoding: fileResult.encoding,
        size: fileResult.size,
        lastModified: fileResult.lastModified,
        truncated: fileResult.truncated
      };

      return {
        ok: true,
        result: resultPayload,
        telemetry
      };
    } catch (error: unknown) {
      const finishedAt = this.nowIso();
      const message = error instanceof Error ? error.message : 'Unknown context read error.';

      let telemetry: ToolInvocationRecord | undefined;
      try {
        telemetry = await this.telemetryWriter.completeInvocation(pendingRecord.id, {
          status: 'failed',
          finishedAt,
          resultSummary: message,
          metadata: {
            path,
            repoPath: options.repoPath,
            error: message
          }
        });
      } catch {
        // swallow telemetry completion failures
      }

      return {
        ok: false,
        error: message,
        telemetry
      };
    }
  }

  private extractPipelineName(raw: unknown): AssistantPipelineName {
    if (typeof raw !== 'string') {
      throw new Error('pipeline parameter must be a string.');
    }

    const allowed: AssistantPipelineName[] = ['validate', 'build-graph', 'impact', 'generate'];
    if (!allowed.includes(raw as AssistantPipelineName)) {
      throw new Error(`Pipeline ${raw} is not supported.`);
    }

    return raw as AssistantPipelineName;
  }

  private extractPipelineArgs(raw: unknown): Record<string, unknown> | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('args parameter must be an object when provided.');
    }

    return { ...(raw as Record<string, unknown>) };
  }

  private describePipelineOutcome(pipeline: AssistantPipelineName, result: PipelineRunResult): string {
    if (result.status === 'succeeded') {
      return `Pipeline ${pipeline} completed successfully.`;
    }

    const reason = result.error ?? 'Unknown error';
    return `Pipeline ${pipeline} failed: ${reason}`;
  }

  private nowIso(): string {
    return this.clock().toISOString();
  }

  private extractReadPath(raw: unknown): string {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new Error('path parameter must be a non-empty string.');
    }
    return raw.trim();
  }

  private extractReadEncoding(raw: unknown): BufferEncoding | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new Error('encoding parameter must be a string when provided.');
    }
    return raw.trim() as BufferEncoding;
  }
}
