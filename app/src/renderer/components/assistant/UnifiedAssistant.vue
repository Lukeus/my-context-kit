<template>
  <div
    ref="containerRef"
    class="unified-assistant flex flex-col h-full bg-surface"
    role="region"
    aria-label="Unified AI Assistant"
    :data-assistant-focus="currentFocus"
    tabindex="-1"
  >
    <!-- T040: Screen reader announcements -->
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {{ announcements }}
    </div>
    
    <!-- Header - Copilot Style -->
    <header class="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <!-- Left: Title and Status -->
      <div class="flex items-center gap-2 min-w-0">
        <h2 class="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Assistant
        </h2>
        <GatingStatusBadge
          v-if="hasSession"
          :status="gatingStatus"
          :is-classification-enforced="isClassificationEnforced"
          :is-limited-read-only="isLimitedReadOnlyMode"
          :is-retrieval-enabled="isRetrievalEnabled"
          class="text-[10px]"
        />
        <ProviderBadge v-if="hasSession" :provider="session!.provider" class="text-[10px]" />
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-0.5">
        <button
          v-if="hasSession"
          class="p-1.5 rounded hover:bg-gray-100 transition-colors"
          @click="handleNewSession"
          aria-label="New session"
          title="Start new conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 text-gray-600">
            <path d="M8.75 3.75a.75.75 0 00-1.5 0v3.5h-3.5a.75.75 0 000 1.5h3.5v3.5a.75.75 0 001.5 0v-3.5h3.5a.75.75 0 000-1.5h-3.5v-3.5z" />
          </svg>
        </button>
        <button
          v-if="hasSession"
          class="p-1.5 rounded hover:bg-gray-100 transition-colors"
          @click="handleRefreshCapabilities"
          aria-label="Refresh capabilities"
          title="Refresh"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 text-gray-600">
            <path fill-rule="evenodd" d="M13.836 2.477a.75.75 0 01.002 1.06A6.25 6.25 0 102.518 8a.75.75 0 011.5-.013 4.75 4.75 0 109.303-2.424l-.003-.002a.75.75 0 011.518-.084z" clip-rule="evenodd" />
          </svg>
        </button>
        <button
          class="p-1.5 rounded hover:bg-gray-100 transition-colors"
          :aria-pressed="showSettings"
          @click="showSettings = !showSettings"
          aria-label="Settings"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 text-gray-600">
            <path d="M6.955 1.45A.5.5 0 017.452 1h1.096a.5.5 0 01.497.45l.17 1.699a4.97 4.97 0 01.984.506l1.577-.67a.5.5 0 01.598.181l.548.95a.5.5 0 01-.122.58l-1.308 1.143a5.003 5.003 0 010 1.065l1.308 1.143a.5.5 0 01.122.58l-.548.95a.5.5 0 01-.598.181l-1.577-.67a4.97 4.97 0 01-.984.506l-.17 1.699a.5.5 0 01-.497.45H7.452a.5.5 0 01-.497-.45l-.17-1.699a4.973 4.973 0 01-.984-.506l-1.577.67a.5.5 0 01-.598-.181l-.548-.95a.5.5 0 01.122-.58l1.308-1.143a5.003 5.003 0 010-1.065L2.2 4.89a.5.5 0 01-.122-.58l.548-.95a.5.5 0 01.598-.181l1.577.67a4.97 4.97 0 01.984-.506l.17-1.699zM8 10a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Fallback Banner -->
    <DegradedModeBanner
      v-if="showFallbackBanner"
      :show="showFallbackBanner"
      :severity="fallbackSeverity"
      :message="fallbackMessage"
      :can-retry="true"
      @retry="handleRetryConnection"
      @close="showFallbackBanner = false"
    />

    <!-- Tab Navigation - Copilot Style -->
    <div class="flex items-center border-b border-gray-200 bg-white" v-if="hasSession">
      <button
        v-for="tab in panelOptions"
        :key="tab.id"
        class="relative px-4 py-2 text-xs font-medium transition-colors"
        :class="activePanel === tab.id ? 'text-gray-900 bg-gray-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'"
        @click="setActivePanel(tab.id)"
      >
        {{ tab.label }}
        <div
          v-if="activePanel === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
        />
      </button>
    </div>

    <!-- Main Content Area - Single Pane -->
    <div class="flex-1 overflow-hidden">
      <!-- Chat View - Copilot Style -->
      <div v-if="activePanel === 'chat'" class="flex flex-col h-full bg-white">
        <!-- Transcript -->
        <div class="flex-1 overflow-auto px-3 py-3">
          <TranscriptView
            :transcript="conversation"
            :tasks="tasks"
            :is-busy="isBusy"
            empty-message="Ask a question or describe a task..."
            data-assistant-focus="transcript"
          />
        </div>

        <!-- Message Composer -->
        <div class="border-t border-gray-200 px-3 py-2 bg-gray-50/50">
          <MessageComposer
            :disabled="!hasSession || isBusy"
            :streaming-enabled="streamingEnabled"
            @send="handleSendMessage"
            @toggle-streaming="handleToggleStreaming"
          />
        </div>
      </div>

      <!-- Tools View -->
      <div v-else-if="activePanel === 'tools'" class="h-full overflow-auto p-3">
        <ToolPanel />
      </div>

      <!-- Queue View -->
      <div v-else-if="activePanel === 'queue'" class="h-full overflow-auto">
        <ToolQueue
          :tasks="tasks"
          data-assistant-focus="tool-queue"
        />
      </div>

      <!-- Telemetry View -->
      <div v-else-if="activePanel === 'telemetry'" class="h-full overflow-auto">
        <TelemetryPanel
          :session-id="session?.id"
          :telemetry="telemetry"
          data-assistant-focus="telemetry-panel"
        />
      </div>
    </div>

    <!-- Approval Dialog Overlay -->
    <ApprovalDialog v-if="hasActivePending" />

    <!-- Settings Panel -->
    <teleport to="body">
      <div
        v-if="showSettings"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="showSettings = false"
      >
        <div class="w-full max-w-md bg-surface rounded-m3-lg shadow-elevation-3 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-outline">
            <h3 class="text-base font-medium text-on-surface">Settings</h3>
            <button 
              class="p-1 rounded-m3-sm text-on-surface-variant hover:bg-surface-variant transition-colors" 
              aria-label="Close settings" 
              @click="showSettings = false"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="flex items-center justify-between">
                <span class="text-sm text-on-surface font-medium">Streaming responses</span>
                <input 
                  v-model="streamingEnabled" 
                  type="checkbox" 
                  class="w-4 h-4 text-primary rounded border-outline focus:ring-2 focus:ring-primary/50"
                />
              </label>
              <p class="mt-1 text-xs text-on-surface-variant">Show AI responses as they're being generated in real-time (instead of waiting for the complete response)</p>
            </div>
            <div>
              <label class="block text-sm text-on-surface font-medium mb-2">Concurrency limit</label>
              <input
                v-model.number="concurrencyLimit"
                type="number"
                min="1"
                max="10"
                class="w-full px-3 py-2 text-sm bg-surface border border-outline rounded-m3-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                @change="handleSetConcurrency"
              />
              <p class="mt-1 text-xs text-on-surface-variant">How many tools the AI can run simultaneously (e.g., reading multiple files at once). Higher = faster but more resource usage</p>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';
