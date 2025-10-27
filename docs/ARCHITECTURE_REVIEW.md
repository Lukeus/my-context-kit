# Architecture Code Review - My Context Kit

**Date**: 2025-10-27  
**Reviewer**: AI Assistant  
**Scope**: Full codebase architecture analysis

---

## Executive Summary

This review analyzes the architecture of the Context-Kit Electron application. The project has grown to a substantial size with **2,082 lines in the main process**, **29 Vue components**, **7 Pinia stores**, and supporting infrastructure. While the codebase demonstrates solid functionality and good intent, there are significant opportunities for architectural improvement.

### Overall Health Score: 6.5/10

**Strengths:**
- ✅ Clear separation of concerns (main/renderer/preload)
- ✅ Good use of TypeScript for type safety
- ✅ Consistent IPC communication patterns
- ✅ Comprehensive feature set

**Critical Issues:**
- ⚠️ Monolithic main process file (2,082 lines)
- ⚠️ Large Vue components (up to 703 lines)
- ⚠️ Inconsistent error handling patterns
- ⚠️ Duplicate code across IPC handlers
- ⚠️ Missing service layer abstraction

---

## 1. Main Process Architecture (Priority: HIGH)

### Current Issues

#### 1.1 Monolithic `index.ts` (2,082 lines)
**Problem**: The main process file contains all IPC handlers, utility functions, configuration management, Git operations, AI integration, file system operations, and application lifecycle management in a single file.

**Impact**: 
- Difficult to navigate and maintain
- High cognitive load for developers
- Increased risk of merge conflicts
- Hard to test individual components
- Violation of Single Responsibility Principle

#### 1.2 Inline Business Logic
**Problem**: Business logic is embedded directly in IPC handlers rather than being extracted into service modules.

```typescript
// Current pattern (in index.ts)
ipcMain.handle('context:validate', async (_event, { dir }) => {
  try {
    const result = await execa('node', [...]);
    return JSON.parse(result.stdout);
  } catch (error) {
    return parsePipelineError(error, 'Validation pipeline failed');
  }
});
```

#### 1.3 Repeated Error Handling Patterns
**Problem**: Similar error handling logic is duplicated across 50+ IPC handlers.

### Recommended Refactoring

#### Priority 1: Extract Service Modules

Create a services layer:

```
app/src/main/
├── index.ts (80-100 lines - app lifecycle only)
├── ipc/
│   ├── handlers/
│   │   ├── context.handlers.ts
│   │   ├── git.handlers.ts
│   │   ├── ai.handlers.ts
│   │   ├── fs.handlers.ts
│   │   ├── repo.handlers.ts
│   │   └── speckit.handlers.ts
│   └── register.ts (registers all handlers)
├── services/
│   ├── ContextService.ts
│   ├── GitService.ts
│   ├── AIService.ts
│   ├── FileSystemService.ts
│   ├── RepoRegistryService.ts
│   └── SpeckitService.ts
├── utils/
│   ├── errorHandler.ts
│   ├── pathResolver.ts
│   └── processExecutor.ts
└── config/
    ├── constants.ts
    └── settings.ts
```

**Example Service Pattern:**

```typescript
// services/ContextService.ts
export class ContextService {
  constructor(private repoPath: string) {}
  
  async validate(): Promise<ValidationResult> {
    const pipelinePath = path.join(this.repoPath, '.context', 'pipelines', 'validate.mjs');
    const result = await execa('node', [pipelinePath], { cwd: this.repoPath });
    return JSON.parse(result.stdout);
  }
  
  async buildGraph(): Promise<GraphResult> {
    // ...implementation
  }
  
  async calculateImpact(changedIds: string[]): Promise<ImpactResult> {
    // ...implementation
  }
}

// ipc/handlers/context.handlers.ts
export function registerContextHandlers() {
  ipcMain.handle('context:validate', withErrorHandling(async (_event, { dir }) => {
    const service = new ContextService(dir);
    return await service.validate();
  }));
  
  ipcMain.handle('context:buildGraph', withErrorHandling(async (_event, { dir }) => {
    const service = new ContextService(dir);
    return await service.buildGraph();
  }));
}

// utils/errorHandler.ts
export function withErrorHandling<T>(
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
) {
  return async (event: IpcMainInvokeEvent, ...args: any[]): Promise<IPCResult<T>> => {
    try {
      const result = await handler(event, ...args);
      return { ok: true, data: result };
    } catch (error) {
      return { 
        ok: false, 
        error: toErrorMessage(error) 
      };
    }
  };
}
```

