import type {
  AssistantProvider,
  ProviderConfigurationResult,
  ProviderRuntimeSettings,
  ToolDescriptor
} from '@shared/assistant/types';

const PIPELINE_OPTIONS = ['validate', 'build-graph', 'impact', 'generate'] as const;

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return defaultValue;
  }
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function readNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function toEnvToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '_').toUpperCase();
}

function isToolEnabled(toolId: string, provider: AssistantProvider): boolean {
  const toolToken = toEnvToken(toolId);
  const providerToken = toEnvToken(provider);

  const globalOverride = process.env[`ASSISTANT_TOOL_${toolToken}_ENABLED`];
  if (globalOverride !== undefined) {
    return readBooleanEnv(`ASSISTANT_TOOL_${toolToken}_ENABLED`, true);
  }

  return readBooleanEnv(`ASSISTANT_TOOL_${toolToken}_${providerToken}_ENABLED`, true);
}

const BASE_TOOLS: ToolDescriptor[] = [
  {
    id: 'pipeline.run',
    title: 'Run Context Pipeline',
    description: 'Execute a deterministic context pipeline (validate, build graph, impact, generate).',
    capability: 'execute',
    requiresApproval: false,
    allowedProviders: ['azure-openai', 'ollama'],
    inputSchema: {
      type: 'object',
      required: ['pipeline'],
      properties: {
        pipeline: {
          type: 'string',
          enum: [...PIPELINE_OPTIONS],
          description: 'Pipeline script to execute'
        },
        args: {
          type: 'object',
          description: 'Optional arguments forwarded to the pipeline executor',
          additionalProperties: true
        }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['succeeded', 'failed'],
          description: 'Final pipeline status'
        },
        artifacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paths to generated artifacts'
        },
        logPath: {
          type: 'string',
          description: 'Path to pipeline execution log on disk'
        }
      },
      additionalProperties: true
    }
  },
  {
    id: 'context.read',
    title: 'Read Repository Artifact',
    description: 'Return the contents of a context repository file for grounding or summarisation.',
    capability: 'read',
    requiresApproval: false,
    allowedProviders: ['azure-openai', 'ollama'],
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to read from the repository root'
        },
        format: {
          type: 'string',
          enum: ['text', 'markdown'],
          description: 'Preferred rendering format for the assistant response'
        }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      required: ['contents'],
      properties: {
        contents: {
          type: 'string',
          description: 'Raw file contents read from disk'
        },
        path: {
          type: 'string',
          description: 'Resolved absolute path that was read'
        },
        encoding: {
          type: 'string',
          description: 'Text encoding used when reading the file'
        }
      }
    }
  },
  {
    id: 'context.writePatch',
    title: 'Write Repository Patch',
    description: 'Apply a diff patch to the repository after human approval.',
    capability: 'write',
    requiresApproval: true,
    allowedProviders: ['azure-openai', 'ollama'],
    inputSchema: {
      type: 'object',
      required: ['path', 'patch'],
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file being modified'
        },
        patch: {
          type: 'string',
          description: 'Unified diff patch to apply'
        },
        summary: {
          type: 'string',
          description: 'Short human-readable summary of the proposed change'
        }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        applied: {
          type: 'boolean',
          description: 'Whether the diff was applied successfully'
        },
        conflicts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Any conflicting segments that prevented the patch from applying'
        }
      },
      additionalProperties: true
    }
  },
  {
    id: 'git.status',
    title: 'Git Status Snapshot',
    description: 'Return git status for the context repository in a safe, read-only form.',
    capability: 'git',
    requiresApproval: false,
    allowedProviders: ['azure-openai', 'ollama'],
    inputSchema: {
      type: 'object',
      properties: {
        includeDiff: {
          type: 'boolean',
          description: 'Whether to include short diff summaries for changed files'
        }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        staged: {
          type: 'array',
          items: { type: 'string' }
        },
        unstaged: {
          type: 'array',
          items: { type: 'string' }
        },
        untracked: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      additionalProperties: true
    }
  },
  {
    id: 'git.preparePr',
    title: 'Prepare Pull Request Draft',
    description: 'Create a pull request summary and metadata using simple-git without opening a PR automatically.',
    capability: 'git',
    requiresApproval: true,
    allowedProviders: ['azure-openai', 'ollama'],
    inputSchema: {
      type: 'object',
      required: ['title', 'description'],
      properties: {
        title: {
          type: 'string',
          description: 'Suggested pull request title'
        },
        description: {
          type: 'string',
          description: 'Proposed pull request description with highlights'
        },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional reviewer handles to mention'
        }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string' },
        summaryPath: { type: 'string' },
        instructions: {
          type: 'string',
          description: 'Instructions for finalising the pull request manually'
        }
      },
      additionalProperties: true
    }
  }
];

function buildAzureSettings(tools: ToolDescriptor[]): ProviderRuntimeSettings {
  return {
    id: 'azure-openai',
    displayName: 'Azure OpenAI',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview',
    maxCompletionTokens: readNumberEnv('AZURE_OPENAI_MAX_COMPLETION_TOKENS', 4000),
    temperature: readNumberEnv('AZURE_OPENAI_TEMPERATURE', 1),
    enableLogprobs: readBooleanEnv('AZURE_OPENAI_ENABLE_LOGPROBS', false),
    tools
  };
}

function buildOllamaSettings(tools: ToolDescriptor[]): ProviderRuntimeSettings {
  return {
    id: 'ollama',
    displayName: 'Ollama',
    endpoint: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    deployment: process.env.OLLAMA_MODEL ?? 'llama3.1',
    apiVersion: 'ollama',
    maxCompletionTokens: readNumberEnv('OLLAMA_MAX_COMPLETION_TOKENS', 4000),
    temperature: readNumberEnv('OLLAMA_TEMPERATURE', 0.7),
    enableLogprobs: false,
    tools
  };
}

export function loadProviderConfiguration(): ProviderConfigurationResult {
  const disabledTools: Record<string, AssistantProvider[]> = {};

  const toolsByProvider = new Map<AssistantProvider, ToolDescriptor[]>();
  for (const provider of ['azure-openai', 'ollama'] as AssistantProvider[]) {
    const enabledTools = BASE_TOOLS.filter(tool => tool.allowedProviders.includes(provider) && isToolEnabled(tool.id, provider));
    toolsByProvider.set(provider, enabledTools);

    for (const tool of BASE_TOOLS) {
      if (!tool.allowedProviders.includes(provider)) {
        continue;
      }
      if (enabledTools.includes(tool)) {
        continue;
      }
      if (!disabledTools[tool.id]) {
        disabledTools[tool.id] = [];
      }
      disabledTools[tool.id].push(provider);
    }
  }

  return {
    providers: {
      'azure-openai': buildAzureSettings(toolsByProvider.get('azure-openai') ?? []),
      ollama: buildOllamaSettings(toolsByProvider.get('ollama') ?? [])
    },
    disabledTools
  };
}

export function listBaseTools(): ToolDescriptor[] {
  return [...BASE_TOOLS];
}

// TODO: Persist administrator-driven tool enablement decisions beyond environment variables.
