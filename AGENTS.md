# AGENTS.md

A guide for AI coding agents working on **My Context Kit**

## Project Overview

My Context Kit is an Electron-based desktop application for managing context repositories. It provides AI-powered assistance for validating, navigating, and maintaining structured context graphs for features, tasks, services, and dependencies.

## Tech Stack

- **Framework**: Electron with Vue 3 (Composition API)
- **State Management**: Pinia stores
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS with Material 3 design tokens
- **AI Providers**: Azure OpenAI, Ollama

## Architecture

### Current AI Assistant Architecture (Needs Unification)

The application currently has **TWO separate AI assistant implementations** that should be unified:

#### 1. Legacy AI Assistant (`aiStore` + `AIAssistantModal.vue`)
**Location**: `app/src/renderer/stores/aiStore.ts`, `app/src/renderer/components/AIAssistantModal.vue`

**Features**:
- Direct AI API calls via `window.api.ai.assist()`
- Conversation history with user/assistant messages
- Three modes: `general`, `improvement`, `clarification`
- Quick prompt generation
- Edit suggestions with apply workflow
- Streaming support (`askStream`)
- Custom prompt configuration
- Token usage tracking
- Logprobs support

**Data Model**:
```typescript
interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: 'improvement' | 'clarification' | 'general';
  focusId?: string;
  suggestions?: AssistantSuggestion[];
  clarifications?: string[];
  followUps?: string[];
  references?: AssistantReference[];
  edits?: AssistantEdit[];
  logprobs?: TokenProbability[];
}
```

#### 2. Safe Tooling Assistant (`assistantStore` + `ToolPanel.vue`)
**Location**: `app/src/renderer/stores/assistantStore.ts`, `app/src/renderer/components/assistant/`

**Features**:
- Session-based architecture with tool guards
- Pipeline execution: `validate`, `build-graph`, `impact`, `generate`
- Context file reading with metadata
- Approval workflow for risky operations
- Tool telemetry and audit logging
- Provider-agnostic (Azure OpenAI, Ollama)
- Structured tool descriptors with JSON schema
- Pending action management

**Data Model**:
```typescript
interface AssistantSession {
  id: string;
  provider: AssistantProvider;
  systemPrompt: string;
  messages: ConversationTurn[];
  activeTools: ToolDescriptor[];
  pendingApprovals: PendingAction[];
  telemetry: ToolInvocationRecord[];
}
```

### Recommended Unification Strategy

**Goal**: Merge both implementations into a single, flexible assistant architecture that supports:
- Session-based tool execution (from Safe Tooling)
- Conversational AI with streaming (from Legacy)
- Approval workflows and telemetry (from Safe Tooling)
- Custom prompts and edit suggestions (from Legacy)

**Steps**:
1. **Adopt `assistantStore` as the base** - It has better architecture with sessions, tools, and approvals
2. **Migrate `aiStore` features** into `assistantStore`:
   - Add streaming conversation support
   - Port edit suggestion/apply workflow
   - Integrate custom prompt configuration
   - Add modes (improvement/clarification/general) as tool metadata
3. **Create unified UI components**:
   - Combine modal and panel interfaces
   - Use tabs or sections for different workflows
   - Reuse `TranscriptView`, `ResponsePane`, `ApprovalDialog`
4. **Deprecate `aiStore` and `AIAssistantModal`** after migration
5. **Update bridge** (`app/src/preload/assistantBridge.ts`) to support all features

## Development Guidelines

### Directory Structure
```
app/
├── src/
│   ├── main/              # Electron main process
│   │   ├── ipc/handlers/  # IPC handlers for renderer<->main
│   │   └── services/      # Business logic services
│   ├── preload/           # Context isolation bridges
│   ├── renderer/          # Vue frontend
│   │   ├── components/    # Vue components
│   │   ├── stores/        # Pinia state stores
│   │   └── types/         # TypeScript type definitions
│   └── shared/            # Shared types between main/renderer
context-repo/              # Example context repository
docs/                      # Architecture documentation
```

### Package Management
- Use `pnpm` for dependency management
- Run `pnpm install` after pulling changes
- Check `package.json` in root and `app/` for scripts

### Testing
- Unit tests: `pnpm test` (Vitest)
- E2E tests: Not yet implemented
- Linting: `pnpm lint` (ESLint)
- Type checking: `pnpm typecheck` (TypeScript)

### Build & Run
- Development: `pnpm dev` (starts Electron with hot reload)
- Build: `pnpm build` (builds renderer and main)
- Package: `pnpm package` (creates distributable)

### Code Style
- **Language**: TypeScript with strict mode
- **Formatting**: 2-space indentation, semicolons
- **Vue**: Composition API with `<script setup>`
- **State**: Pinia stores with composition pattern (`defineStore` with function)
- **Styling**: Tailwind utility classes, Material 3 design tokens (e.g., `bg-surface`, `text-secondary-900`)
- **File naming**: kebab-case for components (`AIAssistantModal.vue`), camelCase for stores (`aiStore.ts`)

### Key Patterns

#### IPC Communication
```typescript
// Main process (handler)
ipcMain.handle('assistant:createSession', async (event, payload) => {
  return assistantSessionManager.createSession(payload);
});

// Preload (bridge)
export const assistantBridge = {
  createSession: (payload) => ipcRenderer.invoke('assistant:createSession', payload)
};

// Renderer (component)
const result = await window.api.assistant.createSession(payload);
```