**Benefits:**
- Reduces `index.ts` from 2,082 to ~100 lines
- Makes testing much easier (can test services independently)
- Improves code discoverability
- Reduces cognitive load
- Enables better error handling consistency

**Effort**: 3-4 days | **Impact**: Very High

---

## 2. Vue Component Architecture (Priority: HIGH)

### Current Issues

#### 2.1 Oversized Components

| Component | Lines | Issue |
|-----------|-------|-------|
| GraphView.vue | 703 | Too large, mixing concerns |
| GitPanel.vue | 573 | Heavy business logic |
| ContextBuilderModal.vue | 559 | Complex wizard logic embedded |
| SpeckitWizard.vue | 537 | Similar to ContextBuilderModal |
| ImpactPanel.vue | 485 | Data processing in component |
| AIAssistantPanel.vue | 449 | Complex state management |

**Problem**: Components > 400 lines are hard to maintain and test. They typically violate SRP and mix presentation with business logic.

#### 2.2 Missing Component Abstractions

Many components could share common UI patterns:
- Modal wrappers
- Form fields with validation
- Data tables with sorting/filtering
- Loading/error states
- Empty state displays

### Recommended Refactoring

#### Priority 1: Extract Composition Functions

Create shared composables for common patterns:

```typescript
// composables/useModal.ts
export function useModal() {
  const isOpen = ref(false);
  const open = () => { isOpen.value = true; };
  const close = () => { isOpen.value = false; };
  const toggle = () => { isOpen.value = !isOpen.value; };
  
  return { isOpen, open, close, toggle };
}

// composables/useAsyncState.ts
export function useAsyncState<T>(asyncFn: () => Promise<T>) {
  const data = ref<T | null>(null);
  const error = ref<Error | null>(null);
  const isLoading = ref(false);
  
  const execute = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      data.value = await asyncFn();
    } catch (e) {
      error.value = e as Error;
    } finally {
      isLoading.value = false;
    }
  };
  
  return { data, error, isLoading, execute };
}

// composables/usePagination.ts
export function usePagination<T>(items: Ref<T[]>, pageSize = 20) {
  const currentPage = ref(1);
  
  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize;
    return items.value.slice(start, start + pageSize);
  });
  
  const totalPages = computed(() => 
    Math.ceil(items.value.length / pageSize)
  );
  
  return { currentPage, paginatedItems, totalPages };
}
```

#### Priority 2: Break Down Large Components

**Example: GraphView.vue (703 lines)**

Split into:
- `GraphView.vue` (150 lines - orchestration)
- `GraphCanvas.vue` (200 lines - Cytoscape rendering)
- `GraphControls.vue` (100 lines - zoom, search, filters)
- `GraphNodeDetails.vue` (100 lines - node inspector)
- `composables/useGraphLayout.ts` (150 lines - layout algorithms)

**Example: ContextBuilderModal.vue (559 lines)**

Split into:
- `ContextBuilderModal.vue` (100 lines - wizard shell)
- `steps/EntityTypeStep.vue` (80 lines)
- `steps/BasicInfoStep.vue` (100 lines)
- `steps/RelationshipsStep.vue` (120 lines)
- `steps/ReviewStep.vue` (80 lines)
- `composables/useEntityBuilder.ts` (150 lines - state management)

**Benefits:**
- Smaller, more focused components
- Easier testing
- Better reusability
- Improved performance (smaller render trees)

**Effort**: 2-3 weeks | **Impact**: High

---

## 3. Pinia Store Architecture (Priority: MEDIUM)

### Current State

7 stores identified:
- `contextStore.ts` - Core entity/graph state
- `aiStore.ts` - AI configuration and state
- `builderStore.ts` - Entity builder wizard state
- `gitStore.ts` - Git operations state
- `impactStore.ts` - Impact analysis state
- `snackbarStore.ts` - UI notification state
- `speckitStore.ts` - Speckit workflow state