import { useContextStore } from '@/stores/contextStore';
import { createFocusManager } from './a11y-map';
import { exportAndDownload } from '@/services/assistant/exporter';
import { getToolSafety, validateInvocation } from '@/services/assistant/toolClassification';
import { sanitizePrompt } from '@/services/assistant/promptSanitizer';
import { parseHashtagCommands } from '@/services/assistant/hashtagCommands';
import TranscriptView from './TranscriptView.vue';
import MessageComposer from './MessageComposer.vue';
import ToolPanel from './ToolPanel.vue';
import TelemetryPanel from './TelemetryPanel.vue';
import ApprovalDialog from './ApprovalDialog.vue';
import ProviderBadge from './ProviderBadge.vue';
import DegradedModeBanner from './DegradedModeBanner.vue';
import ToolQueue from './ToolQueue.vue';
import type { ToolDescriptor } from '@shared/assistant/types';
import GatingStatusBadge from './GatingStatusBadge.vue';

// Store integration
const assistantStore = useAssistantStore();
const contextStore = useContextStore();
const { session, conversation, tasks, telemetry, isBusy, activePending, health, capabilityProfile, gatingStatus, isClassificationEnforced, isLimitedReadOnlyMode, isRetrievalEnabled } = storeToRefs(assistantStore);

