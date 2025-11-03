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
    <header class="flex items-center justify-between px-3 py-2 border-b border-outline-variant bg-surface-container-low">
      <!-- Left cluster -->
      <div class="flex items-center min-w-0 gap-2">
        <h2 class="text-sm font-semibold text-secondary-900 tracking-wide truncate" title="Unified Assistant">Unified Assistant</h2>
        <AgentSelector v-if="hasSession" />
        <ProviderBadge v-if="hasSession" :provider="session!.provider" />
        <MigrationStatus v-if="hasSession" @open="showMigrationModal = true" />
      </div>

      <!-- Right actions -->
      <div class="flex items-center gap-1">
        <!-- Focus Mode Toggle (A) -->
        <button
          v-if="hasSession"
          class="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-m3-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          :class="viewMode === 'panel' ? 'bg-surface-variant text-secondary-700 hover:bg-surface-variant/80' : 'bg-primary-container text-on-primary-container hover:bg-primary-container/90'"
          @click="toggleViewMode"
          :aria-pressed="viewMode === 'focus'"
          aria-label="Toggle focus mode"
        >
          <span v-if="viewMode === 'focus'">Exit Focus</span>
          <span v-else>Focus Mode</span>
        </button>
        <div
          v-if="hasSession"
          class="flex items-center gap-1 ml-1"
          role="group"
          aria-label="Panel view selector"
        >
          <button
            v-for="p in panelOptions"
            :key="p.id"
            class="inline-flex items-center justify-center h-8 w-20 text-xs font-medium rounded-m3-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            :class="activePanel === p.id ? 'bg-primary text-on-primary' : 'bg-surface-variant text-secondary-700 hover:bg-surface-variant/80'"
            :data-state="activePanel === p.id ? 'active' : 'inactive'"
            @click="setActivePanel(p.id)"
          >{{ p.label }}</button>
        </div>
        <button
          v-if="hasSession"
          class="icon-btn"
          @click="handleExport"
          aria-label="Export session (Ctrl+E)"
        >
          <span class="sr-only">Export session</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4"><path d="M3 3h14v2H3V3Zm7 4 5 5h-3v5h-4v-5H5l5-5Z"/></svg>
        </button>
        <button
          class="icon-btn"
          @click="handleRefreshCapabilities"
          aria-label="Refresh capability manifest (Ctrl+R)"
        >
          <span class="sr-only">Refresh capability manifest</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 2v6h-6"/><path d="M3 22v-6h6"/><path d="M16 8A5 5 0 0 0 6.2 6.2L3 8"/><path d="M8 16a5 5 0 0 0 9.8 1.8L21 16"/></svg>
        </button>
        <button
          class="icon-btn"
          :aria-pressed="showSettings"
          @click="showSettings = !showSettings"
          aria-label="Open assistant settings"
        >
          <span class="sr-only">Settings</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6c.26 0 .51-.05.75-.14A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09c0 .69.4 1.31 1 1.51.24.09.49.14.75.14a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.46.46-.61 1.13-.33 1.82.09.24.14.49.14.75s-.05.51-.14.75Z"/></svg>
        </button>
        <button
          class="icon-btn"
          data-assistant-focus="close-button"
          aria-label="Close assistant"
          @click="handleClose"
        >
          <span class="sr-only">Close assistant</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4"><path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 1 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z"/></svg>
        </button>
      </div>
    </header>

    <!-- Fallback Banner -->
    <FallbackBanner
      v-if="showFallbackBanner"
      :show="showFallbackBanner"
      :severity="fallbackSeverity"
      :message="fallbackMessage"
      :can-retry="true"
      @retry="handleRetryConnection"
      @close="showFallbackBanner = false"
    />

    <!-- Main Content Area -->
    <div class="flex flex-1 overflow-hidden" :class="viewMode === 'focus' ? 'gap-4 px-4 py-3' : ''">
      <!-- Left: Transcript + Composer -->
      <div
        class="flex flex-col overflow-hidden"
        :class="viewMode === 'focus' ? 'flex-[2] rounded-m3-lg border border-surface-variant bg-surface-container-low' : 'flex-1'"
      >
        <!-- Transcript -->
        <div class="flex-1 overflow-auto px-4 py-3">
          <TranscriptView
            :transcript="conversation"
            :tasks="tasks"
            :is-busy="isBusy"
            empty-message="Start a conversation or run a tool to begin."
            data-assistant-focus="transcript"
          />
        </div>

        <!-- Message Composer -->
        <div :class="viewMode === 'focus' ? 'border-t border-surface-variant px-4 py-3 bg-surface' : 'border-t border-surface-variant px-4 py-3'">
          <MessageComposer
            :disabled="!hasSession || isBusy"
            :streaming-enabled="streamingEnabled"
            @send="handleSendMessage"
            @toggle-streaming="handleToggleStreaming"
          />
        </div>
      </div>

      <!-- Right: Context Panel -->
      <div
        v-if="activePanel === 'telemetry'"
        :class="viewMode === 'focus' ? 'flex-[1] rounded-m3-lg border border-surface-variant overflow-auto bg-surface-container-low' : 'w-80 border-l border-surface-variant overflow-auto'"
      >
        <TelemetryPanel
          :session-id="session?.id"
          :telemetry="telemetry"
          data-assistant-focus="telemetry-panel"
        />
      </div>
      <div
        v-else-if="activePanel === 'queue'"
        :class="viewMode === 'focus' ? 'flex-[1] rounded-m3-lg border border-surface-variant overflow-auto bg-surface-container-low' : 'w-80 border-l border-surface-variant overflow-auto'"
      >
        <ToolQueue
          :tasks="tasks"
          data-assistant-focus="tool-queue"
        />
      </div>
      <div
        v-else
        :class="viewMode === 'focus' ? 'flex-[1] rounded-m3-lg border border-surface-variant overflow-auto bg-surface-container-low' : 'w-80 border-l border-surface-variant overflow-auto'"
      >
        <ToolPalette
          :session-id="session?.id"
          :active-tools="activeTools"
          :capabilities="capabilities"
          @invoke-tool="handleInvokeTool"
          data-assistant-focus="tool-palette"
        />
      </div>
    </div>

    <!-- Approval Dialog Overlay -->
    <ApprovalDialog v-if="hasActivePending" />

    <!-- Settings Panel (Future) -->
    <teleport to="body">
      <div
        v-if="showSettings"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
        @click.self="showSettings = false"
      >
        <div class="w-full max-w-md bg-surface rounded-m3-xl shadow-elevation-3 p-6">
          <h3 class="text-base font-semibold mb-4">Assistant Settings</h3>
          <div class="space-y-3">
            <label class="flex items-center gap-2">
              <input v-model="streamingEnabled" type="checkbox" />
              <span class="text-sm">Enable streaming responses</span>
            </label>
            <div>
              <label class="text-sm text-secondary-700">Concurrency Limit</label>
              <input
                v-model.number="concurrencyLimit"
                type="number"
                min="1"
                max="10"
                class="w-full mt-1 px-3 py-2 border rounded-m3-md"
                @change="handleSetConcurrency"
              />
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button class="px-4 py-2 rounded-m3-md bg-surface-variant hover:bg-surface-variant-hover transition-colors" @click="showSettings = false">
              Close
            </button>
          </div>
        </div>
      </div>
      <!-- Migration Modal -->
      <div
        v-if="showMigrationModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="showMigrationModal = false"
      >
        <div class="w-full max-w-lg bg-surface rounded-m3-xl shadow-elevation-3 p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-semibold">Legacy Migration</h3>
            <button class="p-1 rounded-m3-sm hover:bg-surface-variant" aria-label="Close migration modal" @click="showMigrationModal = false">✕</button>
          </div>
          <MigrationControls />
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';
import { createFocusManager } from './a11y-map';
import { exportAndDownload } from '@/services/assistant/exporter';
import TranscriptView from './TranscriptView.vue';
import MessageComposer from './MessageComposer.vue';
import ToolPalette from './ToolPalette.vue';
import TelemetryPanel from './TelemetryPanel.vue';
import ApprovalDialog from './ApprovalDialog.vue';
import AgentSelector from './AgentSelector.vue';
import ProviderBadge from './ProviderBadge.vue';
import FallbackBanner from './FallbackBanner.vue';
import ToolQueue from './ToolQueue.vue';
import type { ToolDescriptor } from '@shared/assistant/types';
import MigrationControls from './MigrationControls.vue';
import MigrationStatus from './MigrationStatus.vue';