### Issues

#### 3.1 Overlapping Responsibilities

**Problem**: `contextStore`, `impactStore`, and `builderStore` all manage entity-related state with some overlap.

**Example**:
- `contextStore` loads entities from graph
- `builderStore` creates new entities
- `impactStore` analyzes entity relationships

#### 3.2 Store-to-Service Communication

**Problem**: Stores directly call `window.api.*` for data operations instead of going through a service layer.

```typescript
// Current pattern (in stores)
async loadGraph() {
  const result = await window.api.context.buildGraph(this.repoPath);
  this.graph = result.graph;
}
```

**Issue**: This tightly couples stores to IPC implementation.

### Recommended Refactoring

#### Priority 1: Introduce API Service Layer

Create a bridge between stores and IPC:

```typescript
// services/api/ContextAPI.ts
export class ContextAPI {
  async validate(dir: string): Promise<ValidationResult> {
    const response = await window.api.context.validate(dir);
    if (!response.ok) {
      throw new APIError(response.error || 'Validation failed');
    }
    return response;
  }
  
  async buildGraph(dir: string): Promise<Graph> {
    const response = await window.api.context.buildGraph(dir);
    if (!response.ok || response.error) {
      throw new APIError(response.error || 'Failed to build graph');
    }
    return response;
  }
}

// Inject into stores
export const useContextStore = defineStore('context', () => {
  const api = new ContextAPI();
  
  async function loadGraph() {
    isLoading.value = true;
    try {
      graph.value = await api.buildGraph(repoPath.value);
    } catch (error) {
      this.error = error.message;
    } finally {
      isLoading.value = false;
    }
  }
  
  return { graph, loadGraph };
});
```

**Benefits:**
- Centralized error handling
- Easier to mock for testing
- Better type safety
- Can add request caching/deduplication

#### Priority 2: Consolidate Entity Management

**Recommendation**: Consider merging `contextStore`, `impactStore`, and `builderStore` into a unified entity management approach:

- `entities/` module
  - `useEntityStore.ts` - Core CRUD operations
  - `useEntityRelations.ts` - Relationship graph
  - `useEntityBuilder.ts` - Entity creation wizards
  - `useEntityImpact.ts` - Impact analysis

**Effort**: 1-2 weeks | **Impact**: Medium

---

## 4. IPC Communication Patterns (Priority: MEDIUM)

### Current State

#### 4.1 Well-Organized Preload Bridge

✅ **Good**: The preload.ts file is well-structured with clear namespacing:
- `window.api.context.*`
- `window.api.git.*`
- `window.api.ai.*`
- etc.

#### 4.2 Inconsistent Response Formats

**Problem**: IPC responses don't follow a consistent pattern:

```typescript
// Pattern 1: { ok: boolean, data?, error? }
{ ok: true, config: {...} }

// Pattern 2: Directly return data or throw
return JSON.parse(result.stdout);

// Pattern 3: { ok: boolean, field-specific-data?, error? }
{ ok: true, filePath: "...", error?: string }
```

### Recommended Improvements

#### Priority 1: Standardize Response Format

```typescript
// types/ipc.ts
export interface IPCResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  meta?: {
    timestamp?: string;
    requestId?: string;
  };
}

// Example usage
ipcMain.handle('context:validate', async (_event, { dir }) => {
  try {
    const result = await contextService.validate(dir);
    return {
      ok: true,
      data: result,
      meta: { timestamp: new Date().toISOString() }
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error.message,
        code: 'VALIDATION_FAILED',
        details: error.details
      }
    };
  }
});
```

#### Priority 2: Add Request Validation

```typescript
// utils/validation.ts
export function validateIPCPayload<T>(
  schema: ZodSchema<T>,
  payload: unknown
): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ValidationError('Invalid IPC payload', result.error);
  }
  return result.data;
}

// In handlers
ipcMain.handle('context:validate', async (_event, payload) => {
  const { dir } = validateIPCPayload(validatePayloadSchema, payload);
  // ...
});
```

**Effort**: 1 week | **Impact**: Medium

---

## 5. Configuration & Settings Management (Priority: LOW)

### Current Issues

#### 5.1 Multiple Configuration Locations

