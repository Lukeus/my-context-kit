export interface AIPromptConfig {
  systemPrompts: {
    general: string;
    improvement: string;
    clarification: string;
  };
  quickPrompts: {
    improvementActive: string;
    improvementGeneral: string;
    clarificationActive: string;
    clarificationGeneral: string;
  };
  exampleQuestions: string[];
}

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsStreamingReasoning: boolean;
  supportsWebSearch: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsLogProbs: boolean;
  maxTokens: number;
  contextWindow: number;
}

export interface TokenProbability {
  token: string;
  prob: number;
  logprob: number;
  topLogprobs?: Array<{
    token: string;
    logprob: number;
    prob: number;
  }>;
}

export const DEFAULT_PROMPTS: AIPromptConfig = {
  systemPrompts: {
    general: `You are the Spec-Driven Development guide for Context-Sync. Always ground your responses in repository artifacts, the constitution, and generated checklists (e.g., FEAT-001.checklist.md). Structure answers as: Situation → Analysis → Next Steps → Checklist. Surface at most the top three clarifications using [NEEDS CLARIFICATION] markers and propose resolution paths.`,
    improvement: `Act as a governance-aligned reviewer. Evaluate the active entities against constitutional gates, success criteria, and dependency maps. Recommend improvements that strengthen specifications, resolve clarifications, tighten success metrics, and maintain traceability between feature → plan → task artifacts. Call out risks, missing assumptions, and checklist items that remain open.`,
    clarification: `Serve as a clarifications concierge. Explain intent, dependencies, and success signals for the selected entity. Highlight ambiguities blocking progress, reference relevant prompts/checklists, and suggest concrete questions (with option tables when appropriate) that keep within the three-question limit.`
  },
  quickPrompts: {
    improvementActive: `Audit {entityId} against its checklist and constitution gates, then suggest targeted fixes.`,
    improvementGeneral: `Review current features/stories/specs and propose the highest-impact improvements to unblock SDD flow.`,
    clarificationActive: `For {entityId}, summarize intent, success signals, and the top clarifications still open.`,
    clarificationGeneral: `Explain how the active feature set connects across specs, tasks, and governance, noting any gaps to close.`
  },
  exampleQuestions: [
    `Walk me through FEAT-001's blueprint, checklist status, and next gating steps.`,
    `Which entities violate constitution rules or exceed the three-clarification limit right now?`,
    `What success criteria and test signals are missing for US-001, and how should we capture them?`
  ]
};

// Model capability detection based on provider and model name
export function detectModelCapabilities(provider: string, model: string): ModelCapabilities {
  const modelLower = model.toLowerCase();
  
  // Azure OpenAI models
  if (provider === 'azure-openai') {
    if (modelLower.includes('gpt-4')) {
      return {
        supportsStreaming: true,
        supportsStreamingReasoning: modelLower.includes('o1') || modelLower.includes('reasoning'),
        supportsWebSearch: false,
        supportsFunctionCalling: true,
        supportsVision: modelLower.includes('vision') || modelLower.includes('turbo'),
        supportsLogProbs: true,
        maxTokens: modelLower.includes('32k') ? 32768 : 8192,
        contextWindow: modelLower.includes('32k') ? 32768 : (modelLower.includes('turbo') ? 16385 : 8192)
      };
    }
    if (modelLower.includes('gpt-35') || modelLower.includes('gpt-3.5')) {
      return {
        supportsStreaming: true,
        supportsStreamingReasoning: false,
        supportsWebSearch: false,
        supportsFunctionCalling: true,
        supportsVision: false,
        supportsLogProbs: true,
        maxTokens: 4096,
        contextWindow: 16385
      };
    }
    if (modelLower.includes('o1')) {
      return {
        supportsStreaming: true,
        supportsStreamingReasoning: true,
        supportsWebSearch: false,
        supportsFunctionCalling: false,
        supportsVision: false,
        supportsLogProbs: false,
        maxTokens: 100000,
        contextWindow: 200000
      };
    }
  }
  
  // Ollama models
  if (provider === 'ollama') {
    const hasWebSearch = modelLower.includes('hermes') || modelLower.includes('mixtral');
    const contextSize = modelLower.includes('32k') ? 32768 : (modelLower.includes('16k') ? 16384 : 4096);
    
    return {
      supportsStreaming: true,
      supportsStreamingReasoning: false,
      supportsWebSearch: hasWebSearch,
      supportsFunctionCalling: modelLower.includes('hermes') || modelLower.includes('llama-3'),
      supportsVision: modelLower.includes('vision') || modelLower.includes('llava'),
      supportsLogProbs: false, // Most Ollama models don't return logprobs
      maxTokens: Math.floor(contextSize * 0.75),
      contextWindow: contextSize
    };
  }
  
  // Default capabilities
  return {
    supportsStreaming: false,
    supportsStreamingReasoning: false,
    supportsWebSearch: false,
    supportsFunctionCalling: false,
    supportsVision: false,
    supportsLogProbs: false,
    maxTokens: 4000,
    contextWindow: 8000
  };
}
