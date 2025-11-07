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
    
    <!-- Header -->
    <header class="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-outline bg-surface">
      <!-- Left: Title and Status -->
      <div class="flex items-center gap-3">
        <h2 class="text-sm font-medium text-on-surface">
          Context Assistant
        </h2>
        <GatingStatusBadge
          v-if="hasSession"
          :status="gatingStatus"
          :is-classification-enforced="isClassificationEnforced"
          :is-limited-read-only="isLimitedReadOnlyMode"
          :is-retrieval-enabled="isRetrievalEnabled"
        />
        <ProviderBadge v-if="hasSession" :provider="session!.provider" class="text-xs" />
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1">
        <button
          v-if="hasSession"
          class="p-1.5 rounded-m3-sm text-on-surface-variant hover:bg-surface-variant transition-colors"
          @click="handleRefreshCapabilities"
          aria-label="Refresh capabilities"
          title="Refresh capabilities"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clip-rule="evenodd" />
          </svg>
        </button>
        <button
          class="p-1.5 rounded-m3-sm text-on-surface-variant hover:bg-surface-variant transition-colors"
          :aria-pressed="showSettings"
          @click="showSettings = !showSettings"
          aria-label="Settings"
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
          </svg>
        </button>
        <button
          class="p-1.5 rounded-m3-sm text-on-surface-variant hover:bg-surface-variant transition-colors"
          data-assistant-focus="close-button"
          aria-label="Close"
          title="Close assistant"
          @click="handleClose"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
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

    <!-- Tab Navigation -->
    <div class="flex items-center border-b border-outline bg-surface" v-if="hasSession">
      <button
        v-for="tab in panelOptions"
        :key="tab.id"
        class="relative px-6 py-3 text-sm font-medium transition-colors"
        :class="activePanel === tab.id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'"
        @click="setActivePanel(tab.id)"
      >
        {{ tab.label }}
        <div
          v-if="activePanel === tab.id"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
        />
      </button>
    </div>

    <!-- Main Content Area - Single Pane -->
    <div class="flex-1 overflow-hidden">
      <!-- Chat View -->
      <div v-if="activePanel === 'chat'" class="flex flex-col h-full">
        <!-- Transcript -->
        <div class="flex-1 overflow-auto px-4 py-4">
          <TranscriptView
            :transcript="conversation"
            :tasks="tasks"
            :is-busy="isBusy"
            empty-message="Ask a question or describe a task..."
            data-assistant-focus="transcript"
          />
        </div>

        <!-- Message Composer -->
        <div class="border-t border-outline px-4 py-3 bg-surface">
          <MessageComposer
            :disabled="!hasSession || isBusy"
            :streaming-enabled="streamingEnabled"
            @send="handleSendMessage"
            @toggle-streaming="handleToggleStreaming"
          />
        </div>
      </div>

      <!-- Tools View -->
      <div v-else-if="activePanel === 'tools'" class="h-full overflow-auto">
        <ToolPalette
          :session-id="session?.id"
          :active-tools="activeTools"
          :capabilities="capabilities"
          @invoke-tool="handleInvokeTool"
          data-assistant-focus="tool-palette"
        />
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
            <label class="flex items-center justify-between">
              <span class="text-sm text-on-surface">Streaming responses</span>
              <input 
                v-model="streamingEnabled" 
                type="checkbox" 
                class="w-4 h-4 text-primary rounded border-outline focus:ring-2 focus:ring-primary/50"
              />
            </label>
            <div>
              <label class="block text-sm text-on-surface mb-2">Concurrency limit</label>
              <input
                v-model.number="concurrencyLimit"
                type="number"
                min="1"
                max="10"
                class="w-full px-3 py-2 text-sm bg-surface border border-outline rounded-m3-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                @change="handleSetConcurrency"
              />
              <p class="mt-1 text-xs text-on-surface-variant">Maximum parallel tool executions</p>
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
import TranscriptView from './TranscriptView.vue';
import MessageComposer from './MessageComposer.vue';
import ToolPalette from './ToolPalette.vue';
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
  if (!hasSession.value || !session.value) {
    await assistantStore.createSession({
      provider: 'azure-openai',
      systemPrompt: `You are an AI assistant specialized in managing and analyzing Context Repositories for software development projects.

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
   - Example: "Read the user story at contexts/userstories/login.yaml"
   - Use this to get detailed content of specific entities

2. **context.search** - Search for entities by keyword, tag, or type
   - Example: "Search for all user stories with tag 'authentication'"
   - Use this to discover entities matching criteria

3. **pipeline.validate** - Validate all YAML entities against schemas
   - Checks for schema compliance, broken dependencies
   - Run this when users want to ensure repository health

4. **pipeline.build-graph** - Build the complete dependency graph
   - Shows relationships between all entities
   - Useful for understanding system architecture

5. **pipeline.impact** - Analyze impact of changes to entities
   - Shows what would be affected by modifying an entity
   - Use before making changes

6. **pipeline.generate** - Generate documentation or artifacts from templates
   - Creates output files based on entity data
   - Useful for reports, documentation

## How to Help Users

When users ask questions like:
- "Summarize all user stories" → Use context.search to find all userstories, then read and summarize them
- "What features are blocked?" → Search for features with status='blocked'
- "Show dependencies for X" → Use context.read to get entity X, analyze its dependencies
- "What breaks if I change Y?" → Use pipeline.impact on entity Y
- "List all authentication tasks" → Search for tasks with tag='authentication'

**Always use tools to access actual data. Don't make assumptions about what entities exist.**`,
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
