import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption
} from 'openai/resources/chat/completions';
import type {
  AssistantProvider,
  AssistantRole,
  ConversationTurn,
  JsonSchemaDefinition,
  ProviderRuntimeSettings,
  ToolDescriptor
} from '@shared/assistant/types';
import { logger } from '~main/utils/logger';

export interface AzureClientOptions {
  settings: ProviderRuntimeSettings;
  apiKey: string;
  userAgentSuffix?: string;
}

export type AzureSupportedProvider = Extract<AssistantProvider, 'azure-openai'>;

export interface AzureChatMessage {
  role: AssistantRole | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export type AzureToolChoice =
  | 'auto'
  | 'none'
  | {
      type: 'function';
      toolId: string;
    };

export interface AzureChatCompletionRequest {
  messages: AzureChatMessage[];
  tools?: ToolDescriptor[];
  temperatureOverride?: number;
  maxOutputTokensOverride?: number;
  toolChoice?: AzureToolChoice;
  user?: string;
  metadata?: Record<string, string>;
  includeLogprobs?: boolean;
  topLogprobs?: number;
}

export interface AzureToolCall {
  callId: string;
  toolId: string;
  arguments: Record<string, unknown>;
  rawArguments: string;
}

export interface AzureChatCompletionResult {
  completion: ChatCompletion;
  message?: ConversationTurn;
  toolCalls: AzureToolCall[];
  finishReason: string | null;
  usage?: {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  };
  logprobs?: ChatCompletion['choices'][number]['logprobs'] | null;
}

function ensureUrlWithTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function sanitiseFunctionName(toolId: string, usedNames: Set<string>): string {
  const base = toolId
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+/, '');
  const prefixApplied = /^[A-Za-z_]/.test(base) ? base : `tool_${base}`;

  const trimmed = prefixApplied.slice(0, 64);
  if (!usedNames.has(trimmed)) {
    usedNames.add(trimmed);
    return trimmed;
  }