// Panel state
const activePanel = ref<'chat' | 'tools' | 'queue' | 'telemetry'>('chat');

// Panel options (tab navigation)
const panelOptions: Array<{ id: 'chat' | 'tools' | 'queue' | 'telemetry'; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'tools', label: 'Tools' },
  { id: 'queue', label: 'Queue' },
  { id: 'telemetry', label: 'Telemetry' }
];

function setActivePanel(panel: 'chat' | 'tools' | 'queue' | 'telemetry') {
  activePanel.value = panel;
  
  // Emit telemetry event for panel changes
  if (hasSession.value && session.value) {
    const evt = {
      id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      eventType: 'ui.panel.changed',
      sessionId: session.value.id,
      provider: session.value.provider,
      timestamp: new Date().toISOString(),
      data: {
        panel: panel,
        userInitiated: true
      }
    } as any;
    assistantStore.telemetryEvents.push(evt);
  }
}

const showSettings = ref(false);

// Local state
const containerRef = ref<HTMLElement | null>(null);
const currentFocus = ref<string | null>(null);
const showFallbackBanner = ref(false);
const fallbackSeverity = ref<'info' | 'warning' | 'error'>('warning');
const fallbackMessage = ref('');
const streamingEnabled = ref(true);
const concurrencyLimit = ref(3);
const announcements = ref('');

// Computed
const hasSession = computed(() => Boolean(session.value));
const hasActivePending = computed(() => Boolean(activePending.value));
const activeTools = computed((): ToolDescriptor[] => session.value?.activeTools ?? []);
const capabilities = computed(() => {
  // Convert CapabilityProfile to { [toolId]: { status: string } } format expected by ToolPalette
  const profile = capabilityProfile.value;
  if (!profile || !profile.capabilities) return {};
  return profile.capabilities;
});

// Focus management
let focusManager: ReturnType<typeof createFocusManager> | null = null;
let focusCleanup: (() => void) | null = null;

onMounted(() => {
  if (containerRef.value) {
    focusManager = createFocusManager(containerRef.value);
    focusManager.enableFocusTrap();
    focusCleanup = focusManager.attach();
  }
  checkHealthStatus();
  document.addEventListener('keydown', handleKeyboardNav);
});

onUnmounted(() => {
  focusCleanup?.();
  document.removeEventListener('keydown', handleKeyboardNav);
});

function handleKeyboardNav(e: KeyboardEvent) {
  if ((e.shiftKey && e.key === '?')) {
    e.preventDefault();
    announceToScreenReader('Shortcuts: Ctrl+1 chat, Ctrl+2 tools, Ctrl+3 queue, Ctrl+4 telemetry, Ctrl+R refresh, Esc close');
    return;
  }
  // Ctrl+1: Chat
  if ((e.ctrlKey || e.metaKey) && e.key === '1' && hasSession.value) {
    e.preventDefault();
    activePanel.value = 'chat';
    return;
  }
  // Ctrl+2: Tools
  if ((e.ctrlKey || e.metaKey) && e.key === '2' && hasSession.value) {
    e.preventDefault();
    activePanel.value = 'tools';
    return;
  }
  // Ctrl+3: Queue
  if ((e.ctrlKey || e.metaKey) && e.key === '3' && hasSession.value) {
    e.preventDefault();
    activePanel.value = 'queue';
    return;
  }
  // Ctrl+4: Telemetry
  if ((e.ctrlKey || e.metaKey) && e.key === '4' && hasSession.value) {
    e.preventDefault();
    activePanel.value = 'telemetry';
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    handleRefreshCapabilities();
    return;
  }
  if (e.key === 'Escape') {
    if (showSettings.value) showSettings.value = false;
    else if (activePanel.value !== 'chat') activePanel.value = 'chat';
    else if (showFallbackBanner.value) showFallbackBanner.value = false;
    else handleClose();
    e.preventDefault();
  }
}

