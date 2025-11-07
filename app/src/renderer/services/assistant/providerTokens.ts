// Provider Identity Display Tokens (T023)
// -----------------------------------------------------------------------------
// Maps provider IDs to human-readable display names, icons, and color schemes.
// Used for UI badges, telemetry visualization, and provider selection.
// TODO(T023-UI): Wire into ProviderBadge.vue component.
// TODO(T023-Icons): Add provider logo assets to public directory.

import type { AssistantProvider } from '@shared/assistant/types';

export interface ProviderToken {
  id: AssistantProvider;
  displayName: string;
  shortName: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  capabilities: string[];
}

export const PROVIDER_TOKENS: Record<AssistantProvider, ProviderToken> = {
  'azure-openai': {
    id: 'azure-openai',
    displayName: 'Azure OpenAI',
    shortName: 'Azure',
    icon: '☁️',
    color: '#005A9E',
    bgColor: '#E6F2FF',
    description: 'Microsoft Azure OpenAI Service',
    capabilities: ['streaming', 'function-calling', 'embeddings', 'vision']
  },
  'ollama': {
    id: 'ollama',
    displayName: 'Ollama',
    shortName: 'Ollama',
    icon: '🦙',
    color: '#000000',
    bgColor: '#F5F5F5',
    description: 'Local LLM runtime',
    capabilities: ['streaming', 'local-execution', 'privacy']
  }
};

/**
 * Get display token for provider.
 */
export function getProviderToken(provider: AssistantProvider): ProviderToken {
  return PROVIDER_TOKENS[provider];
}

/**
 * Get display name for provider.
 */
export function getProviderDisplayName(provider: AssistantProvider): string {
  return PROVIDER_TOKENS[provider].displayName;
}

/**
 * Get short name for provider (for constrained UI space).
 */
export function getProviderShortName(provider: AssistantProvider): string {
  return PROVIDER_TOKENS[provider].shortName;
}

/**
 * Get icon emoji for provider.
 */
export function getProviderIcon(provider: AssistantProvider): string {
  return PROVIDER_TOKENS[provider].icon;
}

/**
 * Get color scheme for provider badge.
 */
export function getProviderColors(provider: AssistantProvider): {
  color: string;
  bgColor: string;
} {
  const token = PROVIDER_TOKENS[provider];
  return {
    color: token.color,
    bgColor: token.bgColor
  };
}

/**
 * Get provider description.
 */
export function getProviderDescription(provider: AssistantProvider): string {
  return PROVIDER_TOKENS[provider].description;
}

/**
 * Check if provider supports specific capability.
 */
export function hasProviderCapability(
  provider: AssistantProvider,
  capability: string
): boolean {
  return PROVIDER_TOKENS[provider].capabilities.includes(capability);
}

/**
 * Get all available providers.
 */
export function getAllProviders(): AssistantProvider[] {
  return Object.keys(PROVIDER_TOKENS) as AssistantProvider[];
}

/**
 * Format provider for display in UI.
 */
export function formatProviderBadge(provider: AssistantProvider): string {
  const token = PROVIDER_TOKENS[provider];
  return `${token.icon} ${token.shortName}`;
}

/**
 * Get CSS class for provider badge.
 */
export function getProviderBadgeClass(provider: AssistantProvider): string {
  return `provider-badge provider-badge-${provider}`;
}

// Example usage:
// const token = getProviderToken('azure-openai');
// const badge = formatProviderBadge('azure-openai'); // "☁️ Azure"
// const hasStreaming = hasProviderCapability('ollama', 'streaming'); // true
