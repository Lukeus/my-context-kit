/**
 * GitHubService - GitHub API operations for enterprise repo management
 * 
 * Handles GitHub/GitHub Enterprise API calls for repository discovery,
 * file detection, and metadata retrieval.
 */

import { fetch } from 'undici';

export interface GitHubConfig {
  baseUrl: string; // e.g., 'https://api.github.com' or GHE URL
  token?: string;
  userAgent: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  url: string;
  htmlUrl: string;
  private: boolean;
  fork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  htmlUrl: string;
  gitUrl: string;
  downloadUrl: string | null;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string; // Base64 encoded for files
  encoding?: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

/**
 * GitHub API service for enterprise operations
 */
export class GitHubService {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<GitHubConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Build headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': this.config.userAgent,
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  /**
   * Make a GET request to GitHub API
   */
  private async get<T>(endpoint: string): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    return await response.json() as T;
  }

  /**
   * List all repositories in an organization
   */
  async listOrgRepos(org: string, perPage = 100): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await this.get<any[]>(`/orgs/${org}/repos?per_page=${perPage}&page=${page}`);
      
      if (data.length === 0) {
        hasMore = false;
      } else {
        repos.push(...data.map(this.normalizeRepo));
        page++;
        
        // Safety: stop after 10 pages (1000 repos)
        if (page > 10) {
          hasMore = false;
        }
      }
    }

    return repos;
  }

  /**
   * Get a single repository
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const data = await this.get<any>(`/repos/${owner}/${repo}`);
    return this.normalizeRepo(data);
  }

  /**
   * Get repository contents at a path
   */
  async getRepoContents(owner: string, repo: string, path: string, ref?: string): Promise<GitHubContent[]> {
    let endpoint = `/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {
      endpoint += `?ref=${ref}`;
    }

    const data = await this.get<any[]>(endpoint);
    return Array.isArray(data) ? data.map(this.normalizeContent) : [this.normalizeContent(data)];
  }

  /**
   * Check if a file exists in a repository
   */
  async hasFile(owner: string, repo: string, filePath: string, ref?: string): Promise<boolean> {
    try {
      let endpoint = `/repos/${owner}/${repo}/contents/${filePath}`;
      if (ref) {
        endpoint += `?ref=${ref}`;
      }
      
      await this.get<any>(endpoint);
      return true;
    } catch (error) {
      // 404 means file doesn't exist
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file content from a repository
   */
  async getFileContent(owner: string, repo: string, filePath: string, ref?: string): Promise<string> {
    let endpoint = `/repos/${owner}/${repo}/contents/${filePath}`;
    if (ref) {
      endpoint += `?ref=${ref}`;
    }

    const data = await this.get<any>(endpoint);
    
    if (data.type !== 'file') {
      throw new Error(`Path ${filePath} is not a file`);
    }

    if (!data.content || data.encoding !== 'base64') {
      throw new Error(`Unable to decode file content`);
    }

    // Decode base64 content
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  /**
   * Get default branch for a repository
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const repoData = await this.getRepo(owner, repo);
    return repoData.defaultBranch;
  }

  /**
   * List branches in a repository
   */
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    const data = await this.get<any[]>(`/repos/${owner}/${repo}/branches`);
    return data.map(branch => ({
      name: branch.name,
      commit: {
        sha: branch.commit.sha,
        url: branch.commit.url,
      },
      protected: branch.protected || false,
    }));
  }

  /**
   * Test connection to GitHub API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to get rate limit info (works for authenticated and unauthenticated)
      await this.get<any>('/rate_limit');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(): Promise<RateLimitInfo> {
    const data = await this.get<any>('/rate_limit');
    const core = data.resources.core;
    
    return {
      limit: core.limit,
      remaining: core.remaining,
      reset: core.reset,
      used: core.used,
    };
  }

  /**
   * Normalize GitHub API repo response
   */
  private normalizeRepo(data: any): GitHubRepo {
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      url: data.url,
      htmlUrl: data.html_url,
      private: data.private,
      fork: data.fork,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      pushedAt: data.pushed_at,
    };
  }

  /**
   * Normalize GitHub API content response
   */
  private normalizeContent(data: any): GitHubContent {
    return {
      name: data.name,
      path: data.path,
      sha: data.sha,
      size: data.size,
      url: data.url,
      htmlUrl: data.html_url,
      gitUrl: data.git_url,
      downloadUrl: data.download_url,
      type: data.type,
      content: data.content,
      encoding: data.encoding,
    };
  }
}