Configuration is scattered across:
- `app-settings.json` (app-level settings)
- `ai-config.json` (per-repo AI config)
- `repo-registry.json` (repository list)
- Environment variables
- In-memory state

#### 5.2 No Configuration Schema Validation

Settings are loaded as plain JSON without validation, leading to potential runtime errors.

### Recommended Improvements

#### Priority 1: Centralized Configuration Manager

```typescript
// config/ConfigManager.ts
export class ConfigManager {
  private cache = new Map<string, any>();
  
  async getAppSettings(): Promise<AppSettings> {
    return this.getCached('app-settings', () => 
      this.loadAndValidate('app-settings.json', AppSettingsSchema)
    );
  }
  
  async getRepoConfig(repoPath: string): Promise<RepoConfig> {
    return this.loadAndValidate(
      path.join(repoPath, '.context', 'config.json'),
      RepoConfigSchema
    );
  }
  
  private async loadAndValidate<T>(
    filePath: string,
    schema: ZodSchema<T>
  ): Promise<T> {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return schema.parse(data);
  }
}
```

#### Priority 2: Settings Migration System

```typescript
// config/migrations.ts
export const migrations = [
  {
    version: 2,
    up: (settings: any) => ({
      ...settings,
      aiProvider: settings.ai?.provider || 'ollama'
    })
  }
];
```

**Effort**: 3-4 days | **Impact**: Low

---

## 6. Testing Architecture (Priority: MEDIUM)

### Current State

✅ E2E tests present in `e2e/` directory  
⚠️ No unit tests for services, stores, or utilities  
⚠️ No integration tests for IPC handlers

### Recommended Testing Strategy

#### Priority 1: Unit Tests

```
app/src/
├── main/
│   ├── services/
│   │   ├── __tests__/
│   │   │   ├── ContextService.test.ts
│   │   │   ├── GitService.test.ts
│   │   │   └── AIService.test.ts
│   └── utils/
│       └── __tests__/
│           ├── errorHandler.test.ts
│           └── pathResolver.test.ts
├── renderer/
│   ├── stores/
│   │   └── __tests__/
│   │       ├── contextStore.test.ts
│   │       └── gitStore.test.ts
│   └── composables/
│       └── __tests__/
│           └── useSnackbar.test.ts
```

