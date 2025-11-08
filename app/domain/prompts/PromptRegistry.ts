/**
 * PromptRegistry - Framework-agnostic prompt template management
 * 
 * Loads and manages markdown-based prompt templates with variable substitution.
 * No dependencies on Electron, Vue, or any framework.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import type { PromptTemplate } from '../../src/types/enterprise';

/**
 * Registry for loading and managing prompt templates
 */
export class PromptRegistry {
  private templates: Map<string, PromptTemplate> = new Map();
  private lastLoaded: string | null = null;

  constructor(private readonly promptsPath: string) {}

  /**
   * Load a single prompt template by name
   */
  async loadPrompt(name: string): Promise<PromptTemplate> {
    // Check cache first
    const cached = this.templates.get(name);
    if (cached) {
      return cached;
    }

    // Load from disk
    const filePath = join(this.promptsPath, `${name}.md`);
    try {
      const content = await readFile(filePath, 'utf-8');
      const template: PromptTemplate = {
        name,
        path: filePath,
        content,
        variables: this.extractVariables(content),
        description: this.extractDescription(content),
      };

      // Cache it
      this.templates.set(name, template);
      return template;
    } catch (error) {
      throw new Error(`Failed to load prompt "${name}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load all prompt templates from the prompts directory
   */
  async loadAllPrompts(): Promise<Map<string, PromptTemplate>> {
    try {
      const files = await readdir(this.promptsPath);
      const mdFiles = files.filter(file => extname(file) === '.md');

      const loadPromises = mdFiles.map(async (file) => {
        const name = basename(file, '.md');
        return this.loadPrompt(name);
      });

      await Promise.all(loadPromises);
      this.lastLoaded = new Date().toISOString();
      
      return new Map(this.templates);
    } catch (error) {
      throw new Error(`Failed to load prompts from ${this.promptsPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reload all prompts (clears cache and reloads from disk)
   */
  async reloadPrompts(): Promise<void> {
    this.templates.clear();
    await this.loadAllPrompts();
  }

  /**
   * Render a prompt template with variable substitution
   */
  renderPrompt(template: PromptTemplate, variables: Record<string, string>): string {
    let rendered = template.content;

    // Replace all {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(pattern, value);
    }

    // Check for any remaining unsubstituted variables
    const remaining = this.extractVariables(rendered);
    if (remaining.length > 0) {
      console.warn(`Warning: Unsubstituted variables in prompt "${template.name}":`, remaining);
    }

    return rendered;
  }

  /**
   * Extract variable names from template content
   * Finds all {{variableName}} patterns
   */
  extractVariables(content: string): string[] {
    const variablePattern = /\{\{\s*(\w+)\s*\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1];
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Extract description from prompt markdown (first paragraph after heading)
   */
  private extractDescription(content: string): string | undefined {
    const lines = content.split('\n');
    let inDescription = false;
    const descriptionLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip heading
      if (trimmed.startsWith('#')) {
        inDescription = true;
        continue;
      }

      // Start capturing after heading
      if (inDescription) {
        // Stop at next heading or empty line after content
        if (trimmed.startsWith('#')) {
          break;
        }
        
        if (trimmed === '' && descriptionLines.length > 0) {
          break;
        }

        if (trimmed !== '') {
          descriptionLines.push(trimmed);
        }
      }
    }

    return descriptionLines.length > 0 ? descriptionLines.join(' ') : undefined;
  }

  /**
   * List all available prompt names
   */
  async listAvailablePrompts(): Promise<string[]> {
    try {
      const files = await readdir(this.promptsPath);
      return files
        .filter(file => extname(file) === '.md')
        .map(file => basename(file, '.md'));
    } catch (error) {
      throw new Error(`Failed to list prompts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a cached prompt (returns null if not loaded)
   */
  getPrompt(name: string): PromptTemplate | null {
    return this.templates.get(name) || null;
  }

  /**
   * Get all cached prompts
   */
  getAllPrompts(): Map<string, PromptTemplate> {
    return new Map(this.templates);
  }

  /**
   * Get the last load timestamp
   */
  getLastLoaded(): string | null {
    return this.lastLoaded;
  }

  /**
   * Check if a prompt exists (checks file system)
   */
  async promptExists(name: string): Promise<boolean> {
    const filePath = join(this.promptsPath, `${name}.md`);
    try {
      await readFile(filePath, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
