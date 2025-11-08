# Clean Architecture Refactoring Status

**Started**: 2025-11-08  
**Target**: Clean layered architecture + Enterprise features

## ✅ Completed

### 1. Documentation (3 files)
- ✅ `constitution.md` - Architectural principles and guidelines
- ✅ `.github/copilot-instructions.md` - Updated with clean architecture
- ✅ `../WARP.md` - Updated with enterprise features

### 2. Type Definitions
- ✅ `src/types/enterprise.ts` - Complete with Zod schemas
  - EnterpriseConfig, EnterpriseRepoInfo
  - ConstitutionSection, MergedConstitution
  - DeriveSpecRequest, DeriveSpecResult
  - PromptTemplate, PromptRegistry
  - IPC channel constants

### 3. Domain Logic (Framework-agnostic)
- ✅ `domain/prompts/PromptRegistry.ts` - Prompt template management
  - Load/cache markdown templates
  - Variable extraction and substitution
  - Description parsing
- ✅ `domain/enterprise/ConstitutionMerger.ts` - Constitution merging
  - Parse markdown sections
  - Merge global + local with conflict detection
  - Render merged output with badges

### 4. Enterprise Prompts
- ✅ `enterprise/prompts/derive-spec.md` - AI prompt for spec derivation

### 5. Service Layer
- ✅ `src/main/services/GitHubService.ts` - GitHub API operations
  - List org repos, get repo info
  - Check for files (constitution, specs)
  - Get file contents
  - Rate limiting and error handling

## 🔄 In Progress

### Service Layer (Main Process)
- `src/main/services/AIService.ts` - Wrapper around LangChainAIService
- `src/main/services/EnterpriseService.ts` - Enterprise orchestration
- GitService refactoring (static methods)

## 📋 Remaining Tasks

### Service Layer (Main Process)

#### 1. GitService (Refactor Existing)
**File**: `src/main/services/GitService.ts`  
**Status**: Exists, needs enhancement  
**Changes Needed**:
- Add static methods for non-instance operations
  - `static async clone(url, targetPath)`
  - `static async isGitRepo(path)`
  - `static async init(path)`
- Add missing instance methods
  - `async getLastCommit()`
  - `async getRemoteUrl()`
- Ensure all methods use typed AppError
- **Test File**: `src/main/services/GitService.test.ts`

#### 2. GitHubService (New)
**File**: `src/main/services/GitHubService.ts`  
**Dependencies**: Built-in fetch, https-proxy-agent  
**Methods**:
```typescript
class GitHubService {
  constructor(config: GitHubConfig)
  async listOrgRepos(org: string): Promise<GitHubRepo[]>
  async getRepo(owner, repo): Promise<GitHubRepo>
  async hasFile(owner, repo, filePath): Promise<boolean>
  async getFileContent(owner, repo, filePath): Promise<string>
  async getDefaultBranch(owner, repo): Promise<string>
  async testConnection(): Promise<boolean>
}
```
- **Test File**: `src/main/services/GitHubService.test.ts`

#### 3. AIService (New - Wraps LangChainAIService)
**File**: `src/main/services/AIService.ts`  
**Approach**: Wrapper around existing LangChainAIService  
**Methods**:
```typescript
class AIService {
  constructor(config: AIConfig)
  async complete(prompt, options?): Promise<CompletionResult>
  async *streamComplete(prompt, options?): AsyncGenerator<string>
  async loadPrompt(name, variables?): Promise<string>
  estimateTokens(text): number
  async testProvider(provider): Promise<boolean>
}
```
- Integrates with PromptRegistry
- **Test File**: `src/main/services/AIService.test.ts`

#### 4. EnterpriseService (New)
**File**: `src/main/services/EnterpriseService.ts`  
**Dependencies**: GitService, GitHubService, AIService  
**Methods**:
```typescript
class EnterpriseService {
  constructor(gitService, githubService, aiService)
  
  // Config
  async getConfig(): Promise<EnterpriseConfig>
  async setConfig(config): Promise<void>
  
  // Enterprise repo
  async syncEnterpriseRepo(): Promise<void>
  async getEnterpriseRepoStatus(): Promise<EnterpriseRepoStatus>
  
  // Repo discovery
  async listEnterpriseRepos(): Promise<EnterpriseRepoInfo[]>
  async detectRepoFeatures(repo): Promise<{hasConstitution, hasSpecs}>
  
  // Spec derivation
  async deriveSpec(request): Promise<DeriveSpecResult>
  
  // Constitution
  async getEffectiveConstitution(localRepoPath): Promise<MergedConstitution>
}
```
- **Test File**: `src/main/services/EnterpriseService.test.ts`

### IPC Layer

#### 5. Enterprise IPC Handlers (New)
**File**: `src/main/ipc/handlers/enterprise.handlers.ts`  
**Channels**: All `ent:*` operations
```typescript
export function registerEnterpriseHandlers(enterpriseService: EnterpriseService) {
  ipcMain.handle('ent:getConfig', ...)
  ipcMain.handle('ent:setConfig', ...)
  ipcMain.handle('ent:listRepos', ...)
  ipcMain.handle('ent:syncEnterpriseRepo', ...)
  ipcMain.handle('ent:deriveSpec', ...)
  ipcMain.handle('ent:getEffectiveConstitution', ...)
  ipcMain.handle('ent:listPrompts', ...)
  ipcMain.handle('ent:getPrompt', ...)
}
```
- Validate inputs with Zod schemas
- Thin handlers - delegate to EnterpriseService
- **Test File**: `src/main/ipc/handlers/enterprise.handlers.test.ts`

