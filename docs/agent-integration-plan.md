# Custom Agent Integration Implementation Plan

## Overview

This document outlines the plan to integrate the AGENTS.md specification into My Context Kit, enabling users to create and manage custom AI agent profiles.

**Related**: https://agents.md/

## Goals

1. Allow users to create custom agent profiles with specialized behaviors
2. Store and share agent profiles via AGENTS.md files in context repositories
3. Integrate agent profiles seamlessly with the existing assistant architecture
4. Provide built-in agent templates for common development tasks
5. Support the unification of `aiStore` and `assistantStore` through agent profiles

## Architecture

### Data Model

**Location**: `app/src/shared/agents/types.ts` ✅

Key interfaces:
- `AgentProfile`: Complete agent definition with metadata, system prompt, tools, and config
- `AgentMetadata`: Display information, tags, complexity level
- `AgentToolRequirement`: Tools needed by the agent
- `AgentProfileDocument`: Storage format for AGENTS.md files

### Built-in Agents

**Location**: `app/src/main/services/agents/builtInAgents.ts` ✅

7 pre-configured agent profiles:
1. **Context Assistant** (🤖) - General context repository management
2. **Code Reviewer** (👁️) - Code quality and best practices
3. **Documentation Writer** (📝) - Technical documentation generation
4. **Test Generator** (🧪) - Unit and integration test creation
5. **Refactoring Assistant** (♻️) - Code improvement suggestions
6. **Architecture Advisor** (🏗️) - System design guidance
7. **Debugger** (🐛) - Bug diagnosis and fixing

## Implementation Tasks

### 1. Agent Storage Service (Main Process)

**File**: `app/src/main/services/agents/agentProfileService.ts`

```typescript
class AgentProfileService {
  // Read AGENTS.md file from context repository
  async loadAgentsFile(repoPath: string): Promise<AgentProfileDocument>
  
  // Save AGENTS.md file to context repository
  async saveAgentsFile(repoPath: string, document: AgentProfileDocument): Promise<void>
  
  // List all available agents (built-in + custom)
  async listAgents(repoPath: string): Promise<AgentProfile[]>
  
  // Get specific agent by ID
  async getAgent(repoPath: string, agentId: string): Promise<AgentProfile | null>
  
  // Create new custom agent
  async createAgent(repoPath: string, agent: AgentProfile): Promise<void>
  
  // Update existing agent
  async updateAgent(repoPath: string, agent: AgentProfile): Promise<void>
  
  // Delete custom agent
  async deleteAgent(repoPath: string, agentId: string): Promise<void>
  
  // Validate agent profile against schema
  validateAgent(agent: AgentProfile): ValidationResult
}
```

### 2. IPC Handlers

**File**: `app/src/main/ipc/handlers/agent.handlers.ts`

Expose agent management operations to renderer:
- `agent:list` - List all agents
- `agent:get` - Get agent by ID
- `agent:create` - Create new agent
- `agent:update` - Update agent
- `agent:delete` - Delete agent
- `agent:validate` - Validate agent profile

### 3. Preload Bridge

**File**: `app/src/preload/agentBridge.ts`

```typescript
export const agentBridge = {
  listAgents: (repoPath: string) => ipcRenderer.invoke('agent:list', repoPath),
  getAgent: (repoPath: string, agentId: string) => ipcRenderer.invoke('agent:get', repoPath, agentId),
  createAgent: (repoPath: string, agent: AgentProfile) => ipcRenderer.invoke('agent:create', repoPath, agent),
  updateAgent: (repoPath: string, agent: AgentProfile) => ipcRenderer.invoke('agent:update', repoPath, agent),
  deleteAgent: (repoPath: string, agentId: string) => ipcRenderer.invoke('agent:delete', repoPath, agentId),
  validateAgent: (agent: AgentProfile) => ipcRenderer.invoke('agent:validate', agent)
};
```

### 4. Pinia Store (Renderer)

**File**: `app/src/renderer/stores/agentStore.ts`

```typescript
export const useAgentStore = defineStore('agent', () => {
  // State
  const availableAgents = ref<AgentProfile[]>([]);
  const selectedAgentId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const selectedAgent = computed(() => 
    availableAgents.value.find(a => a.id === selectedAgentId.value)
  );
  
  const builtInAgents = computed(() => 
    availableAgents.value.filter(a => a.metadata.isBuiltIn)
  );
  
  const customAgents = computed(() => 
    availableAgents.value.filter(a => !a.metadata.isBuiltIn)
  );

  // Actions
  async function loadAgents(repoPath: string): Promise<void>
  async function selectAgent(agentId: string): Promise<void>
  async function createAgent(agent: AgentProfile): Promise<void>
  async function updateAgent(agent: AgentProfile): Promise<void>
  async function deleteAgent(agentId: string): Promise<void>
  
  function filterAgents(criteria: AgentSearchCriteria): AgentProfile[]
  
  return {
    availableAgents,
    selectedAgentId,
    selectedAgent,
    builtInAgents,
    customAgents,
    isLoading,
    error,
    loadAgents,
    selectAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    filterAgents
  };
});
```

