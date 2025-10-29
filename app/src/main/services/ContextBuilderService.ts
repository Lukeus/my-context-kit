import { app } from 'electron';
import { readdir, readFile, writeFile, mkdir, access, cp } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { simpleGit } from 'simple-git';
import { createHash } from 'node:crypto';

export interface GetSuggestionsOptions {
  dir: string;
  command: string;
  params: any[];
}

export interface GetTemplatesOptions {
  dir: string;
  entityType?: string;
}

export interface ScaffoldNewRepoOptions {
  dir: string;
  repoName: string;
  projectPurpose?: string;
  constitutionSummary?: string;
}

export interface Template {
  filename: string;
  entityType?: string;
  content: any;
  [key: string]: any;
}

export interface ScaffoldResult {
  path: string;
  warning?: string;
}

/**
 * Service for Context Builder operations (suggestions, templates, scaffolding)
 */
export class ContextBuilderService {
  private toPosixPath(target: string): string {
    return target.replace(/\\/g, '/');
  }

  private renderYaml(value: unknown): string {
    const rendered = stringifyYAML(value as any);
    if (typeof rendered === 'string' && rendered.length > 0) {
      return rendered;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  /**
   * Resolve the path to the context template directory
   */
  private async resolveContextTemplatePath(): Promise<{ path: string | null; candidates: string[] }> {
    if (!app.isReady()) {
      await app.whenReady();
    }

    const appPath = app.getAppPath();
    const cwd = process.cwd();
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const explicitPath = process.env.CONTEXT_REPO_TEMPLATE_DIR ? path.resolve(process.env.CONTEXT_REPO_TEMPLATE_DIR) : null;
    const resourcesBase = typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0
      ? process.resourcesPath
      : appPath;

    const devRoots = [
      appPath,
      path.resolve(appPath, '..'),
      path.resolve(appPath, '..', '..'),
      path.resolve(appPath, '..', '..', '..'),
      cwd,
      path.resolve(cwd, '..'),
      path.resolve(cwd, '..', '..'),
    ];

    const prodRoots = [
      path.join(resourcesBase, 'context-repo-template'),
      path.join(appPath, 'context-repo-template'),
    ];

    const candidateSet = new Set<string>();
    if (explicitPath) {
      candidateSet.add(explicitPath);
    }

    if (isDev) {
      for (const root of devRoots) {
        candidateSet.add(path.join(root, 'context-repo'));
        candidateSet.add(path.join(root, 'context-repo-template'));
      }
    } else {
      for (const root of prodRoots) {
        candidateSet.add(root);
      }
    }

    const candidatePaths = Array.from(candidateSet);

    for (const candidate of candidatePaths) {
      try {
        await access(this.toPosixPath(path.join(candidate, '.context')));
        return { path: candidate, candidates: candidatePaths };
      } catch {
        // continue searching other candidates
      }
    }

    return { path: candidatePaths[0] ?? null, candidates: candidatePaths };
  }

  /**
   * Copy a file or directory if it exists
   */
  private async copyIfExists(
    source: string,
    destination: string,
    options?: Parameters<typeof cp>[2]
  ): Promise<'copied' | 'missing' | 'failed'> {
    const normalizedSource = this.toPosixPath(source);
    const normalizedDestination = this.toPosixPath(destination);

    try {
      await access(normalizedSource);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return 'missing';
      }
      throw error;
    }

    try {
      await cp(normalizedSource, normalizedDestination, options);
      return 'copied';
    } catch (error) {
      console.warn(`Failed to copy template resource from ${source} to ${destination}`, error);
      return 'failed';
    }
  }

  /**
   * Ensure a template file exists with default content
   */
  private async ensureTemplateFile(filePath: string, content: string): Promise<void> {
    const normalizedPath = this.toPosixPath(filePath);
    try {
      await access(normalizedPath);
    } catch {
      await writeFile(normalizedPath, content, 'utf-8');
    }
  }

  /**
   * Get context suggestions by running the context-builder pipeline
   */
  async getSuggestions(options: GetSuggestionsOptions): Promise<any> {
    const { dir, command, params } = options;

    // Base64-encode any JSON objects to avoid Windows shell quote escaping issues
    const encodedParams = params.map(param => {
      if (typeof param === 'object') {
        return Buffer.from(JSON.stringify(param)).toString('base64');
      }
      return param;
    });

    const args = [path.join(dir, '.context', 'pipelines', 'context-builder.mjs'), command, ...encodedParams];
    const result = await execa('node', args, {
      cwd: dir
    });
    return JSON.parse(result.stdout);
  }

  /**
   * Get available entity templates
   */
  async getTemplates(options: GetTemplatesOptions): Promise<Template[]> {
    const { dir, entityType } = options;
    const templatesDirFs = path.join(dir, '.context', 'templates', 'builder');
    const templatesDir = this.toPosixPath(templatesDirFs);

    const files = await readdir(templatesDir);
    const templates: Template[] = [];

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = await readFile(this.toPosixPath(path.join(templatesDirFs, file)), 'utf-8');
          const data = parseYAML(content);

          // Extract template metadata
          if (data._template) {
            const template: Template = {
              filename: file,
              ...data._template,
              content: data
            };

            // Filter by entity type if specified
            if (!entityType || template.entityType === entityType) {
              templates.push(template);
            }
          }
        } catch (parseError) {
          console.error(`Failed to parse template ${file}:`, parseError);
        }
      }
    }

    return templates;
  }

  /**
   * Scaffold a new context repository with full structure
   */
  async scaffoldNewRepo(options: ScaffoldNewRepoOptions): Promise<ScaffoldResult> {
    const { dir, repoName, projectPurpose, constitutionSummary } = options;
    const targetDir = path.join(dir, repoName);
    const targetDirDisplay = this.toPosixPath(targetDir);

    // Check if directory already exists
    try {
      await access(this.toPosixPath(targetDir));
      throw new Error('Directory already exists');
    } catch (error: any) {
      if (error.message === 'Directory already exists') {
        throw error;
      }
      // Directory doesn't exist, which is what we want
    }

    // Resolve template source directory (handles dev/prod differences)
    const { path: resolvedTemplatePath, candidates: templateCandidates } = await this.resolveContextTemplatePath();
    let templateSourcePath = resolvedTemplatePath;

    if (!templateSourcePath) {
      console.warn(`Context repo template not found. Checked paths: ${templateCandidates.join(', ')}`);
      templateSourcePath = templateCandidates[0] ?? path.join(process.cwd(), 'context-repo-template');
      // Note: Minimal embedded template can be added if template distribution becomes unreliable.
      // Current approach requires template availability at known paths for repo scaffolding.
    }

    const templateSourceFs = this.toPosixPath(templateSourcePath);

    // Create target directory
    await mkdir(this.toPosixPath(targetDir), { recursive: true });

    // Create required folder structure
    const requiredDirs = [
      '.context',
      '.context/rules',
      '.context/schemas',
      '.context/templates',
      'contexts',
      'contexts/features',
      'contexts/governance',
      'contexts/packages',
      'contexts/services',
      'contexts/specs',
      'contexts/tasks',
      'contexts/userstories',
      'generated',
      'generated/docs',
      'generated/prompts',
      'generated/docs/impact',
    ];

    for (const dirName of requiredDirs) {
      await mkdir(this.toPosixPath(path.join(targetDir, dirName)), { recursive: true });
    }

    // Copy entire pipelines directory
    const pipelinesSource = path.join(templateSourceFs, '.context', 'pipelines');
    const pipelinesDest = path.join(targetDir, '.context', 'pipelines');
    const pipelinesCopyResult = await this.copyIfExists(pipelinesSource, pipelinesDest, { recursive: true });
    if (pipelinesCopyResult === 'failed') {
      throw new Error('Template pipelines directory could not be copied.');
    }
    if (pipelinesCopyResult === 'missing') {
      console.warn('Pipeline templates were not found; creating empty pipelines directory.');
      await mkdir(this.toPosixPath(pipelinesDest), { recursive: true });
    }

    // Copy template directories dynamically
    const templatesRoot = path.join(templateSourceFs, '.context', 'templates');
    let templateDirs: string[] = [];
    try {
      const entries = await readdir(this.toPosixPath(templatesRoot), { withFileTypes: true });
      templateDirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
    } catch (error) {
      console.warn('Failed to enumerate template directories:', error);
    }

    if (templateDirs.length === 0) {
      templateDirs = ['builder', 'prompts', 'sdd'];
    }

    for (const templateDir of templateDirs) {
      const sourcePath = path.join(templatesRoot, templateDir);
      const destPath = path.join(targetDir, '.context', 'templates', templateDir);
      const result = await this.copyIfExists(sourcePath, destPath, { recursive: true });
      if (result === 'missing') {
        console.warn(`Template directory ${templateDir} is missing in ${templateSourcePath}`);
        await mkdir(this.toPosixPath(destPath), { recursive: true });
      } else if (result === 'failed') {
        console.warn(`Failed to copy template directory ${templateDir} from ${sourcePath}`);
      }
    }

    // Ensure SDD templates exist for Speckit workflows
    const sddTemplateDir = path.join(targetDir, '.context', 'templates', 'sdd');
    await mkdir(this.toPosixPath(sddTemplateDir), { recursive: true });

    await this.ensureTemplateFile(this.toPosixPath(path.join(sddTemplateDir, 'feature-spec-template.md')), `# Feature Specification: {{description}}

**Spec Number**: {{number}}  
**Branch**: \`{{branchName}}\`  
**Date**: {{date}}

## Overview

Describe the intent and context for this feature.

## User Stories

- As a persona, I want capability, so that benefit.

## Acceptance Criteria

- Criterion describing observable outcome.

## Constraints & Assumptions

- Outline any constraints, assumptions, or integrations.
`);

    await this.ensureTemplateFile(this.toPosixPath(path.join(sddTemplateDir, 'implementation-plan-template.md')), `# Implementation Plan: {{specNumber}}

**Spec Title**: {{specTitle}}
**Tech Stack**: {{techStack}}
**Date**: {{date}}

## Milestones

- [ ] Define architecture decisions
- [ ] Implement core flows
- [ ] Validate against constitutional gates

## Dependencies

- List upstream/downstream dependencies

## Risks & Mitigations

- Risk: ...
- Mitigation: ...
`);

    await this.ensureTemplateFile(this.toPosixPath(path.join(sddTemplateDir, 'task-list-template.md')), `# Task List for Spec {{specNumber}}

Generated on {{date}}

## Tasks

{{taskList}}

## Parallelization Notes

- Group related tasks to run concurrently when feasible.
`);

    // Copy schema files
    const schemaCopyResult = await this.copyIfExists(
      path.join(templateSourceFs, '.context', 'schemas'),
      path.join(targetDir, '.context', 'schemas'),
      { recursive: true }
    );
    if (schemaCopyResult === 'missing') {
      console.warn('Schema templates were not found in the source template. Generated repo will contain empty schemas directory.');
    }

    // Copy package.json for dependencies
    const packageResult = await this.copyIfExists(
      path.join(templateSourceFs, 'package.json'),
      path.join(targetDir, 'package.json')
    );
    if (packageResult === 'missing') {
      console.warn('Template package.json was not found; generated repo will be missing dependency metadata.');
    }

    const optionalTemplateFiles = ['pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc'];
    for (const filename of optionalTemplateFiles) {
      await this.copyIfExists(
        path.join(templateSourceFs, filename),
        path.join(targetDir, filename)
      );
    }

    // Create a default README.md
    const readmeContent = `# ${repoName}

This is a Context-Kit repository for managing project context, specifications, and relationships.

## Structure

- \`contexts/\` - YAML entities (features, user stories, specs, tasks, services, packages, governance)
- \`.context/pipelines/\` - Automation scripts for validation, graph building, and impact analysis
- \`.context/templates/\` - Handlebars templates for code generation
- \`generated/\` - Auto-generated documentation and prompts

## Getting Started

1. Install dependencies: \`npm install\`
2. Add your first entities in \`contexts/\`
3. Open in Context-Kit app to visualize and manage

## Governance

Create a constitution in \`contexts/governance/constitution.yaml\` to define principles and compliance rules.
`;
    await writeFile(this.toPosixPath(path.join(targetDir, 'README.md')), readmeContent, 'utf-8');

    // Create .gitignore
    const gitignoreContent = `node_modules/
generated/
.env
*.log
`;
    await writeFile(this.toPosixPath(path.join(targetDir, '.gitignore')), gitignoreContent, 'utf-8');

    // Create constitution file if summary provided
    if (constitutionSummary && constitutionSummary.trim()) {
      const constitution: any = {
        id: `CONST-${repoName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`,
        name: `${repoName} Constitution`,
        version: '1.0.0',
        status: 'draft',
        ratifiedOn: new Date().toISOString().split('T')[0],
        summary: constitutionSummary.trim(),
        ...(projectPurpose && projectPurpose.trim() ? { purpose: projectPurpose.trim() } : {}),
        principles: [
          {
            id: 'core-principle',
            title: 'Core Principle',
            summary: 'Placeholder principle - replace with your project-specific principles',
            appliesTo: ['global'],
            nonNegotiable: false,
            requirements: []
          }
        ],
        governance: {
          owners: ['@team'],
          reviewCadence: 'quarterly',
          changeControl: 'Updates require approval and documentation'
        },
        compliance: {
          rules: [
            {
              id: 'placeholder-rule',
              description: 'Placeholder rule - replace with your project-specific compliance rules',
              targets: ['global'],
              conditions: [
                {
                  path: 'id',
                  operator: 'exists',
                  message: 'All entities must have an ID'
                }
              ],
              severity: 'medium'
            }
          ],
          exceptions: []
        }
      };

      const constitutionYaml = this.renderYaml(constitution);
      const constitutionPath = path.join(targetDir, 'contexts', 'governance', 'constitution.yaml');

      // Write file first
      await writeFile(this.toPosixPath(constitutionPath), constitutionYaml, 'utf-8');

      // Generate checksum for the written file and add it
      const fileBuffer = await readFile(this.toPosixPath(constitutionPath));
      const checksum = createHash('sha256').update(fileBuffer).digest('hex');
      constitution.checksum = checksum;

      // Rewrite with checksum included
      const constitutionYamlWithChecksum = this.renderYaml(constitution);
      await writeFile(this.toPosixPath(constitutionPath), constitutionYamlWithChecksum, 'utf-8');
    }

    // Install dependencies so pipelines can execute immediately
    let installWarning: string | undefined;
    try {
      await execa('pnpm', ['install'], { cwd: targetDirDisplay });
    } catch (installError: any) {
      console.warn('Failed to install dependencies for new repo automatically.', installError);
      installWarning = 'Dependencies were not installed automatically. Run "pnpm install" inside the new repository before using pipelines.';
    }

    // Initialize git repository
    try {
      const git = simpleGit(targetDirDisplay);
      await git.init();
      await git.add('.');
      await git.commit('Initial commit: Scaffold context repository');
    } catch (err) {
      console.warn('Failed to initialize git repository:', err);
    }

    return { path: targetDirDisplay, warning: installWarning };
  }
}