#### 6. Update IPC Registration (Modify)
**File**: `src/main/ipc/register.ts`  
**Changes**:
- Import and instantiate services
- Register enterprise handlers
- Export service instances for reuse

#### 7. Update Preload Bridge (Modify)
**File**: `src/main/preload.ts` or `src/preload/index.ts`  
**Changes**:
- Add `electronAPI.enterprise.*` methods
- Expose all `ent:*` channels

### Renderer Layer

#### 8. IPC Client Wrapper (New)
**File**: `src/renderer/services/ipcClient.ts`  
**Purpose**: Type-safe wrapper around `window.electronAPI`
```typescript
export const ipcClient = {
  enterprise: {
    async getConfig(): Promise<EnterpriseConfig> { ... },
    async setConfig(config): Promise<void> { ... },
    async listRepos(): Promise<EnterpriseRepoInfo[]> { ... },
    async deriveSpec(request): Promise<DeriveSpecResult> { ... },
    // ... all enterprise methods
  },
  // Wrap existing context, git, ai methods
}
```

#### 9. Pinia Store (New)
**File**: `src/renderer/stores/enterpriseStore.ts`  
**State**:
```typescript
{
  config: EnterpriseConfig | null
  repos: EnterpriseRepoInfo[]
  enterpriseRepoStatus: EnterpriseRepoStatus | null
  prompts: PromptTemplate[]
  loading: boolean
  error: string | null
}
```
**Actions**: loadConfig, saveConfig, loadRepos, deriveSpec, etc.

#### 10. Vue Components (New)

**EnterpriseDashboard.vue**  
`src/renderer/views/EnterpriseDashboard.vue`
- Table of org repos
- Status badges (hasConstitution, hasSpecs)
- Actions: derive spec, view constitution
- Material 3 + Tailwind v4

**EnterpriseSettings.vue**  
`src/renderer/components/enterprise/EnterpriseSettings.vue`
- Form for enterprise config
- Test connection buttons
- Save/cancel actions

**ConstitutionViewer.vue**  
`src/renderer/components/enterprise/ConstitutionViewer.vue`
- Display merged constitution
- Color-coded sections (global/local/conflict)
- Diff highlighting

#### 11. Router Updates (Modify)
**File**: `src/renderer/config/routes.ts` or router file  
**Add Routes**:
- `/enterprise` → EnterpriseDashboard
- `/enterprise/settings` → EnterpriseSettings
- `/enterprise/constitution/:repo` → ConstitutionViewer

### Quality & Testing

#### 12. Unit Tests
- Write tests for all new services
- Test domain logic (PromptRegistry, ConstitutionMerger)
- Test IPC handlers
- Use Vitest as configured

#### 13. Refactor Existing Handlers (Optional but Recommended)
**Files**: `src/main/ipc/handlers/*.handlers.ts`  
**Goal**: Update to follow clean architecture
- Extract logic to services
- Make handlers thin validators

#### 14. Lint & Format
- Run `pnpm lint`
- Run `pnpm format`
- Fix all issues

#### 15. Type Check
- Run `pnpm typecheck`
- Fix all type errors

#### 16. Integration Testing
- Test existing context-repo functionality
- Test new enterprise features end-to-end
- Verify no breaking changes

#### 17. Update DESIGN_SYSTEM.md
- Document Material 3 + Tailwind v4 patterns
- Add examples of new components
- Ensure UI consistency

## Implementation Order

### Phase 1: Domain & Service Foundation
1. ✅ Documentation
2. ✅ Type definitions
3. ✅ PromptRegistry
4. ConstitutionMerger
5. Refactor GitService
6. Create GitHubService
7. Create AIService (wrapper)
8. Create EnterpriseService

### Phase 2: IPC Integration
9. Enterprise IPC handlers
10. Update IPC registration
11. Update preload bridge
12. IPC client wrapper

### Phase 3: UI Layer
13. Pinia enterprise store
14. Enterprise components (3 files)
15. Router updates

### Phase 4: Quality
16. Unit tests for all services
17. Lint & format
18. Type check
19. Integration testing
20. Update DESIGN_SYSTEM.md

## Notes

- **No breaking changes**: Existing functionality must continue to work
- **Incremental**: Each piece should be reviewable independently
- **Quality first**: Follow rules - no shortcuts
- **Type safety**: Zod validation, strict TypeScript
- **Testing**: Unit tests for all services and domain logic

## Current Blockers

None - ready to continue with ConstitutionMerger

## Questions / Decisions

- [ ] Should GitService be made static for operations that don't need instance state?
- [ ] Should we keep both LangChainAIService and AIService, or consolidate?
- [ ] Do we need a migration guide for updating existing IPC calls to use ipcClient?

## Cost Estimation

**Estimated remaining token usage**: ~100K tokens for complete implementation with tests
**Estimated time**: 3-4 sessions to complete all phases
**Complexity**: High - large architectural refactoring across multiple layers

---

**Last Updated**: 2025-11-08 15:59 UTC  
**Updated By**: Warp AI Assistant
