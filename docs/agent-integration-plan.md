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

## Resources

- AGENTS.md Spec: https://agents.md/
- OpenAI Agents Guide: https://github.com/openai/agents.md
- Project AGENTS.md: `/AGENTS.md`
- Architecture Docs: `/docs/architecture/`
