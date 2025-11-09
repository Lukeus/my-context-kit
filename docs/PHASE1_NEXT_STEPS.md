# Phase 1: Remaining Implementation Steps

## ✅ Completed So Far

1. **Domain Logic**:
   - ✅ PromptRegistry (loads markdown prompts, variable substitution)
   - ✅ ConstitutionMerger (merges global/local, detects conflicts)

2. **Services**:
   - ✅ GitHubService (GitHub API operations)

## 🔄 Next: Complete Service Layer

### 1. AIService (Wrapper around LangChainAIService)

**File**: `src/main/services/AIService.ts`

**Purpose**: Unified interface that wraps existing LangChainAIService with:
- Prompt template loading via PromptRegistry
- Simplified API for common operations
- Token estimation and cost tracking

**Implementation Outline**:
```typescript
import { LangChainAIService } from './LangChainAIService';
import { PromptRegistry } from '../../domain/prompts/PromptRegistry';

export interface AIServiceConfig {
  azureEndpoint?: string;
  azureKey?: string;
  azureDeployment?: string;
  ollamaEndpoint?: string;
  defaultProvider: 'azure' | 'ollama';
  promptsPath: string; // Path to enterprise/prompts
}

export interface CompletionResult {
  text: string;
  tokensUsed?: number;
  provider: 'azure' | 'ollama';
  model: string;
  finishReason: string;
}

export class AIService {
  private langChainService: LangChainAIService;
  private promptRegistry: PromptRegistry;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.langChainService = new LangChainAIService();
    this.promptRegistry = new PromptRegistry(config.promptsPath);
  }

  /**
   * Complete a prompt (non-streaming)
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    // Build AI config for LangChainAIService
    const aiConfig = this.buildAIConfig(options);
    
    // Use LangChainAIService's methods
    // ... delegate to langChainService
  }

  /**
   * Stream completion tokens
   */
  async *streamComplete(prompt: string, options?: CompletionOptions): AsyncGenerator<string> {
    // Delegate to langChainService.assistStream
    // ... yield tokens
  }

  /**
   * Load a prompt template and render with variables
   */
  async loadPrompt(name: string, variables?: Record<string, string>): Promise<string> {
    const template = await this.promptRegistry.loadPrompt(name);
    return variables ? this.promptRegistry.renderPrompt(template, variables) : template.content;
  }

  /**
   * Test provider connection
   */
  async testProvider(provider: 'azure' | 'ollama'): Promise<boolean> {
    // Use langChainService.testConnection
  }

  /**
   * Estimate tokens (rough heuristic: ~4 chars = 1 token)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private buildAIConfig(options?: CompletionOptions) {
    // Convert AIServiceConfig to LangChainAIService's AIConfig format
  }
}
```

**Key Points**:
- Wraps, doesn't replace LangChainAIService
- Integrates PromptRegistry for template loading
- Provides simpler interface for common operations
- Handles both Azure OpenAI and Ollama

---

### 2. EnterpriseService (High-level orchestration)

**File**: `src/main/services/EnterpriseService.ts`

**Purpose**: Orchestrates all enterprise operations by coordinating:
- GitService (clone, pull enterprise repo)
- GitHubService (discover repos)
- AIService (spec derivation)
- ConstitutionMerger (merge constitutions)
- PromptRegistry (load prompts)