// Accessibility announcements
function announceToScreenReader(message: string) {
  announcements.value = message;
  setTimeout(() => { announcements.value = ''; }, 1000);
}

function checkHealthStatus() {
  const healthStatus = health.value;
  if (!healthStatus) return;
  if (healthStatus.status === 'degraded') {
    showFallbackBanner.value = true;
    fallbackSeverity.value = 'warning';
    fallbackMessage.value = healthStatus.message || 'Sidecar connection degraded.';
    announceToScreenReader('Warning: Sidecar degraded');
  } else if (healthStatus.status === 'unhealthy') {
    showFallbackBanner.value = true;
    fallbackSeverity.value = 'error';
    fallbackMessage.value = healthStatus.message || 'Sidecar unavailable.';
    announceToScreenReader('Error: Sidecar unavailable');
  } else if (healthStatus.status === 'unknown') {
    showFallbackBanner.value = true;
    fallbackSeverity.value = 'warning';
    fallbackMessage.value = 'Unable to verify sidecar status.';
    announceToScreenReader('Warning: Sidecar status unknown');
  }
}

async function handleNewSession() {
  // Clear current session and create a new one with the improved system prompt
  streamingBuffer.value.clear();
  await assistantStore.createSession({
    provider: 'azure-openai',
    systemPrompt: `You are an AI assistant specialized in managing and analyzing Context Repositories for software development projects.

## Core Behavior
**BE SMART**: When a file isn't found, AUTOMATICALLY search for similar files. Don't just say "file not found" - be proactive!

## Your Purpose
Help users understand, navigate, and maintain their context repository - a structured collection of YAML entities that define features, tasks, user stories, specs, services, and their relationships.

## Context Repository Structure
The repository contains YAML entities in the \`contexts/\` directory:
- **Features**: High-level capabilities (contexts/features/*.yaml)
- **Tasks**: Implementation work items (contexts/tasks/*.yaml)
- **Userstories**: User-facing requirements (contexts/userstories/*.yaml)
- **Specs**: Technical specifications (contexts/specs/*.yaml)
- **Services**: System components (contexts/services/*.yaml)
- **Governance**: Policies and constraints (contexts/governance/*.yaml)

Each entity has:
- Unique ID, title, description
- Status (proposed, in-progress, done, blocked)
- Dependencies on other entities
- Tags for categorization

## Available Tools
Use these tools to help users:

1. **context.read** - Read specific entities by path or ID
   - Use this when you know the exact path
   - If file not found, immediately use context.search to find similar files

2. **context.search** - Search for entities by keyword, tag, or type
   - Use this to discover entities matching criteria
   - **ALWAYS USE THIS FIRST** when user mentions an entity ID or name you're not sure about

3. **pipeline.validate** - Validate all YAML entities against schemas
4. **pipeline.build-graph** - Build the complete dependency graph
5. **pipeline.impact** - Analyze impact of changes to entities
6. **pipeline.generate** - Generate documentation or artifacts

## IMPORTANT: Smart Search Strategy

When a user asks about "US-001", "FEAT-001", or any entity:

1. **FIRST**: Use context.search to find files containing that ID
   - Search for the ID pattern (e.g., "US-001")
   - Look in the appropriate directory (userstories, features, etc.)

2. **THEN**: Use context.read with the actual file path you found

3. **NEVER**: Just say "file not found" without searching first

## Example Smart Workflow

User: "Analyze US-001"

You should:
1. Use context.search with query "US-001" to find matching files
2. Find the actual file (e.g., "contexts/userstories/US-001-user-login.yaml")
3. Use context.read with that path
4. Analyze and respond with the information

**Be proactive. Be intelligent. Always search before giving up.**`,
    activeTools: ['context.read', 'context.search', 'pipeline.validate', 'pipeline.build-graph', 'pipeline.build-embeddings', 'pipeline.impact', 'pipeline.generate']
  });
  announceToScreenReader('New conversation started');
}

async function handleRefreshCapabilities() {
  await assistantStore.loadCapabilities();
  announceToScreenReader('Capabilities refreshed');
}

