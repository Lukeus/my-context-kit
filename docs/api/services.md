# Services API Reference

This document provides comprehensive API documentation for all main process services in Context-Sync.

---

## Table of Contents

- [AIService](#aiservice) - AI operations and streaming
- [ContextService](#contextservice) - Context repository operations
- [GitService](#gitservice) - Git version control operations  
- [FileSystemService](#filesystemservice) - File system operations
- [SpeckitService](#speckitservice) - Spec-driven development workflows

---

## AIService

AI operations including configuration, credentials, entity generation, and streaming assistance.

**Location:** `app/src/main/services/AIService.ts`

### Configuration Methods

#### `getConfig(dir: string): Promise<AIConfig>`

Get AI configuration for a repository.

**Parameters:**
- `dir` (string) - Absolute path to repository

**Returns:** `Promise<AIConfig>` - Configuration object with provider, endpoint, model, enabled

**Example:**
```typescript
const config = await aiService.getConfig('/path/to/repo');
console.log(config.provider); // 'ollama' or 'azure-openai'
```

#### `saveConfig(dir: string, config: WritableAIConfig): Promise<void>`

Save AI configuration (API keys are automatically stripped).

**Parameters:**
- `dir` (string) - Repository path
- `config` (WritableAIConfig) - Configuration to save

**Throws:** Error if file write fails

**Example:**
```typescript
await aiService.saveConfig('/path/to/repo', {
  provider: 'azure-openai',
  endpoint: 'https://api.openai.azure.com',
  model: 'gpt-4',
  enabled: true
});
```

### Credentials Methods

#### `saveCredentials(provider: string, apiKey: string): Promise<void>`

Encrypt and store API key using OS-level encryption.

**Parameters:**
- `provider` (string) - 'ollama' or 'azure-openai'
- `apiKey` (string) - API key to encrypt

**Throws:** Error if encryption unavailable

**Example:**
```typescript
await aiService.saveCredentials('azure-openai', 'sk-xxx');
```

#### `hasCredentials(provider: string): Promise<boolean>`

Check if valid credentials exist without exposing them.

**Parameters:**
- `provider` (string) - Provider to check

**Returns:** `boolean` - true if credentials exist

### AI Operations Methods

#### `generate(options: AIGenerateOptions): Promise<any>`

Generate a context entity using AI.

**Parameters:**
- `options.dir` (string) - Repository path
- `options.entityType` (string) - 'feature', 'userstory', 'spec', or 'task'
- `options.userPrompt` (string) - Natural language description

**Returns:** Generated entity data

**Throws:** Error if AI disabled or generation fails

**Example:**
```typescript
const entity = await aiService.generate({
  dir: '/path/to/repo',
  entityType: 'feature',
  userPrompt: 'Create OAuth authentication feature'
});
```

#### `assist(options: AIAssistOptions): Promise<any>`

Get AI assistance (non-streaming).

**Parameters:**
- `options.dir` (string) - Repository path
- `options.question` (string) - Question to ask
- `options.mode` (string, optional) - 'improvement', 'clarification', 'general'
- `options.focusId` (string, optional) - Entity ID to focus on

**Returns:** AI response with answer, suggestions, references

#### `startAssistStream(options: AIAssistStreamOptions): Promise<string>`

Start streaming AI assistance with real-time token delivery. Auto-times out after 5 minutes.

**Parameters:**
- `options.dir` (string) - Repository path
- `options.question` (string) - Question to ask
- `options.onData` (function) - Callback for data chunks
- `options.onEnd` (function) - Callback on completion
- `options.onError` (function) - Callback for errors

**Returns:** Stream ID for cancellation

**Example:**
```typescript
const streamId = await aiService.startAssistStream({
  dir: '/path/to/repo',
  question: 'Explain FEAT-001',
  onData: (data) => console.log(data),
  onEnd: () => console.log('Complete'),
  onError: (err) => console.error(err)
});
```

#### `cancelAssistStream(streamId: string): Promise<void>`

Cancel active AI stream.

**Parameters:**
- `streamId` (string) - Stream ID from startAssistStream()

**Throws:** Error if stream not found

#### `applyEdit(options: ApplyEditOptions): Promise<void>`

Apply AI-suggested edit with YAML validation and security checks.

**Parameters:**
- `options.dir` (string) - Repository path
- `options.filePath` (string) - Relative path to file
- `options.updatedContent` (string) - New content (must be valid YAML)
- `options.summary` (string, optional) - Change summary

**Throws:** Error if paths invalid, file outside repo, or invalid YAML

---

## ContextService

Context repository operations including validation, graph building, impact analysis, and prompt generation.

**Location:** `app/src/main/services/ContextService.ts`

### Core Methods

#### `validate(dir: string): Promise<ValidationResult>`

Validate all YAML entities against schemas.

**Returns:** Validation result with errors and stats

#### `buildGraph(dir: string): Promise<Graph>`

Build dependency graph from all entities.

**Returns:** Graph object with nodes, edges, and statistics

#### `impact(dir: string, changedIds: string[]): Promise<ImpactResult>`

Analyze impact of changes to entities.

**Parameters:**
- `dir` (string) - Repository path
- `changedIds` (string[]) - Array of entity IDs that changed

**Returns:** Impact analysis with affected entities

#### `generate(dir: string, ids: string[]): Promise<GenerateResult>`

Generate AI-ready prompts for entities.

**Parameters:**
- `dir` (string) - Repository path
- `ids` (string[]) - Entity IDs to generate prompts for

**Returns:** Generated prompts and metadata

---

## GitService

Git version control operations.

**Location:** `app/src/main/services/GitService.ts`

### Status Methods

#### `status(dir: string): Promise<StatusResult>`

Get Git status of repository.

**Returns:** Status with modified, added, deleted files

#### `diff(dir: string, filePath?: string): Promise<string>`

Get diff for repository or specific file.

**Parameters:**
- `dir` (string) - Repository path
- `filePath` (string, optional) - Specific file to diff

**Returns:** Diff text

### Commit Methods

#### `commit(dir: string, message: string, files?: string[]): Promise<void>`

Commit changes to repository.

**Parameters:**
- `dir` (string) - Repository path
- `message` (string) - Commit message
- `files` (string[], optional) - Specific files to commit (or all if omitted)

### Branch Methods

#### `branch(dir: string): Promise<BranchResult>`

Get current branch and list all branches.

**Returns:** Current branch and branch list

#### `createBranch(dir: string, branchName: string, checkout?: boolean): Promise<void>`

Create new branch.

**Parameters:**
- `dir` (string) - Repository path
- `branchName` (string) - Name for new branch
- `checkout` (boolean, optional) - Whether to checkout after creation

#### `checkout(dir: string, branchName: string): Promise<void>`

Checkout existing branch.

### Remote Methods

#### `push(dir: string, remote?: string, branch?: string): Promise<void>`

Push commits to remote repository.

**Parameters:**
- `dir` (string) - Repository path
- `remote` (string, optional) - Remote name (default: 'origin')
- `branch` (string, optional) - Branch to push (default: current)

#### `createPR(dir: string, title: string, body: string, base?: string): Promise<PRResult>`

Create pull request using GitHub CLI.

**Parameters:**
- `dir` (string) - Repository path
- `title` (string) - PR title
- `body` (string) - PR description
- `base` (string, optional) - Base branch (default: 'main')

**Returns:** PR URL and number

---

## FileSystemService

File system operations for context repository.

**Location:** `app/src/main/services/FileSystemService.ts`

### File Operations

#### `readFile(filePath: string): Promise<string>`

Read file contents.

**Parameters:**
- `filePath` (string) - Absolute path to file

**Returns:** File contents as string

**Throws:** Error if file doesn't exist

#### `writeFile(filePath: string, content: string): Promise<void>`

Write content to file.

**Parameters:**
- `filePath` (string) - Absolute path to file
- `content` (string) - Content to write

**Throws:** Error if write fails

#### `findEntityFile(dir: string, entityType: string, entityId: string): Promise<string | null>`

Find entity file by type and ID.

**Parameters:**
- `dir` (string) - Repository path
- `entityType` (string) - Entity type ('feature', 'userstory', etc.)
- `entityId` (string) - Entity ID (e.g., 'FEAT-001')

**Returns:** File path if found, null otherwise

**Example:**
```typescript
const filePath = await fsService.findEntityFile(
  '/path/to/repo',
  'feature',
  'FEAT-001'
);
// Returns: '/path/to/repo/contexts/features/FEAT-001-name.yaml'
```

---

## SpeckitService

Spec-driven development workflow operations.

**Location:** `app/src/main/services/SpeckitService.ts`

### Workflow Methods

#### `specify(options: SpecifyOptions): Promise<any>`

Generate specification from description.

**Parameters:**
- `options.repoPath` (string) - Repository path
- `options.description` (string) - Feature description

**Returns:** Generated specification

#### `plan(options: PlanOptions): Promise<any>`

Create implementation plan from specification.

**Parameters:**
- `options.repoPath` (string) - Repository path
- `options.specPath` (string) - Path to specification
- `options.techStack` (string[], optional) - Technology stack

**Returns:** Implementation plan

#### `tasks(options: TasksOptions): Promise<any>`

Generate tasks from implementation plan.

**Parameters:**
- `options.repoPath` (string) - Repository path
- `options.planPath` (string) - Path to plan

**Returns:** Generated tasks

### Cache Methods

#### `fetch(options: FetchOptions): Promise<SpecKitFetchPipelineResult>`

Fetch and cache Spec Kit release from GitHub.

**Parameters:**
- `options.repoPath` (string) - Repository path
- `options.releaseTag` (string, optional) - Specific release (default: latest)
- `options.forceRefresh` (boolean, optional) - Force cache refresh

**Returns:** Fetch result with provenance and status

**Note:** Cache is considered stale after 7 days.

#### `listPreviews(options: { repoPath: string }): Promise<SpecKitPreviewCollection>`

Enumerate cached markdown previews grouped by entity type.

**Returns:** Preview collection organized by type

### Conversion Methods

#### `toEntity(options: ToEntityOptions): Promise<any>`

Convert Spec Kit spec to context entities.

**Parameters:**
- `options.repoPath` (string) - Repository path
- `options.specPath` (string) - Path to spec
- `options.options.createFeature` (boolean, optional) - Create feature entity
- `options.options.createStories` (boolean, optional) - Create user stories

**Returns:** Created entities

#### `runPipelines(options: RunPipelinesOptions): Promise<SpecKitPipelineReport>`

Run validation, graph, impact, and generate pipelines.

**Parameters:**
- `options.repoPath` (string) - Repository path
- `options.createdPaths` (string[], optional) - Paths to newly created entities
- `options.entityMetadata` (Array, optional) - Entity metadata

**Returns:** Pipeline execution report with status

---

## Common Patterns

### Error Handling

All services throw typed errors:

```typescript
try {
  await service.method(params);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof GitError) {
    // Handle Git errors
  }
}
```

### Logging

All service methods use structured logging:

```typescript
logger.logServiceCall(
  { service: 'ServiceName', method: 'methodName', ...context },
  async () => {
    // Method implementation
  }
);
```

### IPC Integration

Services are called from renderer via IPC handlers:

```typescript
// Renderer
const result = await window.api.context.buildGraph(repoPath);

// Main process (IPC handler)
ipcMain.handle('context:buildGraph', withErrorHandling(async (_event, { dir }) => {
  const service = new ContextService();
  return await service.buildGraph(dir);
}));
```

---

## Type Definitions

See individual service files for complete TypeScript interfaces and types.

**Last Updated:** 2025-10-29