### 5. Integration with assistantStore

**File**: `app/src/renderer/stores/assistantStore.ts` (modifications)

Add agent profile support to session creation:

```typescript
// Modify createSession to accept optional agent profile
async function createSession(payload: CreateSessionPayload & { agentProfile?: AgentProfile }) {
  const systemPrompt = payload.agentProfile?.systemPrompt ?? payload.systemPrompt;
  const activeTools = payload.agentProfile?.tools?.map(t => t.toolId) ?? payload.activeTools;
  
  // Apply agent-specific configuration
  const sessionConfig = {
    ...payload,
    systemPrompt,
    activeTools,
    temperature: payload.agentProfile?.config?.temperature,
    maxTokens: payload.agentProfile?.config?.maxTokens
  };
  
  const created = await bridge.createSession(sessionConfig);
  applySession(created);
}
```

### 6. UI Components

#### AgentSelector Component

**File**: `app/src/renderer/components/assistant/AgentSelector.vue`

Dropdown/modal for selecting active agent:
- Display agent icon, name, description
- Filter by tags and complexity
- Show built-in vs custom agents
- Preview agent capabilities

#### AgentLibrary Component

**File**: `app/src/renderer/components/assistant/AgentLibrary.vue`

Browse and manage agents:
- Grid/list view of available agents
- Search and filter functionality
- Create new agent button
- Edit/delete custom agents
- Import/export agents

#### AgentProfileEditor Component

**File**: `app/src/renderer/components/assistant/AgentProfileEditor.vue`

Create/edit agent profiles:
- Basic info (name, description, icon)
- System prompt editor with preview
- Tool requirements selector
- Configuration options (temperature, max tokens)
- Example interactions
- Save/cancel actions

### 7. Context Assistant Integration

**File**: `app/src/renderer/components/assistant/ToolPanel.vue` (modifications)

Add agent selector to assistant UI:
```vue
<template>
  <section class="space-y-4">
    <!-- Agent Selector -->
    <AgentSelector 
      v-model="selectedAgentId" 
      @change="handleAgentChange"
    />
    
    <!-- Existing pipeline and context tools -->
    <!-- ... -->
  </section>
</template>
```

### 8. AGENTS.md File Format

**Location**: `context-repo/.context/AGENTS.md`

```markdown
# AI Agents Configuration

This file defines custom AI agent profiles for the context repository.

## Version

1.0.0

## Agents

### Code Reviewer

**ID**: `code-reviewer`  
**Description**: Reviews code changes for quality and best practices  
**Tags**: code-review, validation, security  
**Complexity**: advanced

**System Prompt**:
```
You are an expert Code Reviewer focused on maintaining high code quality...
```

**Tools Required**:
- `context.read` (required)

**Configuration**:
- Temperature: 0.3
- Max Tokens: 3000

---

### Custom Agent Example

**ID**: `my-custom-agent`  
**Description**: Specialized agent for our team's workflow  
**Tags**: custom, team-specific  
**Complexity**: moderate

**System Prompt**:
```
You are a specialized assistant for our team...
```

(More configuration follows...)
```

Alternative: Store as JSON in `.context/agents.json`

## Testing Strategy

### Unit Tests

**File**: `app/tests/services/agentProfileService.spec.ts`

- Test agent loading from AGENTS.md files
- Test agent validation
- Test CRUD operations
- Test built-in agent retrieval

**File**: `app/tests/stores/agentStore.spec.ts`

- Test agent selection
- Test filtering and search
- Test integration with assistantStore

### Integration Tests

- Test full workflow: create agent → select agent → create session
- Test agent profile persistence
- Test cross-provider compatibility (Azure OpenAI, Ollama)

## Migration Path for Unification

Agent profiles provide a natural bridge for unifying `aiStore` and `assistantStore`:

1. **Phase 1**: Implement agent profiles with `assistantStore`
2. **Phase 2**: Create agent profiles that replicate `aiStore` behaviors
3. **Phase 3**: Migrate `AIAssistantModal` to use `assistantStore` + agents
4. **Phase 4**: Deprecate `aiStore` entirely