**Implementation Outline**:
```typescript
import { app } from 'electron';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { GitService } from './GitService';
import { GitHubService } from './GitHubService';
import { AIService } from './AIService';
import { ConstitutionMerger } from '../../domain/enterprise/ConstitutionMerger';
import { PromptRegistry } from '../../domain/prompts/PromptRegistry';
import type {
  EnterpriseConfig,
  EnterpriseRepoInfo,
  EnterpriseRepoStatus,
  DeriveSpecRequest,
  DeriveSpecResult,
  MergedConstitution,
} from '../types/enterprise';

export class EnterpriseService {
  private gitService: typeof GitService; // Static methods
  private githubService: GitHubService;
  private aiService: AIService;
  private constitutionMerger: ConstitutionMerger;
  private configPath: string;

  constructor(
    githubService: GitHubService,
    aiService: AIService
  ) {
    this.gitService = GitService;
    this.githubService = githubService;
    this.aiService = aiService;
    this.constitutionMerger = new ConstitutionMerger();
    
    // Store config in userData
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'enterprise-config.json');
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  async getConfig(): Promise<EnterpriseConfig> {
    if (!existsSync(this.configPath)) {
      return {}; // Empty config
    }
    
    const content = await readFile(this.configPath, 'utf-8');
    return JSON.parse(content);
  }

  async setConfig(config: Partial<EnterpriseConfig>): Promise<void> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    
    await writeFile(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
    
    // Update dependent services
    if (config.gheOrg || config.enterpriseSpecsRepo) {
      // Trigger sync if needed
    }
  }

  // ============================================================================
  // Enterprise Repo Management
  // ============================================================================

  async getEnterpriseRepoPath(): Promise<string | null> {
    const config = await this.getConfig();
    if (!config.enterpriseSpecsRepo) {
      return null;
    }
    
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'enterprise-specs');
  }

  async syncEnterpriseRepo(): Promise<void> {
    const config = await this.getConfig();
    if (!config.gheOrg || !config.enterpriseSpecsRepo) {
      throw new Error('Enterprise configuration not set');
    }

    const targetPath = await this.getEnterpriseRepoPath();
    if (!targetPath) {
      throw new Error('Cannot determine enterprise repo path');
    }

    // Check if already cloned
    const isGitRepo = existsSync(path.join(targetPath, '.git'));
    
    if (isGitRepo) {
      // Pull latest
      const git = new this.gitService(targetPath);
      await git.pull();
    } else {
      // Clone
      const repoUrl = `https://github.com/${config.gheOrg}/${config.enterpriseSpecsRepo}.git`;
      await this.gitService.clone(repoUrl, targetPath); // Need static clone method
    }
  }

  async getEnterpriseRepoStatus(): Promise<EnterpriseRepoStatus> {
    const repoPath = await this.getEnterpriseRepoPath();
    
    if (!repoPath || !existsSync(repoPath)) {
      return {
        cloned: false,
        branch: '',
        hasChanges: false,
      };
    }

    const git = new this.gitService(repoPath);
    const status = await git.getStatus();
    const branches = await git.getBranches();

    return {
      cloned: true,
      path: repoPath,
      branch: branches.current,
      hasChanges: status.modified.length > 0 || status.created.length > 0,
      lastSync: new Date().toISOString(), // TODO: track real sync time
    };
  }

  // ============================================================================
  // Repository Discovery
  // ============================================================================

  async listEnterpriseRepos(): Promise<EnterpriseRepoInfo[]> {
    const config = await this.getConfig();
    if (!config.gheOrg) {
      return [];
    }

    const repos = await this.githubService.listOrgRepos(config.gheOrg);
    
    // Check each repo for constitution and specs
    const repoInfo = await Promise.all(
      repos.map(async (repo) => {
        const [owner, name] = repo.fullName.split('/');
        const features = await this.detectRepoFeatures(owner, name);
        
        return {
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          defaultBranch: repo.defaultBranch,
          url: repo.htmlUrl,
          hasConstitution: features.hasConstitution,
          hasSpecs: features.hasSpecs,
          constitutionPath: features.hasConstitution ? 'constitution.md' : undefined,
          specsPath: features.hasSpecs ? 'specs/' : undefined,
          lastUpdated: repo.updatedAt,
        };
      })
    );

    return repoInfo;
  }

  private async detectRepoFeatures(owner: string, repo: string): Promise<{
    hasConstitution: boolean;
    hasSpecs: boolean;
  }> {
    const [hasConstitution, hasSpecs] = await Promise.all([
      this.githubService.hasFile(owner, repo, 'constitution.md'),
      this.githubService.hasFile(owner, repo, 'specs/'),
    ]);

    return { hasConstitution, hasSpecs };
  }

  // ============================================================================
  // Spec Derivation
  // ============================================================================

  async deriveSpec(request: DeriveSpecRequest): Promise<DeriveSpecResult> {
    const startTime = Date.now();

    try {
      // Load prompt template
      const prompt = await this.aiService.loadPrompt('derive-spec', {
        repoPath: request.repoPath,
        constitutionPath: request.constitutionPath || 'N/A',
        includeTests: request.includeTests.toString(),
        includeDocs: request.includeDocs.toString(),
        projectName: path.basename(request.repoPath),
      });

      // TODO: Add code analysis context to prompt
      // This would involve reading the repo structure and key files

      // Call AI service
      const result = await this.aiService.complete(prompt, {
        provider: request.provider,
      });

      // Save spec to repo
      const specPath = path.join(
        request.repoPath,
        'specs',
        `derived-${new Date().toISOString().split('T')[0]}.md`
      );
      await writeFile(specPath, result.text, 'utf-8');

      return {
        success: true,
        specPath,
        spec: result.text,
        tokensUsed: result.tokensUsed,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // Constitution Operations
  // ============================================================================

  async getEffectiveConstitution(localRepoPath: string): Promise<MergedConstitution> {
    // Load global constitution from enterprise repo
    const enterpriseRepoPath = await this.getEnterpriseRepoPath();
    if (!enterpriseRepoPath) {
      throw new Error('Enterprise repo not synced');
    }

    const globalPath = path.join(enterpriseRepoPath, 'constitution.md');
    const localPath = path.join(localRepoPath, 'constitution.md');

    // Read both files
    const globalContent = existsSync(globalPath)
      ? await readFile(globalPath, 'utf-8')
      : '';
    const localContent = existsSync(localPath)
      ? await readFile(localPath, 'utf-8')
      : '';

    // Parse
    const globalSections = this.constitutionMerger.parseConstitution(globalContent, 'global');
    const localSections = localContent
      ? this.constitutionMerger.parseConstitution(localContent, 'local')
      : [];

    // Merge
    const merged = this.constitutionMerger.merge(globalSections, localSections);
    merged.globalPath = globalPath;
    merged.localPath = localPath;

    return merged;
  }
}
```

**Key Points**:
- Coordinates all services
- Manages enterprise config persistence
- Handles enterprise repo sync (clone/pull)
- Discovers repos and detects features
- Orchestrates spec derivation with AI
- Merges constitutions

---

### 3. GitService Refactor

**File**: `src/main/services/GitService.ts` (UPDATE)

**Changes Needed**:
Add static methods for operations that don't need a specific repo instance:

```typescript
export class GitService {
  // ... existing instance methods ...

  /**
   * Clone a repository (static - no instance needed)
   */
  static async clone(url: string, targetPath: string): Promise<void> {
    try {
      const git = simpleGit();
      await git.clone(url, targetPath);
    } catch (error) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to clone repository',
        'clone',
        { url, targetPath }
      );
    }
  }

  /**
   * Check if a path is a git repository (static)
   */
  static async isGitRepo(repoPath: string): Promise<boolean> {
    try {
      const git = simpleGit(repoPath);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new git repository (static)
   */
  static async init(repoPath: string): Promise<void> {
    try {
      const git = simpleGit(repoPath);
      await git.init();
    } catch (error) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to initialize git repository',
        'init',
        { repoPath }
      );
    }
  }

  /**
   * Get remote URL (instance method to add)
   */
  async getRemoteUrl(remote = 'origin'): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const targetRemote = remotes.find(r => r.name === remote);
      return targetRemote?.refs.fetch || null;
    } catch (error) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to get remote URL',
        'get-remote',
        { remote }
      );
    }
  }

  /**
   * Get last commit info (instance method to add)
   */
  async getLastCommit(): Promise<CommitInfo> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      const latest = log.latest;
      
      if (!latest) {
        throw new Error('No commits found');
      }

      return {
        hash: latest.hash,
        message: latest.message,
        author: latest.author_name,
        email: latest.author_email,
        date: latest.date,
      };
    } catch (error) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to get last commit',
        'get-commit'
      );
    }
  }
}

// Add CommitInfo interface
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
}
```

---

## Next Actions

1. **Implement AIService** - Wrapper with PromptRegistry integration
2. **Implement EnterpriseService** - High-level orchestration
3. **Refactor GitService** - Add static methods and missing instance methods
4. **Write unit tests** for all three services

Once Phase 1 services are complete, we move to Phase 2: IPC Layer.

---

**Estimated Work**: 2-3 more sessions to complete Phase 1 with tests
**Token Usage**: ~40K tokens remaining for Phase 1
**Complexity**: Medium - well-defined interfaces, mostly coordination logic