async function handleRetryConnection() {
  checkHealthStatus();
  announceToScreenReader('Retrying connection');
}

function handleSetConcurrency() {
  // Update concurrency limit in queue manager
  // This would require exposing a method in the assistant store
  console.log('Concurrency limit updated to:', concurrencyLimit.value);
}

// Streaming accumulator (T041)
const streamingBuffer = ref<Map<string, { tokens: string[]; metadata?: Record<string, unknown> }>>(new Map());
function accumulateStreamingToken(taskId: string, token: string, metadata?: Record<string, unknown>) {
  if (!streamingBuffer.value.has(taskId)) {
    streamingBuffer.value.set(taskId, { tokens: [], metadata });
  }
  const buffer = streamingBuffer.value.get(taskId)!;
  buffer.tokens.push(token);
  if (metadata) buffer.metadata = { ...buffer.metadata, ...metadata };
}
function finalizeStreamingMessage(taskId: string): { content: string; metadata?: Record<string, unknown> } | null {
  const buffer = streamingBuffer.value.get(taskId);
  if (!buffer) return null;
  const content = buffer.tokens.join('');
  const metadata = buffer.metadata;
  streamingBuffer.value.delete(taskId);
  return { content, metadata };
}

async function handleSendMessage(content: string) {
  // Parse hashtag commands first
  const parsed = parseHashtagCommands(content);

  // Execute any hashtag commands found
  if (parsed.hasCommands) {
    for (const cmd of parsed.commands) {
      // Check if tool is available in current session
      const toolAvailable = session.value?.activeTools.some(t => t.id === cmd.tool);
      if (!toolAvailable) {
        console.warn(`[UnifiedAssistant] Skipping hashtag command ${cmd.tool} - not available in session`);
        continue;
      }
      await handleInvokeTool(cmd.tool, cmd.parameters);
    }
  }

  // If there's remaining text after command extraction, send it as a message
  const messageToSend = parsed.cleanedMessage;
  if (!messageToSend || messageToSend.trim().length === 0) {
    // Only commands were sent, no need to send a chat message
    return;
  }

  if (!hasSession.value || !session.value) {
    await assistantStore.createSession({
      provider: 'azure-openai',
      systemPrompt: `You are an AI assistant specialized in managing and analyzing Context Repositories for software development projects.

## Core Behavior
**BE SMART**: When a file isn't found, AUTOMATICALLY search for similar files. Don't just say "file not found" - be proactive!

## Your Purpose
Help users understand, navigate, and maintain their context repository - a structured collection of YAML entities that define features, tasks, user stories, specs, services, and their relationships.

## Context Repository Structure
The repository contains YAML entities in the \`contexts/\` directory:
- **Features**: High-level capabilities (contexts/features/*.yaml)
- **Tasks**: Implementation work items (contexts/tasks/*.yaml)
- **Userstories**: User-facing requirements (contexts/userstories/*.yaml)
- **Specs**: Technical specifications (contexts/specs/*.yaml)
- **Services**: System components (contexts/services/*.yaml)
- **Governance**: Policies and constraints (contexts/governance/*.yaml)

Each entity has:
- Unique ID, title, description
- Status (proposed, in-progress, done, blocked)
- Dependencies on other entities
- Tags for categorization

## Available Tools
Use these tools to help users:

1. **context.read** - Read specific entities by path or ID
   - Use this when you know the exact path
   - If file not found, immediately use context.search to find similar files

2. **context.search** - Search for entities by keyword, tag, or type
   - Use this to discover entities matching criteria
   - **ALWAYS USE THIS FIRST** when user mentions an entity ID or name you're not sure about

3. **pipeline.validate** - Validate all YAML entities against schemas
4. **pipeline.build-graph** - Build the complete dependency graph
5. **pipeline.impact** - Analyze impact of changes to entities
6. **pipeline.generate** - Generate documentation or artifacts

## IMPORTANT: Smart Search Strategy

When a user asks about "US-001", "FEAT-001", or any entity:

1. **FIRST**: Use context.search to find files containing that ID
   - Search for the ID pattern (e.g., "US-001")
   - Look in the appropriate directory (userstories, features, etc.)

2. **THEN**: Use context.read with the actual file path you found

3. **NEVER**: Just say "file not found" without searching first

## Example Smart Workflow

User: "Analyze US-001"

You should:
1. Use context.search with query "US-001" to find matching files
2. Find the actual file (e.g., "contexts/userstories/US-001-user-login.yaml")
3. Use context.read with that path
4. Analyze and respond with the information

**Be proactive. Be intelligent. Always search before giving up.**`,
      activeTools: ['context.read', 'context.search', 'pipeline.validate', 'pipeline.build-graph', 'pipeline.build-embeddings', 'pipeline.impact', 'pipeline.generate']
    });
  }
  streamingBuffer.value.clear();
  await assistantStore.sendMessage(session.value!.id, { content, mode: 'general' });
}