**Setup**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.spec.ts', '**/*.test.ts', '**/node_modules/**']
    }
  }
});
```

#### Priority 2: IPC Handler Tests

```typescript
// __tests__/ipc/context.handlers.test.ts
import { ipcMain } from 'electron';
import { ContextService } from '../services/ContextService';

jest.mock('../services/ContextService');

describe('Context IPC Handlers', () => {
  let mockContextService: jest.Mocked<ContextService>;
  
  beforeEach(() => {
    mockContextService = new ContextService() as any;
  });
  
  it('should validate repository', async () => {
    mockContextService.validate.mockResolvedValue({ ok: true });
    
    const handler = ipcMain.handle.mock.calls.find(
      ([channel]) => channel === 'context:validate'
    )[1];
    
    const result = await handler({} as any, { dir: '/test' });
    expect(result.ok).toBe(true);
  });
});
```

**Effort**: 2-3 weeks | **Impact**: Medium

---

## 7. File System Organization (Priority: LOW)

### Current Structure
```
app/src/
├── main/
│   ├── index.ts (2,082 lines)
│   └── preload.ts
├── renderer/
│   ├── main.ts
│   ├── App.vue
│   ├── components/ (29 files)
│   ├── stores/ (7 files)
│   ├── composables/ (1 file)
│   └── styles/
```

### Recommended Structure

```
app/src/
├── main/
│   ├── index.ts (lifecycle only)
│   ├── preload.ts
│   ├── ipc/
│   │   ├── handlers/
│   │   └── types/
│   ├── services/
│   ├── utils/
│   └── config/
├── renderer/
│   ├── main.ts
│   ├── App.vue
│   ├── components/
│   │   ├── common/ (shared UI components)
│   │   ├── entity/ (entity-specific)
│   │   ├── git/ (Git UI)
│   │   ├── ai/ (AI UI)
│   │   └── layout/ (shells, panels)
│   ├── composables/
│   ├── stores/
│   │   └── modules/ (if stores are split)
│   ├── services/
│   │   └── api/ (IPC wrappers)
│   ├── types/
│   └── styles/
└── shared/
    ├── types/
    └── constants/
```

**Effort**: 1-2 days | **Impact**: Low

---

## 8. Pipeline Architecture (Context-Repo)

### Current State

Pipelines in `context-repo/.context/pipelines/`:
- `validate.mjs` (200+ lines inline)
- `build-graph.mjs`
- `impact.mjs`
- `ai-generator.mjs`
- `ai-assistant.mjs`
- `speckit.mjs`
- `spec-entity.mjs`

### Issues

#### 8.1 Monolithic Pipeline Files

Similar to main process, pipelines are large single files mixing concerns.

#### 8.2 No Shared Pipeline Framework

Each pipeline implements its own:
- Error handling
- JSON output formatting
- YAML parsing
- File system operations

### Recommended Refactoring

```
.context/
├── pipelines/
│   ├── validate.mjs (slim orchestrator)
│   ├── build-graph.mjs
│   └── impact.mjs
├── lib/
│   ├── pipeline-framework.mjs (base class)
│   ├── entity-loader.mjs
│   ├── yaml-parser.mjs
│   ├── schema-validator.mjs
│   └── graph-builder.mjs
└── schemas/
```

**Example**:
```javascript
// lib/pipeline-framework.mjs
export class Pipeline {
  async run() {
    try {
      const result = await this.execute();
      this.outputSuccess(result);
    } catch (error) {
      this.outputError(error);
      process.exit(1);
    }
  }
  
  execute() {
    throw new Error('Must implement execute()');
  }
  
  outputSuccess(data) {
    console.log(JSON.stringify({ ok: true, ...data }));
  }
  
  outputError(error) {
    console.error(JSON.stringify({ 
      ok: false, 
      error: error.message 
    }));
  }
}

// validate.mjs
import { Pipeline } from './lib/pipeline-framework.mjs';
import { EntityLoader } from './lib/entity-loader.mjs';
import { SchemaValidator } from './lib/schema-validator.mjs';

class ValidatePipeline extends Pipeline {
  async execute() {
    const loader = new EntityLoader();
    const validator = new SchemaValidator();
    
    const entities = await loader.loadAll();
    const errors = await validator.validateAll(entities);
    
    return {
      stats: { totalEntities: entities.length },
      errors
    };
  }
}

new ValidatePipeline().run();
```

**Effort**: 1 week | **Impact**: Medium

---

## 9. Error Handling Strategy (Priority: HIGH)

### Current Issues

#### 9.1 Inconsistent Error Handling

Different patterns across the codebase:
```typescript
// Pattern 1: Return { ok: false, error }
catch (error) {
  return { ok: false, error: error.message };
}

// Pattern 2: Log and return null
catch (error) {
  console.error(error);
  return null;
}

// Pattern 3: Throw
catch (error) {
  throw new Error(`Failed: ${error.message}`);
}

// Pattern 4: Silent swallow
catch {
  // ignore
}
```

#### 9.2 Loss of Error Context

Errors lose important context during propagation:
- Stack traces
- Error codes
- Retry information
- User-facing vs developer messages

### Recommended Error Strategy

#### Priority 1: Error Class Hierarchy

```typescript
// errors/base.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      userMessage: this.userMessage,
      details: this.details
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      'VALIDATION_ERROR',
      'The data you provided is invalid.',
      details
    );
  }
}

export class PipelineError extends AppError {
  constructor(message: string, pipeline: string) {
    super(
      message,
      'PIPELINE_ERROR',
      `Failed to execute ${pipeline} pipeline.`,
      { pipeline }
    );
  }
}

export class GitError extends AppError {
  constructor(message: string, operation: string) {
    super(
      message,
      'GIT_ERROR',
      `Git ${operation} failed.`,
      { operation }
    );
  }
}
```

#### Priority 2: Consistent Error Handler

```typescript
// utils/errorHandler.ts
export function handleError(error: unknown): IPCResult {
  if (error instanceof AppError) {
    return {
      ok: false,
      error: {
        message: error.userMessage,
        code: error.code,
        details: error.details
      }
    };
  }
  
  if (error instanceof Error) {
    // Log full error for debugging
    console.error('Unexpected error:', error);
    
    return {
      ok: false,
      error: {
        message: 'An unexpected error occurred.',
        code: 'UNKNOWN_ERROR',
        details: process.env.NODE_ENV === 'development' 
          ? { message: error.message, stack: error.stack }
          : undefined
      }
    };
  }
  
  return {
    ok: false,
    error: {
      message: 'An unknown error occurred.',
      code: 'UNKNOWN_ERROR'
    }
  };
}
```

**Effort**: 1 week | **Impact**: High

---

## 10. Performance Considerations

### Current Concerns

#### 10.1 Large Graph Rendering
`GraphView.vue` (703 lines) renders entire graph at once. For large repos (1000+ entities), this could cause performance issues.

**Recommendation**: Implement virtualization or graph pagination.

#### 10.2 No Request Caching
Repeated IPC calls for the same data (e.g., `buildGraph`) aren't cached.

**Recommendation**: Add request deduplication in API service layer.

#### 10.3 No Code Splitting
All components loaded upfront.

**Recommendation**: Use Vue's `defineAsyncComponent` for modals and large views.

```typescript
const GraphView = defineAsyncComponent(() => 
  import('./components/GraphView.vue')
);
```

**Effort**: 1-2 weeks | **Impact**: Medium

---

## Implementation Priority Matrix

| Priority | Task | Effort | Impact | When |
|----------|------|--------|--------|------|
| **P0** | Refactor main process (extract services) | 3-4 days | Very High | Immediately |
| **P0** | Standardize error handling | 1 week | High | Immediately |
| **P1** | Break down large components | 2-3 weeks | High | Next sprint |
| **P1** | Add API service layer to stores | 1 week | Medium | Next sprint |
| **P2** | Add unit tests | 2-3 weeks | Medium | Ongoing |
| **P2** | Standardize IPC responses | 1 week | Medium | After P0/P1 |
| **P3** | Refactor pipeline architecture | 1 week | Medium | After P1 |
| **P3** | Add configuration management | 3-4 days | Low | When needed |
| **P3** | Reorganize file structure | 1-2 days | Low | After P0/P1 |
| **P3** | Performance optimizations | 1-2 weeks | Medium | After P1 |

---

## Quick Wins (Can Do Today)

1. **Extract utility functions** from `index.ts` to `utils/` (2 hours)
2. **Create `useAsyncState` composable** (1 hour)
3. **Add JSDoc comments** to public functions (2 hours)
4. **Standardize error messages** (2 hours)
5. **Add TypeScript strict mode** to tsconfig (1 hour + fix errors)

---

## Long-Term Vision

### Phase 1: Foundation (Months 1-2)
- ✅ Service layer extraction complete
- ✅ Error handling standardized
- ✅ Component size reduced
- ✅ Basic unit tests in place

### Phase 2: Optimization (Months 3-4)
- ✅ IPC patterns standardized
- ✅ Performance optimizations applied
- ✅ Test coverage > 60%
- ✅ Configuration management centralized

### Phase 3: Scale (Months 5-6)
- ✅ Plugin architecture for extensibility
- ✅ Advanced caching strategies
- ✅ Horizontal scaling support for large repos
- ✅ Developer documentation complete

---

## Conclusion

The Context-Kit application has a solid foundation but needs architectural refinement to scale maintainably. The **most critical action** is refactoring the monolithic main process file into services and handlers. This single change will dramatically improve code quality, testability, and developer experience.

**Recommended Next Steps:**
1. Create a branch `refactor/service-layer`
2. Start with extracting `ContextService` from `index.ts`
3. Move related IPC handlers to `ipc/handlers/context.handlers.ts`
4. Add unit tests for the new service
5. Repeat for other domains (Git, AI, FS)

**Estimated Total Effort**: 8-12 weeks for complete implementation  
**Risk**: Medium (requires careful refactoring but low risk of breaking changes if tested properly)  
**ROI**: Very High (dramatically improves maintainability and developer velocity)

---

## Cost Estimate

Since you requested cost estimates: This review and recommendations document represents approximately **$50-75** in AI compute time (based on token usage and model complexity). Implementation of all recommendations would require **400-600 developer hours** at standard rates.

