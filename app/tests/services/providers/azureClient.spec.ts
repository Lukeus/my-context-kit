import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderRuntimeSettings, ToolDescriptor } from '@shared/assistant/types';
import { AzureClient } from '~main/services/providers/azureClient';
import type { AzureChatCompletionResult } from '~main/services/providers/azureClient';

const { createMock, openAiCtor, getCapturedOptions, resetCapturedOptions } = vi.hoisted(() => {
  const createMock = vi.fn();
  let capturedOptions: Record<string, unknown> | undefined;

  const openAiCtor = vi.fn(function(this: any, options: Record<string, unknown>) {
    capturedOptions = options;
    this.chat = {
      completions: {
        create: createMock,
      },
    };
  });

  const getCapturedOptions = () => capturedOptions;
  const resetCapturedOptions = () => {
    capturedOptions = undefined;
  };

  return { createMock, openAiCtor, getCapturedOptions, resetCapturedOptions };
});

vi.mock('openai', () => ({
  __esModule: true,
  default: openAiCtor,
}));

const settings: ProviderRuntimeSettings = {
  id: 'azure-openai',
  displayName: 'Azure OpenAI',
  endpoint: 'https://example-resource.openai.azure.com',
  deployment: 'gpt-4o',
  apiVersion: '2024-12-01-preview',
  maxCompletionTokens: 4000,
  temperature: 0.35,
  enableLogprobs: false,
  tools: [],
};

const pipelineTool: ToolDescriptor = {
  id: 'pipeline.run',
  title: 'Run Pipeline',
  description: 'Execute validation pipelines.',
  capability: 'execute',
  requiresApproval: false,
  allowedProviders: ['azure-openai', 'ollama'],
  inputSchema: {
    type: 'object',
    required: ['pipeline'],
    properties: {
      pipeline: {
        type: 'string',
        enum: ['validate', 'impact'],
      },
    },
  },
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string' },
    },
  },
};

describe('AzureClient', () => {
  beforeEach(() => {
    createMock.mockReset();
    openAiCtor.mockClear();
    resetCapturedOptions();
  });

  it('configures OpenAI SDK with Azure endpoint defaults', () => {
    const client = new AzureClient({ settings, apiKey: 'secret-key' });
    expect(client).toBeInstanceOf(AzureClient);
    expect(openAiCtor).toHaveBeenCalledTimes(1);
    const capturedOptions = getCapturedOptions();
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions?.baseURL).toBe('https://example-resource.openai.azure.com/openai/deployments/gpt-4o');
    expect(capturedOptions?.defaultHeaders).toMatchObject({ 'api-key': 'secret-key' });
    expect(capturedOptions?.defaultQuery).toMatchObject({ 'api-version': '2024-12-01-preview' });
  });

  it('maps tool descriptors to function calls and parses arguments', async () => {
    const completionResponse = {
      id: 'chatcmpl-123',
      created: 1_698_000_000,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            refusal: null,
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'pipeline_run',
                  arguments: '{"pipeline":"validate"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 3,
        total_tokens: 15,
      },
      model: 'gpt-4o',
      system_fingerprint: 'fp',
      object: 'chat.completion',
    } satisfies Partial<AzureChatCompletionResult['completion']>;

    createMock.mockResolvedValue(completionResponse);

    const client = new AzureClient({ settings, apiKey: 'secret-key' });

    const result = await client.createChatCompletion({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Run the validation pipeline.' },
      ],
      tools: [pipelineTool],
      toolChoice: { type: 'function', toolId: 'pipeline.run' },
    });

    expect(createMock).toHaveBeenCalledTimes(1);

    const params = createMock.mock.calls[0][0];
    expect(params.tools).toHaveLength(1);
    expect(params.tools?.[0].function.name).toBe('pipeline_run');
    expect(params.tool_choice?.function.name).toBe('pipeline_run');

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({
      toolId: 'pipeline.run',
      arguments: { pipeline: 'validate' },
    });

    expect(result.message?.metadata?.toolCallOnly).toBe(true);
    expect(result.usage).toEqual({
      promptTokens: 12,
      completionTokens: 3,
      totalTokens: 15,
    });
  });

  it('throws when API key is missing', () => {
    expect(() => new AzureClient({ settings, apiKey: '' })).toThrow(/API key/);
  });
});