// Store integration
const assistantStore = useAssistantStore();
const { session, conversation, tasks, telemetry, isBusy, activePending, health, capabilityProfile } = storeToRefs(assistantStore);

// View mode: 'panel' (original side panel layout) or 'focus' (center workspace)
const viewMode = ref<'panel' | 'focus'>('panel');
// Panel state (segmented control)
const activePanel = ref<'tools' | 'queue' | 'telemetry'>('tools');

// Panel options (Material 3 segmented style)
const panelOptions: Array<{ id: 'tools' | 'queue' | 'telemetry'; label: string }> = [
  { id: 'tools', label: 'Tools' },
  { id: 'queue', label: 'Queue' },
  { id: 'telemetry', label: 'Telemetry' }
];

// Utility class applied to icon-only buttons (Material 3 inspired)
// TODO(DesignSystem-Extract): Centralize in a design system utility file.
// Using inline class string to avoid global CSS dependency modifications now.
// Style: subtle elevated surface, focus ring, hover elevation.
// We attach this in template via class="icon-btn"; Vue SFC style block defines it.

function toggleViewMode() {
  viewMode.value = viewMode.value === 'panel' ? 'focus' : 'panel';
  // TODO(FocusMode-Telemetry): emit ui.view_mode.changed telemetry event
}
function setActivePanel(panel: 'tools' | 'queue' | 'telemetry') {
  activePanel.value = panel;
}
const showSettings = ref(false);
const showMigrationModal = ref(false);

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
    announceToScreenReader('Shortcuts: Ctrl+E export, Ctrl+T telemetry, Ctrl+Q queue, Ctrl+R refresh, Esc close');
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 't' && hasSession.value) {
    e.preventDefault();
    activePanel.value = activePanel.value === 'telemetry' ? 'tools' : 'telemetry';
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'q' && hasSession.value) {
    e.preventDefault();
    activePanel.value = activePanel.value === 'queue' ? 'tools' : 'queue';
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'e' && hasSession.value) {
    e.preventDefault();
    handleExport();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    handleRefreshCapabilities();
    return;
  }
  if (e.key === 'Escape') {
    if (showSettings.value) showSettings.value = false;
    else if (activePanel.value !== 'tools') activePanel.value = 'tools';
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
      systemPrompt: `You are a helpful AI assistant for context repository management with access to tools.

Available Tools:
- context.read: Read specific context entities (features, tasks, services, specs)
- context.search: Search for entities by keyword
- pipeline.validate: Validate all YAML entities against schemas
- pipeline.build-graph: Build dependency graph from entities
- pipeline.impact: Analyze impact of changes to specific entities
- pipeline.generate: Generate output from templates

When the user asks to perform actions like "validate", "search", "read", "analyze impact", or "generate", use the appropriate tool to complete the task.`,
      activeTools: ['context.read', 'context.search', 'pipeline.validate', 'pipeline.build-graph', 'pipeline.impact', 'pipeline.generate']
    });
  }
  streamingBuffer.value.clear();
  await assistantStore.sendMessage(session.value!.id, { content, mode: 'general' });
}