function handleToggleStreaming(enabled: boolean) { streamingEnabled.value = enabled; }

async function handleInvokeTool(toolId: string, parameters: Record<string, unknown> = {}) {
  // Ensure session exists before invoking tools (fixes "session not found" error)
  if (!session.value) {
    try {
      await assistantStore.createSession({
        userId: 'local-user',
        provider: 'azure-openai',
        systemPrompt: `You are an AI assistant specialized in managing and analyzing Context Repositories for software development projects.

Help users understand, navigate, and maintain their context repository - a structured collection of YAML entities (features, tasks, user stories, specs, services) that define their software project.

Use the available tools (context.read, context.search, pipeline.*) to access actual repository data. Always retrieve real data rather than making assumptions.`,
        activeTools: ['context.read', 'context.search', 'pipeline.validate', 'pipeline.build-graph', 'pipeline.build-embeddings', 'pipeline.impact', 'pipeline.generate']
      });
      
      // Double-check session was created
      if (!session.value) {
        window.alert('Failed to create session - session is still null after creation');
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      window.alert(`Cannot invoke tool: ${message}`);
      return;
    }
  }

  // Tool safety classification enforcement (FR-032)
  const safetyClass = getToolSafety(toolId);
  let approvalProvided = false;
  let reason: string | undefined = undefined;
  if (safetyClass === 'mutating' || safetyClass === 'destructive') {
    // Show approval dialog or require explicit approval
    approvalProvided = true; // TODO: Replace with real approval dialog integration
    if (safetyClass === 'destructive') {
      const reasonInput = prompt('Please provide a reason for destructive action:');
      reason = typeof reasonInput === 'string' && reasonInput.trim() ? reasonInput : undefined;
      if (!reason) {
        window.alert('Reason required for destructive tool.');
        return;
      }
    }
    try {
      validateInvocation(toolId, approvalProvided, reason);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
      return;
    }
    parameters.approval = approvalProvided;
    if (reason) parameters.reason = reason;
  }
  
  // Final safety check before executing
  if (!session.value) {
    window.alert('Cannot execute tool: No active session');
    return;
  }
  
  // Use repoPath from session.telemetryContext (repoRoot) or fall back to contextStore
  const repoPath = (session.value.telemetryContext?.repoRoot as string | undefined) 
    || contextStore.repoPath 
    || '';
  
  if (!repoPath) {
    window.alert('No repository path configured. Please connect a context repository first.');
    return;
  }
  
  await assistantStore.executeTool({ toolId, parameters, repoPath });
}

function handleSystemPromptUpdate(newPrompt: string) {
  // Sanitize system prompt before applying
  const result = sanitizePrompt(newPrompt);
  if (!result.valid) {
    window.alert(`System prompt rejected: ${result.reasons.join(', ')}`);
    return;
  }
  // TODO: Apply sanitized prompt to session/agent profile
  // assistantStore.updateSystemPrompt(result.sanitized); // If such method exists
}

// TODO(T029-Navigation): Emit close event or integrate with app-level routing
function handleClose() {
  console.log('Close assistant');
}

// TODO(TreeState-Persistence): Persist context tree expansion independently of assistant visibility
// Strategy: Introduce a contextTreeStore with expandedNodeIds array; on assistant open/close do not mutate tree state.
</script>

<style scoped>
/* T040: Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
