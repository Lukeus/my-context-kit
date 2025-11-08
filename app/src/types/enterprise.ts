/**
 * Enterprise feature types shared between main and renderer processes
 */

import { z } from 'zod';

// ============================================================================
// Enterprise Configuration
// ============================================================================

export const EnterpriseConfigSchema = z.object({
  gheOrg: z.string().optional(),
  enterpriseSpecsRepo: z.string().optional(),
  azureOpenAIEndpoint: z.string().url().optional(),
  azureOpenAIKey: z.string().optional(),
  azureOpenAIDeployment: z.string().optional(),
  ollamaEndpoint: z.string().url().optional(),
});

export type EnterpriseConfig = z.infer<typeof EnterpriseConfigSchema>;

// ============================================================================
// Repository Information
// ============================================================================

export const EnterpriseRepoInfoSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  defaultBranch: z.string(),
  url: z.string().url(),
  hasConstitution: z.boolean(),
  hasSpecs: z.boolean(),
  constitutionPath: z.string().optional(),
  specsPath: z.string().optional(),
  lastUpdated: z.string().optional(),
});

export type EnterpriseRepoInfo = z.infer<typeof EnterpriseRepoInfoSchema>;

// ============================================================================
// Constitution
// ============================================================================

export interface ConstitutionSection {
  title: string;
  content: string;
  source: 'global' | 'local' | 'merged';
  path?: string;
  lineNumber?: number;
}

export interface MergedConstitution {
  sections: ConstitutionSection[];
  globalPath: string;
  localPath?: string;
  localRepoPath?: string;
  mergedAt: string;
  conflicts: ConstitutionConflict[];
}

export interface ConstitutionConflict {
  section: string;
  path: string;
  reason: string;
  globalValue: string;
  localValue: string;
  globalSection: ConstitutionSection;
  localSection: ConstitutionSection;
  resolution: 'use_local' | 'use_global' | 'manual_review';
}

// ============================================================================
// Spec Derivation
// ============================================================================

export const DeriveSpecRequestSchema = z.object({
  repoPath: z.string(),
  constitutionPath: z.string().optional(),
  includeTests: z.boolean().default(true),
  includeDocs: z.boolean().default(true),
  provider: z.enum(['azure', 'ollama']).default('azure'),
});

export type DeriveSpecRequest = z.infer<typeof DeriveSpecRequestSchema>;

export interface DeriveSpecResult {
  success: boolean;
  specPath?: string;
  spec?: string;
  error?: string;
  tokensUsed?: number;
  duration?: number;
}

// ============================================================================
// Prompt Templates
// ============================================================================

export interface PromptTemplate {
  name: string;
  path: string;
  content: string;
  variables: string[];
  description?: string;
}

export interface PromptRegistry {
  templates: Map<string, PromptTemplate>;
  lastLoaded: string;
  source: 'enterprise' | 'local';
}

// ============================================================================
// Enterprise Repo Status
// ============================================================================

export interface EnterpriseRepoStatus {
  cloned: boolean;
  path?: string;
  lastSync?: string;
  branch: string;
  hasChanges: boolean;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

export const ENTERPRISE_IPC_CHANNELS = {
  // Configuration
  GET_CONFIG: 'ent:getConfig',
  SET_CONFIG: 'ent:setConfig',
  
  // Repository operations
  LIST_REPOS: 'ent:listRepos',
  GET_ENTERPRISE_REPO_STATUS: 'ent:getEnterpriseRepoStatus',
  SYNC_ENTERPRISE_REPO: 'ent:syncEnterpriseRepo',
  
  // Spec derivation
  DERIVE_SPEC: 'ent:deriveSpec',
  
  // Constitution
  GET_EFFECTIVE_CONSTITUTION: 'ent:getEffectiveConstitution',
  MERGE_CONSTITUTIONS: 'ent:mergeConstitutions',
  
  // Prompts
  LIST_PROMPTS: 'ent:listPrompts',
  GET_PROMPT: 'ent:getPrompt',
  APPLY_TEMPLATE: 'ent:applyTemplate',
} as const;

export type EnterpriseIPCChannel = typeof ENTERPRISE_IPC_CHANNELS[keyof typeof ENTERPRISE_IPC_CHANNELS];
