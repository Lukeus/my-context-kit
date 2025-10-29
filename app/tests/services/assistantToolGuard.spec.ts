import { describe, it, expect, vi } from 'vitest';
import {
  ToolOrchestrator,
  type ToolOrchestratorDependencies,
  type ExecuteToolOptions,
  type TelemetryWriter
} from '../../src/main/services/toolOrchestrator';
import type {
  ProviderConfigurationResult,
  ToolDescriptor,
  ToolInvocationRecord
} from '@shared/assistant/types';

const pipelineTool: ToolDescriptor = {
  id: 'pipeline.run',
  title: 'Run Context Pipeline',
  description: 'Execute deterministic context repository pipelines.',
  capability: 'execute',
  requiresApproval: false,
  allowedProviders: ['azure-openai', 'ollama'],
  inputSchema: { type: 'object', properties: {}, additionalProperties: true },
  outputSchema: { type: 'object', properties: {}, additionalProperties: true }
};

const createConfig = (tools: ToolDescriptor[]): ProviderConfigurationResult => ({
  providers: {
    'azure-openai': {
      id: 'azure-openai',
      displayName: 'Azure OpenAI',
      endpoint: 'https://example.openai.azure.com',
      deployment: 'gpt-4o',
      apiVersion: '2024-12-01-preview',
      maxCompletionTokens: 4000,
      temperature: 0.3,
      enableLogprobs: false,
      tools
    },
    ollama: {
      id: 'ollama',
      displayName: 'Ollama',
      endpoint: 'http://localhost:11434',
      deployment: 'llama3.1',
      apiVersion: 'ollama',
      maxCompletionTokens: 4000,
      temperature: 0.7,
      enableLogprobs: false,
      tools
    }
  },
  disabledTools: {}
});

describe('ToolOrchestrator guard rails', () => {
  it('rejects tool execution when not allowlisted for provider', async () => {
    const repoPath = '/repo/context';
    const runPipeline = vi.fn();

    const telemetryWriterStart: TelemetryWriter['startInvocation'] = vi.fn(async () => {
      throw new Error('startInvocation should not be called when tool is blocked.');
    });

    const telemetryWriterComplete: TelemetryWriter['completeInvocation'] = vi.fn(async () => {
      throw new Error('completeInvocation should not be called when tool is blocked.');
    });

    const telemetryWriter: TelemetryWriter = {
      startInvocation: telemetryWriterStart,
      completeInvocation: telemetryWriterComplete
    };

    const dependencies: ToolOrchestratorDependencies = {
      loadConfiguration: () => createConfig([]),
      runPipeline,
      telemetryWriter,
      readContextFile: vi.fn().mockResolvedValue({
        absolutePath: '/repo/context/placeholder',
        repoRelativePath: 'placeholder',
        content: '',
        encoding: 'utf-8',
        size: 0,
        lastModified: new Date().toISOString(),
        truncated: false
      }),
      clock: () => new Date('2025-10-28T15:45:00.000Z')
    };

    const orchestrator = new ToolOrchestrator(dependencies);

    const options: ExecuteToolOptions = {
      sessionId: 'session-unauthorized',
      provider: 'azure-openai',
      toolId: 'pipeline.run',
      repoPath,
      parameters: { pipeline: 'validate' }
    };

    await expect(orchestrator.executeTool(options)).rejects.toThrow(/pipeline\.run/);

    expect(runPipeline).not.toHaveBeenCalled();
    expect(telemetryWriter.startInvocation).not.toHaveBeenCalled();
    expect(telemetryWriter.completeInvocation).not.toHaveBeenCalled();
  });

  it('allows execution when provider exposes tool', async () => {
    const repoPath = '/repo/context';
    const sessionId = 'session-authorized';

    const runPipeline = vi.fn().mockResolvedValue({ status: 'succeeded' });

    const pendingRecord: ToolInvocationRecord = {
      id: 'telemetry-allow',
      sessionId,
      toolId: 'pipeline.run',
      status: 'pending',
      parameters: { pipeline: 'validate' },
      startedAt: '2025-10-28T15:50:00.000Z',
      provider: 'azure-openai'
    };

    const completedRecord: ToolInvocationRecord = {
      ...pendingRecord,
      status: 'succeeded',
      finishedAt: '2025-10-28T15:50:05.000Z'
    };

    const telemetryWriter: TelemetryWriter = {
      startInvocation: vi.fn().mockResolvedValue(pendingRecord),
      completeInvocation: vi.fn().mockResolvedValue(completedRecord)
    };

    const dependencies: ToolOrchestratorDependencies = {
      loadConfiguration: () => createConfig([pipelineTool]),
      runPipeline,
      telemetryWriter,
      readContextFile: vi.fn().mockResolvedValue({
        absolutePath: '/repo/context/placeholder',
        repoRelativePath: 'placeholder',
        content: '',
        encoding: 'utf-8',
        size: 0,
        lastModified: new Date().toISOString(),
        truncated: false
      }),
      clock: () => new Date('2025-10-28T15:50:00.000Z')
    };

    const orchestrator = new ToolOrchestrator(dependencies);

    const options: ExecuteToolOptions = {
      sessionId,
      provider: 'azure-openai',
      toolId: 'pipeline.run',
      repoPath,
      parameters: { pipeline: 'validate' }
    };

    const result = await orchestrator.executeTool(options);

    expect(result.ok).toBe(true);
    expect(runPipeline).toHaveBeenCalledTimes(1);
    expect(telemetryWriter.startInvocation).toHaveBeenCalledTimes(1);
    expect(telemetryWriter.completeInvocation).toHaveBeenCalledTimes(1);
  });
});