Example migration:

```typescript
// Old aiStore approach
await aiStore.ask(question, { mode: 'improvement', focusId: 'FEAT-001' });

// New agent-based approach
const improvementAgent = agentStore.getAgent('improvement-assistant');
await assistantStore.createSession({ agentProfile: improvementAgent });
await assistantStore.sendMessage({ content: question, focusId: 'FEAT-001' });
```

## Benefits

1. **Flexibility**: Users can create agents for specific workflows
2. **Sharing**: Teams can share agent profiles via Git
3. **Consistency**: Standardized agent behaviors across team
4. **Extensibility**: Easy to add new agent types
5. **Unification**: Provides path to merge assistant implementations

## Security Considerations

1. **Prompt Injection**: Validate and sanitize user-provided system prompts
2. **Tool Access**: Enforce tool capability restrictions from agent profiles
3. **File Access**: Validate AGENTS.md file structure before parsing
4. **Approval Workflows**: Maintain approval requirements for risky operations

## Next Steps

1. ✅ Create type definitions (`app/src/shared/agents/types.ts`)
2. ✅ Create built-in agent templates (`app/src/main/services/agents/builtInAgents.ts`)
3. ⏳ Implement agent storage service
4. ⏳ Add IPC handlers and preload bridge
5. ⏳ Create Pinia store for agent management
6. ⏳ Build UI components
7. ⏳ Integrate with assistantStore
8. ⏳ Add to ToolPanel/assistant UI
9. ⏳ Write tests
10. ⏳ Update documentation

## Estimated Effort

- **Types & Templates**: 2-3 hours ✅ DONE
- **Storage Service**: 4-6 hours
- **IPC & Bridge**: 2-3 hours
- **Pinia Store**: 3-4 hours
- **UI Components**: 8-10 hours
- **Integration**: 4-6 hours
- **Testing**: 6-8 hours
- **Documentation**: 2-3 hours

**Total**: ~31-43 hours of development work

## LangChain Integration Patterns

### Capability Toggle UI Pattern

**Location**: `app/src/renderer/components/assistant/ToolPanel.vue`

**Implementation**:
- Capabilities loaded via `assistantStore.loadCapabilities()` on component mount
- UI displays all pipeline options (validate, build-graph, impact, generate) regardless of capability state
- Backend capability enforcement occurs at LangChain service layer
- Graceful degradation: when backend unavailable, all pipelines remain selectable (UI allows operation attempts)

**UI Elements**:
```vue
<select 
  data-testid="pipeline-select"
  v-model="selectedPipeline"
  class="bg-surface-container text-on-surface rounded-m3-lg"
>
  <option value="validate">Validate Entities</option>
  <option value="build-graph">Build Dependency Graph</option>
  <option value="impact">Impact Analysis</option>
  <option value="generate">Generate Artifacts</option>
</select>

<button 
  data-testid="run-pipeline-button"
  @click="handleRunPipeline"
  :disabled="!selectedPipeline"
>
  Run Pipeline
</button>
```

**Test Strategy Evolution**:
- **Current (Phase 1)**: Structural UI tests validate component rendering, option selection, and entity ID inputs (see `app/e2e/assistant-capabilities.spec.ts`)
- **Future (Phase 2)**: Once IPC mocking or main-process network interception available, add backend capability enforcement tests that verify disabled capabilities prevent pipeline execution

**Rationale**: Playwright cannot intercept `fetch()` calls in Electron main process, so capability enforcement at backend layer cannot be tested with current harness. UI structural validation provides regression coverage while business rule coverage is deferred.

### Health Workflow Polling Behavior

**Location**: `app/src/renderer/stores/assistantStore.ts`

**Implementation**:
- Health polling initiated via `startHealthMonitoring(intervalMs: number)`
- Default interval: 30 seconds (configurable)
- Polling uses exponential backoff on consecutive failures
- Health state stored in reactive `healthStatus` ref with properties:
  - `status: 'healthy' | 'degraded' | 'unavailable'`
  - `lastChecked: Date`
  - `latencyMs: number`
  - `errorCount: number`

**Health Check Flow**:
```
Renderer (assistantStore) 
  → Preload (assistantBridge.checkHealth())
  → Main Process (IPC handler 'assistant:health')
  → LangChain Service (GET /assistant/health)
  → Response flows back through chain
  → Store updates healthStatus and emits telemetry event
```

**UI Integration**:
- `HealthBanner.vue` displays health status banner when degraded/unavailable
- Color-coded indicators: green (healthy), yellow (degraded), red (unavailable)
- Banner includes retry action and last-checked timestamp
- Auto-dismisses when health restored