  let counter = 1;
  while (counter < 1000) {
    const candidate = `${trimmed.slice(0, 60)}_${counter}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    counter += 1;
  }

  throw new Error(`Unable to generate unique function name for tool: ${toolId}`);
}

type ChatCompletionToolCallPayload = {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments?: string;
  };
};

function isFunctionToolCall(call: unknown): call is ChatCompletionToolCallPayload {
  if (!call || typeof call !== 'object') {
    return false;
  }

  const candidate = call as Partial<ChatCompletionToolCallPayload> & { function?: { name?: unknown } };
  return typeof candidate.function?.name === 'string';
}

function normaliseMessageContent(content: unknown): string {
  if (content === null || content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === 'object' && 'type' in part) {
          const typed = part as { type: string; text?: string };
          if (typed.type === 'text') {
            return typed.text ?? '';
          }
        }
        return JSON.stringify(part);
      })
      .join('\n');
  }

  if (typeof content === 'object') {
    return JSON.stringify(content);
  }

  return String(content);
}

function parseToolArguments(raw: string | undefined, context: { functionName: string; callId: string }): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    logger.warn(
      { service: 'AzureClient', method: 'parseToolArguments', functionName: context.functionName, callId: context.callId },
      'Tool arguments were not an object'
    );
    return {};
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    logger.warn(
      { service: 'AzureClient', method: 'parseToolArguments', functionName: context.functionName, callId: context.callId },
      `Failed to parse tool arguments: ${message}`
    );
    return {};
  }
}

export class AzureClient {
  private readonly options: AzureClientOptions;

  private readonly client: OpenAI;

  private readonly provider: AzureSupportedProvider = 'azure-openai';

  private readonly defaultTemperature: number;

  private readonly defaultMaxOutputTokens: number;

  constructor(options: AzureClientOptions) {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new Error('Azure OpenAI API key is required');
    }

    if (!options.settings.endpoint) {
      throw new Error('Azure OpenAI endpoint is missing');
    }

    if (!options.settings.deployment) {
      throw new Error('Azure OpenAI deployment name is missing');
    }

    if (!options.settings.apiVersion) {
      throw new Error('Azure OpenAI API version is missing');
    }

    this.options = options;
    this.defaultTemperature = options.settings.temperature;
    this.defaultMaxOutputTokens = options.settings.maxCompletionTokens;

    const endpoint = ensureUrlWithTrailingSlash(options.settings.endpoint);
    const baseURL = new URL(`openai/deployments/${options.settings.deployment}`, endpoint).toString();

    const defaultHeaders: Record<string, string> = {
      'api-key': options.apiKey,
    };

    if (options.userAgentSuffix) {
      defaultHeaders['User-Agent'] = options.userAgentSuffix;
    }

    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL,
      defaultHeaders,
      defaultQuery: {
        'api-version': options.settings.apiVersion,
      },
    });
  }

  get providerId(): AzureSupportedProvider {
    return this.provider;
  }

  async createChatCompletion(request: AzureChatCompletionRequest): Promise<AzureChatCompletionResult> {
    const context = {
      service: 'AzureClient',
      method: 'createChatCompletion',
      deployment: this.options.settings.deployment,
    } as const;

    return logger.logServiceCall(context, async () => {
      if (request.messages.length === 0) {
        throw new Error('At least one message is required to create a chat completion');
      }

      const mappedMessages = request.messages.map((message) => this.toMessageParam(message));
      const { tools, nameToToolId } = this.buildToolPayload(request.tools ?? []);
      const toolChoice = this.resolveToolChoice(request.toolChoice, nameToToolId, tools);

      const params: ChatCompletionCreateParamsNonStreaming = {
        model: this.options.settings.deployment,
        messages: mappedMessages,
        temperature: request.temperatureOverride ?? this.defaultTemperature,
        max_tokens: request.maxOutputTokensOverride ?? this.defaultMaxOutputTokens,
      };

      if (tools.length > 0) {
        params.tools = tools;
      }

      if (toolChoice) {
        params.tool_choice = toolChoice;
      }

      if (request.user) {
        params.user = request.user;
      }

      if (request.metadata) {
        params.metadata = request.metadata;
      }

      const includeLogprobs = request.includeLogprobs ?? this.options.settings.enableLogprobs;
      if (includeLogprobs) {
        params.logprobs = true;
        if (request.topLogprobs !== undefined) {
          params.top_logprobs = request.topLogprobs;
        }
      }

      const completion = await this.client.chat.completions.create(params);
      const choice = completion.choices[0];

      if (!choice) {
        throw new Error('Azure OpenAI returned no completion choices');
      }

      const rawToolCalls =
        'tool_calls' in choice.message && Array.isArray((choice.message as { tool_calls?: unknown }).tool_calls)
          ? ((choice.message as { tool_calls: unknown }).tool_calls as unknown[])
          : [];

      const toolCalls = rawToolCalls
        .filter(isFunctionToolCall)
        .map((call) => this.toToolCall(call, nameToToolId.get(call.function.name) ?? call.function.name));

      const message = this.toConversationTurn(choice);
      const usage = completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens ?? null,
            completionTokens: completion.usage.completion_tokens ?? null,
            totalTokens: completion.usage.total_tokens ?? null,
          }
        : undefined;

      return {
        completion,
        message,
        toolCalls,
        finishReason: choice.finish_reason ?? null,
        usage,
        logprobs: choice.logprobs ?? null,
      };
    });
  }

  private toMessageParam(message: AzureChatMessage): ChatCompletionMessageParam {
    if (message.role === 'tool') {
      if (!message.toolCallId) {
        throw new Error('Tool role messages must include the originating toolCallId');
      }

      if (typeof message.content !== 'string') {
        throw new Error('Tool role messages must provide textual content');
      }
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId,
      };
    }

    const param: ChatCompletionMessageParam = {
      role: message.role,
      content: message.content,
    };

    if (message.name) {
      (param as ChatCompletionMessageParam & { name: string }).name = message.name;
    }

    return param;
  }

  private buildToolPayload(tools: ToolDescriptor[]): {
    tools: ChatCompletionTool[];
    nameToToolId: Map<string, string>;
  } {
    if (tools.length === 0) {
      return { tools: [], nameToToolId: new Map<string, string>() };
    }

    const usedNames = new Set<string>();
    const nameToToolId = new Map<string, string>();
    const chatTools: ChatCompletionTool[] = tools.map((tool) => {
      const functionName = sanitiseFunctionName(tool.id, usedNames);
      nameToToolId.set(functionName, tool.id);

      return {
        type: 'function',
        function: {
          name: functionName,
          description: tool.description,
          parameters: this.cloneSchema(tool.inputSchema),
        },
      } satisfies ChatCompletionTool;
    });

    return { tools: chatTools, nameToToolId };
  }

  private resolveToolChoice(
    requestedChoice: AzureToolChoice | undefined,
    nameToToolId: Map<string, string>,
    tools: ChatCompletionTool[]
  ): ChatCompletionToolChoiceOption | undefined {
    if (!requestedChoice) {
      return undefined;
    }

    if (requestedChoice === 'auto' || requestedChoice === 'none') {
      if (requestedChoice === 'none') {
        return 'none';
      }
      return tools.length > 0 ? 'auto' : undefined;
    }

    const functionEntry = [...nameToToolId.entries()].find(([, toolId]) => toolId === requestedChoice.toolId);

    if (!functionEntry) {
      throw new Error(`Requested tool ${requestedChoice.toolId} is not available for this provider`);
    }

    return {
      type: 'function',
      function: {
        name: functionEntry[0],
      },
    } satisfies ChatCompletionToolChoiceOption;
  }

  private toToolCall(call: ChatCompletionToolCallPayload, toolId: string): AzureToolCall {
    const args = call.function.arguments ?? '';
    const parsedArguments = parseToolArguments(args, {
      functionName: call.function.name,
      callId: call.id,
    });

    return {
      callId: call.id,
      toolId,
      arguments: parsedArguments,
      rawArguments: args,
    };
  }

  private toConversationTurn(choice: ChatCompletion['choices'][number]): ConversationTurn | undefined {
    if (choice.message.role !== 'assistant') {
      return undefined;
    }

    const content = normaliseMessageContent(choice.message.content);
    const timestamp = new Date().toISOString();

    const metadata: Record<string, unknown> = {
      finishReason: choice.finish_reason,
    };

    if ('refusal' in choice.message && (choice.message as { refusal?: unknown }).refusal) {
      metadata.refusal = (choice.message as { refusal?: unknown }).refusal;
    }

    const rawToolCalls =
      'tool_calls' in choice.message && Array.isArray((choice.message as { tool_calls?: unknown }).tool_calls)
        ? ((choice.message as { tool_calls: unknown }).tool_calls as unknown[])
        : [];

    const toolCalls = rawToolCalls.filter(isFunctionToolCall);
    if (toolCalls.length > 0) {
      metadata.toolCalls = toolCalls.map((call) => call.function.name);
    }

    if (
      choice.message.role === 'assistant' &&
      choice.message.content === null &&
      choice.finish_reason === 'tool_calls' &&
      toolCalls.length > 0
    ) {
      // When the model decides to call a tool immediately, there may be no assistant content.
      metadata.toolCallOnly = true;
    }

    return {
      role: 'assistant',
      content,
      timestamp,
      metadata,
    } satisfies ConversationTurn;
  }

  private cloneSchema(schema: JsonSchemaDefinition): JsonSchemaDefinition {
    return JSON.parse(JSON.stringify(schema)) as JsonSchemaDefinition;
  }
}