function handleToggleStreaming(enabled: boolean) { streamingEnabled.value = enabled; }

async function handleInvokeTool(toolId: string, parameters: Record<string, unknown>) {
  if (!hasSession.value || !session.value) return;
  const healthStatus = health.value;
  if (healthStatus?.status === 'unhealthy') {
    showFallbackBanner.value = true;
    fallbackSeverity.value = 'error';
    fallbackMessage.value = 'Cannot execute tools - service unavailable.';
    announceToScreenReader('Error: Tool execution blocked');
    return;
  }
  await assistantStore.executeTool({ toolId, parameters, repoPath: '' }); // TODO: real repoPath
}

function handleSetConcurrency() { assistantStore.setQueueConcurrency(concurrencyLimit.value); }

function handleExport() {
  if (!hasSession.value || !session.value) return;
  exportAndDownload(session.value, telemetry.value, undefined);
}

async function handleRefreshCapabilities() {
  try {
    await assistantStore.refreshCapabilities();
    announceToScreenReader('Capabilities refreshed successfully');
  } catch (err) {
    console.error('Failed to refresh capabilities:', err);
    announceToScreenReader('Failed to refresh capabilities');
  }
}

function handleRetryConnection() {
  assistantStore.retryHealth();
  showFallbackBanner.value = false;
}

function handleClose() {
  // TODO(T029-Navigation): Emit close event or integrate with app-level routing
  console.log('Close assistant');
}
</script>
<style scoped>
.icon-btn {
  /* Using direct properties instead of some @apply utilities to avoid PostCSS unknown utility parse errors.
     Tailwind utility classes like h-8 and w-8 are kept in the template usage; here we define base look. */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* size */
  height: 2rem; /* h-8 */
  width: 2rem;  /* w-8 */
  border-radius: 12px; /* rounded-m3-md token equivalent */
  color: theme('colors.secondary.700');
  background-color: theme('colors.surface.variant');
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
.icon-btn:hover { background-color: rgba(220,230,242,0.8); }
.icon-btn:focus { outline: none; box-shadow: 0 0 0 2px rgba(0,104,181,0.5); }
.icon-btn:active { background-color: rgba(220,230,242,0.6); }
</style>

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