**Backoff Strategy**:
```typescript
// Exponential backoff for failed health checks
let retryInterval = baseInterval;
if (healthStatus.value.errorCount > 0) {
  retryInterval = Math.min(
    baseInterval * Math.pow(2, healthStatus.value.errorCount),
    maxInterval // cap at 5 minutes
  );
}
```

### Path Resolution Strategy (IPC-Based)

**Problem**: Renderer process needs access to context repository paths and validation pipeline outputs, but filesystem operations must execute in main process for security (context isolation).

**Solution**: IPC-mediated path resolution service

**Location**: `app/src/main/ipc/handlers/path.handlers.ts`

**IPC Handlers**:
- `path:resolveContextRepo` - Resolve context repo root from workspace
- `path:readContextFile` - Read YAML context file with metadata
- `path:listContextFiles` - List all context files by type (feature, task, spec, etc.)
- `path:resolvePipelineOutput` - Get path to pipeline output (graph, validation report)

**Preload Bridge**: `app/src/preload/pathBridge.ts`

**Usage Pattern**:
```typescript
// Renderer (component or store)
const contextFile = await window.api.path.readContextFile('contexts/features/FEAT-001.yaml');

// Main process handler ensures:
// 1. Path is within allowed context repository boundaries
// 2. File exists and is readable
// 3. Response includes parsed YAML + metadata (lastModified, size, path)
```

**Security Boundaries**:
- Path traversal prevention: validate all paths are within context-repo
- Read-only access: no write operations exposed to renderer for context files
- Pipeline execution: separate IPC channel (`pipeline:run`) with approval workflow

**C4 Documentation**: See `context-repo/c4/component-sync.md` for Assistant Bridge component showing IPC boundaries and data flow.

### Backend Mocking Plan

**Challenge**: Current test harness cannot intercept Electron main process network calls (`fetch()` in Node.js runtime), blocking full capability enforcement testing.

**Future Solutions** (prioritized):

1. **IPC Stub Layer** (Recommended)
   - Intercept at IPC boundary before main process handlers
   - Mock `assistantBridge` methods in preload during test execution
   - Playwright fixture provides mock implementations
   - **Pros**: No changes to main process code, clean test isolation
   - **Cons**: Requires custom Playwright fixture extension

2. **Main Process Network Interception**
   - Use `nock` or `msw/node` in main process during tests
   - Inject mock server before IPC handlers execute
   - **Pros**: Tests real IPC path, closer to production
   - **Cons**: Requires test-only dependencies in main process, more complex setup

3. **Dedicated Test Backend**
   - Run lightweight mock LangChain service during E2E tests
   - Returns configurable capability profiles
   - **Pros**: Tests full integration stack
   - **Cons**: Requires separate service lifecycle management, slower tests

**Recommendation**: Implement IPC Stub Layer (Option 1) in Phase 7. This provides clean test isolation without modifying production code paths and enables comprehensive capability enforcement testing.

**Implementation Sketch**:
```typescript
// app/e2e/helpers/mockAssistantBridge.ts
export function createMockAssistantBridge(capabilityProfile: CapabilityProfile) {
  return {
    checkHealth: async () => ({ status: 'healthy', latencyMs: 50 }),
    loadCapabilities: async () => capabilityProfile,
    createSession: async (payload) => ({ id: 'mock-session-id', ...payload }),
    // ... other mocked methods
  };
}

// app/e2e/assistant-capabilities.spec.ts (future enhanced test)
test('pipeline execution blocked when capability disabled', async ({ page }) => {
  // Inject mock bridge with impact capability disabled
  await page.addInitScript(() => {
    window.api.assistant = createMockAssistantBridge({
      pipelines: { impact: false }
    });
  });
  
  // Navigate and attempt pipeline run
  await page.click('[data-testid="pipeline-select"]');
  await page.selectOption('[data-testid="pipeline-select"]', 'impact');
  await page.click('[data-testid="run-pipeline-button"]');
  
  // Verify error message displayed
  await expect(page.locator('[data-testid="error-banner"]')).toContainText(
    'Impact analysis capability is not enabled'
  );
});
```

## Resources

- AGENTS.md Spec: https://agents.md/
- OpenAI Agents Guide: https://github.com/openai/agents.md
- Project AGENTS.md: `/AGENTS.md`
- Architecture Docs: `/docs/architecture/`
- LangChain Integration Spec: `/specs/001-langchain-backend-integration/`
- C4 Component Diagram: `/context-repo/c4/component-sync.md`
