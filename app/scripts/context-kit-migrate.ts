#!/usr/bin/env node
/* eslint-disable */
/**
 * Context Kit Migration CLI
 * 
 * Scaffolds or migrates repositories to use the new .context-kit/ structure
 * while maintaining backward compatibility with .context/ assets.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationOptions {
  repoPath: string;
  mode: 'scaffold' | 'migrate';
  dryRun: boolean;
  verbose: boolean;
}

interface MigrationResult {
  success: boolean;
  filesCreated: string[];
  filesMigrated: string[];
  errors: string[];
  warnings: string[];
}

class ContextKitMigrator {
  private options: MigrationOptions;
  private result: MigrationResult;

  constructor(options: MigrationOptions) {
    this.options = options;
    this.result = {
      success: true,
      filesCreated: [],
      filesMigrated: [],
      errors: [],
      warnings: []
    };
  }

  /**
   * Main migration entry point
   */
  async migrate(): Promise<MigrationResult> {
    console.log(`\n🔄 Context Kit Migration Tool`);
    console.log(`Mode: ${this.options.mode}`);
    console.log(`Repo: ${this.options.repoPath}`);
    console.log(`Dry run: ${this.options.dryRun ? 'YES' : 'NO'}\n`);

    if (!existsSync(this.options.repoPath)) {
      this.result.errors.push(`Repository path does not exist: ${this.options.repoPath}`);
      this.result.success = false;
      return this.result;
    }

    const contextKitPath = join(this.options.repoPath, '.context-kit');
    const contextPath = join(this.options.repoPath, '.context');

    if (this.options.mode === 'scaffold') {
      await this.scaffold(contextKitPath);
    } else if (this.options.mode === 'migrate') {
      if (!existsSync(contextPath)) {
        this.result.warnings.push('No .context directory found. Using scaffold mode instead.');
        await this.scaffold(contextKitPath);
      } else {
        await this.migrateFromLegacy(contextPath, contextKitPath);
      }
    }

    this.printSummary();
    return this.result;
  }

  /**
   * Create new .context-kit/ structure from scratch
   */
  private async scaffold(contextKitPath: string): Promise<void> {
    console.log('📦 Scaffolding new .context-kit/ structure...\n');

    // Create directory structure
    const dirs = [
      contextKitPath,
      join(contextKitPath, 'schemas'),
      join(contextKitPath, 'spec-log'),
      join(contextKitPath, 'rag')
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        if (!this.options.dryRun) {
          mkdirSync(dir, { recursive: true });
        }
        this.result.filesCreated.push(dir);
        console.log(`  ✓ Created directory: ${dir}`);
      }
    }

    // Copy schema files from template
    const schemaTemplates = this.getSchemaTemplates();
    for (const [filename, content] of Object.entries(schemaTemplates)) {
      const targetPath = join(contextKitPath, 'schemas', filename);
      if (!existsSync(targetPath)) {
        if (!this.options.dryRun) {
          writeFileSync(targetPath, content);
        }
        this.result.filesCreated.push(targetPath);
        console.log(`  ✓ Created schema: ${filename}`);
      }
    }

    // Create default YAML files
    await this.createDefaultYAMLFiles(contextKitPath);

    // Create .gitignore for spec-log
    const gitignorePath = join(contextKitPath, 'spec-log', '.gitignore');
    const gitignoreContent = '# Ignore all spec log files\n*\n!.gitignore\n';
    if (!this.options.dryRun) {
      writeFileSync(gitignorePath, gitignoreContent);
    }
    this.result.filesCreated.push(gitignorePath);
    console.log(`  ✓ Created .gitignore for spec-log`);

    console.log('\n✅ Scaffolding complete!');
  }

  /**
   * Migrate from legacy .context/ to new .context-kit/ structure
   */
  private async migrateFromLegacy(contextPath: string, contextKitPath: string): Promise<void> {
    console.log('🔄 Migrating from .context/ to .context-kit/...\n');

    // First scaffold the base structure
    await this.scaffold(contextKitPath);

    // Migrate AI configuration
    const aiConfigPath = join(contextPath, 'ai-config.json');
    if (existsSync(aiConfigPath)) {
      console.log('  ⚠ Found ai-config.json - this should remain in .context/ for backward compatibility');
      this.result.warnings.push('ai-config.json not migrated - keeping in .context/');
    }

    // Migrate AI prompts to new prompts.yml structure
    const aiPromptsPath = join(contextPath, 'ai-prompts.json');
    if (existsSync(aiPromptsPath)) {
      await this.migrateAIPrompts(aiPromptsPath, contextKitPath);
    }

    // Migrate consistency rules
    const rulesPath = join(contextPath, 'rules', 'consistency.rules.yaml');
    if (existsSync(rulesPath)) {
      console.log('  ℹ Consistency rules remain in .context/rules/ for pipeline compatibility');
      this.result.warnings.push('Consistency rules not migrated - keeping in .context/rules/');
    }

    // Note about schemas
    console.log('\n  ℹ Entity schemas (feature, userstory, etc.) remain in .context/schemas/');
    console.log('  ℹ New .context-kit/schemas/ contains meta-schemas (project, stack, domains, prompts)');

    console.log('\n✅ Migration complete!');
  }

  /**
   * Migrate AI prompts from JSON to new YAML structure
   */
  private async migrateAIPrompts(aiPromptsPath: string, contextKitPath: string): Promise<void> {
    try {
      const aiPrompts = JSON.parse(readFileSync(aiPromptsPath, 'utf-8'));
      
      const promptsYAML: Record<string, unknown> = {
        version: '1.0.0',
        systemPrompts: {
          ...(aiPrompts.systemPrompts || {}),
          // Add Context Kit specific prompts
          inspect: 'You are a Context Kit inspector analyzing project context...',
          spec: 'You are a Context Kit specification generator...',
          promptify: 'You are a Context Kit prompt engineer...',
          codegen: 'You are a Context Kit code generator...'
        },
        quickPrompts: aiPrompts.quickPrompts || {},
        exampleQuestions: aiPrompts.exampleQuestions || [],
        ragConfig: {
          enabled: true,
          maxResults: 5,
          minSimilarity: 0.7,
          includeTypes: ['feature', 'userstory', 'spec', 'service', 'package']
        }
      };

      const targetPath = join(contextKitPath, 'prompts.yml');
      if (!this.options.dryRun) {
        writeFileSync(targetPath, stringifyYAML(promptsYAML));
      }
      this.result.filesMigrated.push(aiPromptsPath);
      this.result.filesCreated.push(targetPath);
      console.log(`  ✓ Migrated AI prompts to prompts.yml`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.result.errors.push(`Failed to migrate AI prompts: ${message}`);
    }
  }

  /**
   * Create default YAML configuration files
   */
  private async createDefaultYAMLFiles(contextKitPath: string): Promise<void> {
    const repoName = this.options.repoPath.split(/[\\/]/).pop() || 'unknown';
    
    // Create project.yml
    const projectYAML = {
      version: '1.0.0',
      id: repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name: repoName,
      type: 'application',
      description: 'TODO: Add project description',
      repository: {
        url: 'TODO: Add repository URL',
        branch: 'main'
      },
      team: {
        owner: 'TODO: Add owner',
        maintainers: []
      }
    };

    const projectPath = join(contextKitPath, 'project.yml');
    if (!existsSync(projectPath)) {
      if (!this.options.dryRun) {
        writeFileSync(projectPath, stringifyYAML(projectYAML));
      }
      this.result.filesCreated.push(projectPath);
      console.log(`  ✓ Created project.yml`);
    }

    // Create stack.yml
    const stackYAML = {
      version: '1.0.0',
      runtime: {
        language: 'typescript',
        version: '>=18.0.0',
        packageManager: 'pnpm'
      },
      frameworks: [],
      services: [],
      tools: {}
    };

    const stackPath = join(contextKitPath, 'stack.yml');
    if (!existsSync(stackPath)) {
      if (!this.options.dryRun) {
        writeFileSync(stackPath, stringifyYAML(stackYAML));
      }
      this.result.filesCreated.push(stackPath);
      console.log(`  ✓ Created stack.yml`);
    }

    // Create domains.yml
    const domainsYAML = {
      version: '1.0.0',
      domains: []
    };

    const domainsPath = join(contextKitPath, 'domains.yml');
    if (!existsSync(domainsPath)) {
      if (!this.options.dryRun) {
        writeFileSync(domainsPath, stringifyYAML(domainsYAML));
      }
      this.result.filesCreated.push(domainsPath);
      console.log(`  ✓ Created domains.yml`);
    }

    // Create prompts.yml
    const promptsYAML = {
      version: '1.0.0',
      systemPrompts: {
        general: 'You are an AI assistant for a context-driven development system.',
        improvement: 'You are an AI assistant specializing in enhancing context entities.',
        clarification: 'You are an AI assistant focused on clarifying entities.'
      },
      quickPrompts: {},
      exampleQuestions: [],
      ragConfig: {
        enabled: true,
        maxResults: 5,
        minSimilarity: 0.7
      }
    };

    const promptsPath = join(contextKitPath, 'prompts.yml');
    if (!existsSync(promptsPath)) {
      if (!this.options.dryRun) {
        writeFileSync(promptsPath, stringifyYAML(promptsYAML));
      }
      this.result.filesCreated.push(promptsPath);
      console.log(`  ✓ Created prompts.yml`);
    }
  }

  /**
   * Get schema template content
   */
  private getSchemaTemplates(): Record<string, string> {
    // These would ideally be loaded from template files
    // For now, return minimal schemas
    return {
      'project.schema.json': JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Project Schema',
        type: 'object',
        required: ['version', 'id', 'name', 'type'],
        properties: {
          version: { type: 'string' },
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['application', 'library', 'service', 'monorepo'] }
        }
      }, null, 2),
      'stack.schema.json': JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Stack Schema',
        type: 'object',
        required: ['version', 'runtime'],
        properties: {
          version: { type: 'string' },
          runtime: { type: 'object' }
        }
      }, null, 2),
      'domains.schema.json': JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Domains Schema',
        type: 'object',
        required: ['version', 'domains'],
        properties: {
          version: { type: 'string' },
          domains: { type: 'array' }
        }
      }, null, 2),
      'prompts.schema.json': JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Prompts Schema',
        type: 'object',
        required: ['version', 'systemPrompts'],
        properties: {
          version: { type: 'string' },
          systemPrompts: { type: 'object' }
        }
      }, null, 2),
      'spec-log.schema.json': JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: 'Spec Log Entry Schema',
        type: 'object',
        required: ['id', 'timestamp', 'requestType', 'status'],
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          requestType: { type: 'string' },
          status: { type: 'string' }
        }
      }, null, 2)
    };
  }

  /**
   * Print migration summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${this.result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Files created: ${this.result.filesCreated.length}`);
    console.log(`Files migrated: ${this.result.filesMigrated.length}`);
    console.log(`Warnings: ${this.result.warnings.length}`);
    console.log(`Errors: ${this.result.errors.length}`);

    if (this.result.warnings.length > 0) {
      console.log('\n⚠ Warnings:');
      this.result.warnings.forEach(w => console.log(`  - ${w}`));
    }

    if (this.result.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.result.errors.forEach(e => console.log(`  - ${e}`));
    }

    console.log('\n' + '='.repeat(60));
    
    if (this.result.success) {
      console.log('\n✅ Next steps:');
      console.log('  1. Review and customize the generated YAML files in .context-kit/');
      console.log('  2. Fill in project metadata in project.yml');
      console.log('  3. Define your technology stack in stack.yml');
      console.log('  4. Map your architectural domains in domains.yml');
      console.log('  5. Customize AI prompts in prompts.yml');
      console.log('  6. Run validation: node .context/pipelines/validate.mjs');
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options: MigrationOptions = {
    repoPath: process.cwd(),
    mode: 'scaffold',
    dryRun: false,
    verbose: false
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--repo':
      case '-r':
        options.repoPath = args[++i];
        break;
      case '--mode':
      case '-m':
        options.mode = args[++i] as 'scaffold' | 'migrate';
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }

  const migrator = new ContextKitMigrator(options);
  const result = await migrator.migrate();

  process.exit(result.success ? 0 : 1);
}

function printHelp() {
  console.log(`
Context Kit Migration CLI

Usage: node context-kit-migrate.ts [options]

Options:
  --repo, -r <path>      Repository path (default: current directory)
  --mode, -m <mode>      Migration mode: scaffold | migrate (default: scaffold)
  --dry-run              Show what would be done without making changes
  --verbose, -v          Verbose output
  --help, -h             Show this help message

Modes:
  scaffold               Create new .context-kit/ structure from scratch
  migrate                Migrate from existing .context/ to .context-kit/

Examples:
  node context-kit-migrate.ts --mode scaffold
  node context-kit-migrate.ts --mode migrate --repo /path/to/repo
  node context-kit-migrate.ts --dry-run --verbose
`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ContextKitMigrator, type MigrationOptions, type MigrationResult };
