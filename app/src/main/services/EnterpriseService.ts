/**
 * EnterpriseService - High-level orchestration for enterprise spec operations
 * 
 * Coordinates GitService, GitHubService, AIService, and domain logic to provide
 * enterprise-wide spec-driven development features.
 */

import { app } from 'electron';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { GitService } from './GitService';
import { GitHubService } from './GitHubService';
import { AIService } from './AIService';
import { ConstitutionMerger } from '../../../domain/enterprise/ConstitutionMerger';
import type {
  EnterpriseConfig,
  EnterpriseRepoInfo,
  EnterpriseRepoStatus,
  DeriveSpecRequest,
  DeriveSpecResult,
  MergedConstitution,
  PromptTemplate,
} from '../../types/enterprise';

/**
 * Enterprise Service for spec-driven development operations
 */
export class EnterpriseService {
  private githubService: GitHubService;
  private aiService: AIService;
  private constitutionMerger: ConstitutionMerger;
  private configPath: string;

  constructor(
    githubService: GitHubService,
    aiService: AIService
  ) {
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

  /**
   * Get enterprise configuration
   */
  async getConfig(): Promise<EnterpriseConfig> {
    if (!existsSync(this.configPath)) {
      return {}; // Empty config
    }
    
    const content = await readFile(this.configPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Set enterprise configuration
   */
  async setConfig(config: Partial<EnterpriseConfig>): Promise<void> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    
    // Ensure parent directory exists
    const configDir = path.dirname(this.configPath);
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }

    await writeFile(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  // ============================================================================
  // Enterprise Repo Management
  // ============================================================================

  /**
   * Get path to enterprise-specs repository
   */
  async getEnterpriseRepoPath(): Promise<string | null> {
    const config = await this.getConfig();
    if (!config.enterpriseSpecsRepo) {
      return null;
    }
    
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'enterprise-specs');
  }

  /**
   * Sync enterprise-specs repository (clone or pull)
   */
  async syncEnterpriseRepo(): Promise<void> {
    const config = await this.getConfig();
    if (!config.gheOrg || !config.enterpriseSpecsRepo) {
      throw new Error('Enterprise configuration not set (gheOrg and enterpriseSpecsRepo required)');
    }

    const targetPath = await this.getEnterpriseRepoPath();
    if (!targetPath) {
      throw new Error('Cannot determine enterprise repo path');
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(targetPath);
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }

    // Check if already cloned
    const isGitRepo = existsSync(path.join(targetPath, '.git'));
    
    if (isGitRepo) {
      // Pull latest
      const git = new GitService(targetPath);
      await git.pull();
    } else {
      // Clone
      const repoUrl = `https://github.com/${config.gheOrg}/${config.enterpriseSpecsRepo}.git`;
      await GitService.clone(repoUrl, targetPath);
    }
  }

  /**
   * Get enterprise repository status
   */
  async getEnterpriseRepoStatus(): Promise<EnterpriseRepoStatus> {
    const repoPath = await this.getEnterpriseRepoPath();
    
    if (!repoPath || !existsSync(repoPath)) {
      return {
        cloned: false,
        branch: '',
        hasChanges: false,
      };
    }

    const git = new GitService(repoPath);
    const status = await git.getStatus();
    const branches = await git.getBranches();

    return {
      cloned: true,
      path: repoPath,
      branch: branches.current,
      hasChanges: status.modified.length > 0 || status.created.length > 0,
      lastSync: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Repository Discovery
  // ============================================================================

  /**
   * List all repositories in the enterprise organization
   */
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

  /**
   * Detect if a repository has constitution and/or specs
   */
  private async detectRepoFeatures(owner: string, repo: string): Promise<{
    hasConstitution: boolean;
    hasSpecs: boolean;
  }> {
    const [hasConstitution, hasSpecs] = await Promise.all([
      this.githubService.hasFile(owner, repo, 'constitution.md'),
      this.githubService.hasFile(owner, repo, 'specs'),
    ]);

    return { hasConstitution, hasSpecs };
  }

  // ============================================================================
  // Spec Derivation
  // ============================================================================

  /**
   * Derive specification from code using AI
   */
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
      // For now, we just use the prompt as-is

      // Call AI service
      const result = await this.aiService.complete(prompt, {
        provider: request.provider,
      });

      // Ensure specs directory exists
      const specsDir = path.join(request.repoPath, 'specs');
      if (!existsSync(specsDir)) {
        await mkdir(specsDir, { recursive: true });
      }

      // Save spec to repo
      const specPath = path.join(
        specsDir,
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

  /**
   * Get effective constitution by merging global and local
   */
  async getEffectiveConstitution(localRepoPath: string): Promise<MergedConstitution> {
    // Load global constitution from enterprise repo
    const enterpriseRepoPath = await this.getEnterpriseRepoPath();
    if (!enterpriseRepoPath || !existsSync(enterpriseRepoPath)) {
      throw new Error('Enterprise repo not synced. Please sync the enterprise-specs repository first.');
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

    if (!globalContent) {
      throw new Error('Global constitution not found in enterprise repo');
    }

    // Parse
    const globalSections = this.constitutionMerger.parseConstitution(globalContent, 'global');
    const localSections = localContent
      ? this.constitutionMerger.parseConstitution(localContent, 'local')
      : [];

    // Merge
    const merged = this.constitutionMerger.merge(globalSections, localSections);
    merged.globalPath = globalPath;
    merged.localPath = localContent ? localPath : undefined;

    return merged;
  }

  // ============================================================================
  // Prompt Operations
  // ============================================================================

  /**
   * List available prompts from enterprise repo
   */
  async listPrompts(): Promise<PromptTemplate[]> {
    const enterpriseRepoPath = await this.getEnterpriseRepoPath();
    if (!enterpriseRepoPath) {
      return [];
    }

    const promptNames = await this.aiService.listPrompts();
    
    // Load all prompts to get full template info
    const prompts = await Promise.all(
      promptNames.map(async (name) => {
        // Use AIService's loadPrompt which uses PromptRegistry internally
        // We need to access the PromptRegistry to get the full template
        // For now, return minimal info
        return {
          name,
          path: path.join(enterpriseRepoPath, 'prompts', `${name}.md`),
          content: '', // Would need to load to get full content
          variables: [], // Would need to load to extract
        };
      })
    );

    return prompts;
  }

  /**
   * Get a specific prompt template
   */
  async getPrompt(name: string): Promise<PromptTemplate> {
    const enterpriseRepoPath = await this.getEnterpriseRepoPath();
    if (!enterpriseRepoPath) {
      throw new Error('Enterprise repo not synced');
    }

    const promptPath = path.join(enterpriseRepoPath, 'prompts', `${name}.md`);
    if (!existsSync(promptPath)) {
      throw new Error(`Prompt "${name}" not found`);
    }

    const content = await readFile(promptPath, 'utf-8');
    
    // Extract variables (simple regex for {{var}})
    const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return {
      name,
      path: promptPath,
      content,
      variables,
    };
  }
}
