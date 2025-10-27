import { existsSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

export interface SpecifyOptions {
  repoPath: string;
  description: string;
}

export interface PlanOptions {
  repoPath: string;
  specPath: string;
  techStack?: string[];
}

export interface TasksOptions {
  repoPath: string;
  planPath: string;
}

export interface ToEntityOptions {
  repoPath: string;
  specPath: string;
  options?: {
    createFeature?: boolean;
    createStories?: boolean;
  };
}

export interface TasksToEntityOptions {
  repoPath: string;
  tasksPath: string;
}

export interface AIGenerateSpecOptions {
  repoPath: string;
  description: string;
}

export interface AIRefineSpecOptions {
  repoPath: string;
  specPath: string;
  feedback: string;
}

/**
 * Service for Speckit (Specification-Driven Development) workflow operations
 */
export class SpeckitService {
  /**
   * Check if a pipeline exists in the repository
   */
  private checkPipelineExists(repoPath: string, pipelineFile: string): void {
    const pipelinePath = path.join(repoPath, '.context', 'pipelines', pipelineFile);
    if (!existsSync(pipelinePath)) {
      throw new Error(`${pipelineFile} pipeline not found. Please ensure the pipeline is installed.`);
    }
  }

  /**
   * Execute a pipeline and return parsed JSON output
   */
  private async executePipeline(repoPath: string, pipelineFile: string, args: string[]): Promise<any> {
    const pipelinePath = path.join(repoPath, '.context', 'pipelines', pipelineFile);
    const result = await execa('node', [pipelinePath, ...args], {
      cwd: repoPath
    });
    return JSON.parse(result.stdout);
  }

  /**
   * Generate a specification from a description
   * Creates a structured specification document using the SDD workflow
   */
  async specify(options: SpecifyOptions): Promise<any> {
    const { repoPath, description } = options;
    this.checkPipelineExists(repoPath, 'speckit.mjs');
    return await this.executePipeline(repoPath, 'speckit.mjs', ['specify', description]);
  }

  /**
   * Create an implementation plan from a specification
   * Generates a step-by-step plan for implementing the specification
   */
  async plan(options: PlanOptions): Promise<any> {
    const { repoPath, specPath } = options;
    this.checkPipelineExists(repoPath, 'speckit.mjs');
    return await this.executePipeline(repoPath, 'speckit.mjs', ['plan', specPath]);
  }

  /**
   * Generate tasks from an implementation plan
   * Breaks down the plan into actionable development tasks
   */
  async tasks(options: TasksOptions): Promise<any> {
    const { repoPath, planPath } = options;
    this.checkPipelineExists(repoPath, 'speckit.mjs');
    return await this.executePipeline(repoPath, 'speckit.mjs', ['tasks', planPath]);
  }

  /**
   * Convert a specification to context entities (feature, stories, etc.)
   * Transforms a spec document into structured YAML entities
   */
  async toEntity(options: ToEntityOptions): Promise<any> {
    const { repoPath, specPath } = options;
    this.checkPipelineExists(repoPath, 'spec-entity.mjs');
    return await this.executePipeline(repoPath, 'spec-entity.mjs', ['spec', specPath]);
  }

  /**
   * Convert tasks to context entities
   * Transforms task documents into structured YAML task entities
   */
  async tasksToEntity(options: TasksToEntityOptions): Promise<any> {
    const { repoPath, tasksPath } = options;
    this.checkPipelineExists(repoPath, 'spec-entity.mjs');
    return await this.executePipeline(repoPath, 'spec-entity.mjs', ['tasks', tasksPath]);
  }

  /**
   * Generate a specification using AI
   * Uses AI to create a comprehensive specification from a description
   */
  async aiGenerateSpec(options: AIGenerateSpecOptions): Promise<any> {
    const { repoPath, description } = options;
    this.checkPipelineExists(repoPath, 'ai-spec-generator.mjs');
    return await this.executePipeline(repoPath, 'ai-spec-generator.mjs', ['generate', description]);
  }

  /**
   * Refine an existing specification using AI feedback
   * Uses AI to improve or modify an existing specification based on feedback
   */
  async aiRefineSpec(options: AIRefineSpecOptions): Promise<any> {
    const { repoPath, specPath, feedback } = options;
    this.checkPipelineExists(repoPath, 'ai-spec-generator.mjs');
    
    const fullSpecPath = path.join(repoPath, specPath);
    return await this.executePipeline(repoPath, 'ai-spec-generator.mjs', ['refine', fullSpecPath, feedback]);
  }
}
