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
    general: `You are an AI assistant for a context-driven development system. You help users manage features, user stories, specifications, tasks, and their relationships. Provide clear, actionable advice based on the context repository structure.`,
    improvement: `You are an AI assistant specializing in improving context entities. Analyze entities for alignment with the constitution, suggest enhancements, identify risks, and recommend better dependency management. Focus on spec-driven development principles.`,
    clarification: `You are an AI assistant that clarifies context entities. Help users understand purposes, dependencies, risks, and relationships. Provide clear explanations and highlight areas that need more definition.`
  },
  quickPrompts: {
    improvementActive: `Suggest improvements for {entityId} to stay aligned with the constitution and dependencies.`,
    improvementGeneral: `Review the roadmap and suggest improvements to keep everything aligned.`,
    clarificationActive: `Clarify the purpose, dependencies, and outstanding risks for {entityId}.`,
    clarificationGeneral: `Clarify how the current context pieces fit together and what is missing.`
  },
  exampleQuestions: [
    `Summarize the current feature landscape and any gaps.`,
    `Which tasks look risky based on the constitution rules?`,
    `Clarify how FEAT-001 impacts services and packages.`
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
