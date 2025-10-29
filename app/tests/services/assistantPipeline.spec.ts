import { describe, it, expect, vi } from 'vitest';
import {
  ToolOrchestrator,
  type ToolOrchestratorDependencies,
  type PipelineRunResult,
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

const createConfig = (tool: ToolDescriptor | null): ProviderConfigurationResult => ({
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
      tools: tool ? [tool] : []
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
      tools: tool ? [tool] : []
    }
  },
  disabledTools: {}
});

describe('ToolOrchestrator pipeline integration', () => {
  it('runs allowlisted pipeline and records telemetry on success', async () => {
    const repoPath = '/repo/context';
    const sessionId = 'session-123';
    const now = new Date('2025-10-28T15:30:00.000Z');

    const pipelineResult: PipelineRunResult = {
      status: 'succeeded',
      artifacts: ['generated/report.json'],
      logPath: '/repo/context/.logs/validate.log'
    };

    const runPipeline = vi.fn().mockResolvedValue(pipelineResult);

    const pendingRecord: ToolInvocationRecord = {
      id: 'telemetry-abc',
      sessionId,
      toolId: 'pipeline.run',
      status: 'pending',
      parameters: { pipeline: 'validate', args: { force: true } },
      startedAt: now.toISOString(),
      provider: 'azure-openai'
    };

    const completedRecord: ToolInvocationRecord = {
      ...pendingRecord,
      status: 'succeeded',
      finishedAt: new Date('2025-10-28T15:30:05.000Z').toISOString(),
      resultSummary: 'Pipeline validate completed successfully.'
    };

    const telemetryWriter: TelemetryWriter = {
      startInvocation: vi.fn().mockResolvedValue(pendingRecord),
      completeInvocation: vi.fn().mockResolvedValue(completedRecord)
    };

    const clock = vi.fn(() => now);

    const dependencies: ToolOrchestratorDependencies = {
      loadConfiguration: () => createConfig(pipelineTool),
      runPipeline,
      telemetryWriter,
      // Provide a stub readContextFile for tests - returns a minimal successful payload
      readContextFile: vi.fn().mockResolvedValue({
        absolutePath: '/repo/context/placeholder',
        repoRelativePath: 'placeholder',
        content: '',
        encoding: 'utf-8',
        size: 0,
        lastModified: new Date().toISOString(),
        truncated: false
      }),
      clock
    };

    const orchestrator = new ToolOrchestrator(dependencies);

    const options: ExecuteToolOptions = {
      sessionId,
      provider: 'azure-openai',
      toolId: 'pipeline.run',
      repoPath,
      parameters: { pipeline: 'validate', args: { force: true } }
    };

    const result = await orchestrator.executeTool(options);

    expect(runPipeline).toHaveBeenCalledWith({
      repoPath,
      pipeline: 'validate',
      args: { force: true }
    });

    expect(telemetryWriter.startInvocation).toHaveBeenCalledWith({
      sessionId,
      provider: 'azure-openai',
      toolId: 'pipeline.run',
      parameters: options.parameters,
      requestedAt: now.toISOString()
    });

    expect(telemetryWriter.completeInvocation).toHaveBeenCalledWith('telemetry-abc', expect.objectContaining({
      status: 'succeeded',
      metadata: expect.objectContaining({
        repoPath
      })
    }));

    expect(result.ok).toBe(true);
    expect(result.result).toEqual(pipelineResult);
    expect(result.telemetry).toEqual(completedRecord);
  });
});