#### Pinia Store Pattern
```typescript
export const useMyStore = defineStore('my-store', () => {
  // State
  const data = ref<Data[]>([]);
  const isLoading = ref(false);
  
  // Computed
  const hasData = computed(() => data.value.length > 0);
  
  // Actions
  async function loadData() {
    isLoading.value = true;
    try {
      const result = await window.api.getData();
      data.value = result;
    } finally {
      isLoading.value = false;
    }
  }
  
  return { data, isLoading, hasData, loadData };
});
```

#### Component Structure
```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMyStore } from '@/stores/myStore';

interface Props {
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const myStore = useMyStore();
const localState = ref('');

const computed = computed(() => /* ... */);

function handleAction() {
  // ...
}
</script>

<template>
  <div>
    <!-- Tailwind + Material 3 -->
  </div>
</template>
```

### AI Assistant Guidelines

When working with AI features:

1. **Always use the session-based approach** from `assistantStore`
2. **Guard risky operations** with approval workflows
3. **Log telemetry** for all tool invocations
4. **Validate tool parameters** against JSON schemas
5. **Handle streaming gracefully** with partial updates
6. **Provide clear error messages** to users
7. **Support both Azure OpenAI and Ollama** providers

### Repository Context

The app works with "context repositories" structured like:
```
context-repo/
├── .context/
│   ├── config.yaml          # Repository configuration
│   └── ai-prompts.json      # Custom AI prompts
├── contexts/
│   ├── features/            # Feature definitions
│   ├── tasks/               # Task definitions
│   ├── services/            # Service definitions
│   ├── specs/               # Specification files
│   └── governance/          # Governance rules
└── graph/
    └── dependencies.json    # Auto-generated dependency graph
```

## Common Tasks

### Adding a New Tool to Assistant
1. Define tool descriptor in `app/src/main/services/assistantSessionManager.ts`
2. Create tool implementation in `app/src/main/services/tools/`
3. Register tool in provider configuration
4. Add JSON schema for input/output validation
5. Update `ToolCapability` type if needed
6. Add telemetry logging
7. Add approval check if tool has side effects

### Adding a New Pipeline
1. Create pipeline in `context-repo/pipelines/`
2. Add pipeline name to `AssistantPipelineName` type
3. Implement pipeline executor in main process
4. Add UI option in `ToolPanel.vue` pipeline dropdown
5. Document expected args and output format

### Updating AI Prompts
1. Edit `app/src/renderer/types/ai-prompts.ts` for defaults
2. Update `.context/ai-prompts.json` in context repos
3. Use `loadPrompts()` and `savePrompts()` in `aiStore`
4. Test with different modes: general, improvement, clarification

## Custom Agent Profiles (In Development)

My Context Kit supports custom AI agent profiles based on the [AGENTS.md specification](https://agents.md/). This allows users to create specialized assistants for different development tasks.

### Built-in Agents

The application includes 7 pre-configured agent profiles:

1. **Context Assistant** (🤖) - General context repository management
2. **Code Reviewer** (👁️) - Code quality and best practices review
3. **Documentation Writer** (📝) - Technical documentation generation
4. **Test Generator** (🧪) - Unit and integration test creation
5. **Refactoring Assistant** (♻️) - Code improvement suggestions
6. **Architecture Advisor** (🏗️) - System design guidance
7. **Debugger** (🐛) - Bug diagnosis and fixing assistance

### Creating Custom Agents

Users can create custom agent profiles in `.context/agents.json` within their context repositories:

```json
{
  "version": "1.0.0",
  "agents": [
    {
      "id": "my-custom-agent",
      "metadata": {
        "name": "My Custom Agent",
        "description": "Specialized for our team's workflow",
        "tags": ["custom", "team-specific"],
        "complexity": "moderate",
        "icon": "⚡"
      },
      "systemPrompt": "You are a specialized assistant...",
      "tools": [
        {
          "toolId": "context.read",
          "required": true,
          "capabilities": ["read"]
        }
      ],
      "config": {
        "temperature": 0.7,
        "maxTokens": 2000
      }
    }
  ]
}
```

### Agent Profile Properties

- **id**: Unique identifier (kebab-case)
- **metadata**: Display information (name, description, tags, icon)
- **systemPrompt**: Defines agent behavior and personality
- **tools**: Required/optional tools with capabilities
- **config**: Temperature, max tokens, prompt templates
- **examples**: Sample interactions demonstrating agent behavior

### Using Agents

1. Select an agent from the assistant UI
2. Agent's system prompt and tools are applied to the session
3. Agent-specific configurations control AI behavior
4. Teams can share agents via Git-versioned context repositories

**Implementation Details**: See `docs/agent-integration-plan.md`

## Known Issues & TODOs

- [ ] **Unify AI assistant implementations** (aiStore + assistantStore) - Agent profiles provide migration path
- [x] **Design custom agent data model** - Types defined in `app/src/shared/agents/types.ts`
- [x] **Create built-in agent templates** - 7 agents in `app/src/main/services/agents/builtInAgents.ts`
- [ ] Implement agent storage service and IPC handlers
- [ ] Create agent management UI components (selector, editor, library)
- [ ] Integrate agent profiles with assistantStore
- [ ] Implement E2E tests with Playwright
- [ ] Add streaming support to assistantStore
- [ ] Create unified UI component for assistant
- [ ] Document all tool schemas
- [ ] Add retry logic for failed AI requests
- [ ] Improve error handling in pipelines
- [ ] Add context file editing (currently read-only)

## Resources

- Architecture: `docs/architecture/c4-component.md`
- AI Enhancements: `docs/ai-enhancements-completed.md`
- Example Repository: `context-repo/`

## Contact

For questions about this project, refer to the documentation in `docs/` or examine existing patterns in the codebase.
