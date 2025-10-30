<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';
import { useContextStore } from '@/stores/contextStore';
import type { AssistantPipelineName, ToolInvocationRecord } from '@shared/assistant/types';
import TranscriptView from './TranscriptView.vue';
import ResponsePane from './ResponsePane.vue';
import ApprovalDialog from './ApprovalDialog.vue';
import AgentSelector from './AgentSelector.vue';

interface PipelineOption {
  id: AssistantPipelineName;
  label: string;
  description: string;
  requiresIds?: boolean;
  argsLabel?: string;
}

const pipelineOptions: PipelineOption[] = [
  {
    id: 'validate',
    label: 'Validate repository',
    description: 'Runs schema validation across the entire context repository.'
  },
  {
    id: 'build-graph',
    label: 'Rebuild dependency graph',
    description: 'Constructs the entity dependency graph for navigation and impact analysis.'
  },
  {
    id: 'impact',
    label: 'Impact analysis',
    description: 'Evaluates ripple effects for specific entities that recently changed.',
    requiresIds: true,
    argsLabel: 'Changed entity IDs (comma separated)'
  },
  {
    id: 'generate',
    label: 'Generate artifacts',
    description: 'Invokes content generation pipeline for specific entity IDs.',
    requiresIds: true,
    argsLabel: 'Entity IDs to generate (comma separated)'
  }
];

const assistantStore = useAssistantStore();
const {
  session,
  telemetry,
  isBusy: busyState,
  contextReadResult: latestRead,
  contextReadError: latestReadError,
  conversation: transcriptState
} = storeToRefs(assistantStore);
const contextStore = useContextStore();

const selectedPipeline = ref<AssistantPipelineName>('validate');
const idEntry = ref('');
const pipelineFeedback = reactive({ success: '', error: '' });
const readPath = ref('');
const readEncoding = ref('utf-8');
const contextFeedback = reactive({ success: '', error: '' });

const repoPath = computed(() => contextStore.repoPath ?? '');
const currentOption = computed(() => pipelineOptions.find(option => option.id === selectedPipeline.value));
const telemetryRecords = computed<ToolInvocationRecord[]>(() => telemetry.value);
const isBusy = computed(() => busyState.value);
const requiresIds = computed(() => currentOption.value?.requiresIds === true);
const argsPlaceholder = computed(() => currentOption.value?.argsLabel ?? 'Entity IDs');
const transcript = computed(() => transcriptState.value);
const latestReadResult = computed(() => latestRead.value);
const responseError = computed(() => latestReadError.value);
const canReadContext = computed(() => Boolean(repoPath.value) && readPath.value.trim().length > 0 && !isBusy.value);

watch(
  () => [selectedPipeline.value, contextStore.activeEntityId],
  ([pipeline, entityId]) => {
    if (!requiresIds.value) {
      idEntry.value = '';
      return;
    }
    if (entityId) {
      idEntry.value = entityId;
    }
  },
  { immediate: true }
);

watch(latestReadResult, (result) => {
  if (!result) {
    return;
  }
  const label = result.repoRelativePath || result.path || readPath.value.trim();
  contextFeedback.success = `Loaded ${label}.`;
  contextFeedback.error = '';
});

watch(responseError, (value) => {
  if (value) {
    contextFeedback.error = value;
    contextFeedback.success = '';
  }
});

watch(readPath, () => {
  contextFeedback.success = '';
  contextFeedback.error = '';
});

const canRunPipeline = computed(() => {
  if (!repoPath.value) {
    return false;
  }
  if (!requiresIds.value) {
    return true;
  }
  return idEntry.value.trim().length > 0;
});

function buildArgs(): Record<string, unknown> | undefined {
  if (!requiresIds.value) {
    return undefined;
  }
  const parsed = idEntry.value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const key = selectedPipeline.value === 'impact' ? 'changedIds' : 'ids';
  return parsed.length > 0 ? { [key]: parsed } : undefined;
}

function describeOutcome(record: ToolInvocationRecord): string {
  if (record.resultSummary) {
    return record.resultSummary;
  }
  if (record.status === 'pending') {
    return 'Execution pending…';
  }
  return `Tool ${record.toolId} ${record.status}.`;
}

function formatTimestamp(iso?: string): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

async function runSelectedPipeline() {
  if (!repoPath.value || isBusy.value) {
    return;
  }

  pipelineFeedback.success = '';
  pipelineFeedback.error = '';

  try {
    const args = buildArgs();
    const response = await assistantStore.runPipeline({
      repoPath: repoPath.value,
      pipeline: selectedPipeline.value,
      args
    });

    const statusField = response.result?.status;
    const statusText = typeof statusField === 'string' ? statusField : null;
    const resultSummary = statusText
      ? `Pipeline ${selectedPipeline.value} ${statusText}.`
      : `Pipeline ${selectedPipeline.value} completed.`;
    pipelineFeedback.success = resultSummary;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Pipeline execution failed.';
    pipelineFeedback.error = message;
  }
}

async function readContextArtifact() {
  if (!repoPath.value) {
    contextFeedback.error = 'Select a context repository to enable file previews.';
    return;
  }

  const trimmedPath = readPath.value.trim();
  if (!trimmedPath) {
    contextFeedback.error = 'Enter a repository-relative path to preview.';
    return;
  }

  contextFeedback.success = '';
  contextFeedback.error = '';

  try {
    const encodingValue = readEncoding.value.trim();
    const result = await assistantStore.readContextFile({
      repoPath: repoPath.value,
      path: trimmedPath,
      encoding: encodingValue && encodingValue !== 'utf-8' ? encodingValue : undefined
    });

    if (result) {
      const label = result.repoRelativePath || result.path || trimmedPath;
      contextFeedback.success = `Loaded ${label}.`;
    } else {
      contextFeedback.success = 'Context read completed.';
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Context read failed.';
    contextFeedback.error = message;
  }
}

onMounted(() => {
  if (session.value) {
    void assistantStore.refreshTelemetry(true);
  }
});

// Auto-open latest pending approval when a new pending approval is added
watch(
  () => assistantStore.pendingApprovals.length,
  (len, oldLen) => {
    if (len > (oldLen ?? 0)) {
      // open the most recent pending approval
      const latest = assistantStore.pendingApprovals.at(-1);
      if (latest) {
        assistantStore.openPendingApproval(latest.id);
      }
    }
  }
);
</script>

<template>
  <section class="space-y-4">
    <header class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-secondary-900">Safe Tooling Console</h3>
        <p class="text-xs text-secondary-600">Execute allowlisted pipelines and preview repository context with telemetry-backed audits.</p>
      </div>
      <span
        v-if="assistantStore.hasSession"
        class="px-2 py-1 text-[10px] font-medium rounded-m3-md border border-primary-200 bg-primary-50 text-primary-700"
      >Session active</span>
    </header>

    <!-- Agent Selector -->
    <div class="rounded-m3-md border border-surface-variant bg-white shadow-elevation-1">
      <div class="p-4 space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-secondary-700">AI Agent</label>
          <span class="text-[10px] text-secondary-500">Choose the assistant's behavior</span>
        </div>
        <AgentSelector />
        <p class="text-[11px] text-secondary-500">
          Agents define the assistant's system prompt, capabilities, and behavior. Select a specialized agent for your task or use the default Context Assistant.
        </p>
      </div>
    </div>

    <div class="rounded-m3-md border border-surface-variant bg-white shadow-elevation-1">
      <div class="p-4 space-y-4">
        <div class="space-y-2">
          <label class="text-xs font-semibold text-secondary-700">Pipeline</label>
          <select
            v-model="selectedPipeline"
            class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option
              v-for="option in pipelineOptions"
              :key="option.id"
              :value="option.id"
            >{{ option.label }}</option>
          </select>
          <p class="text-xs text-secondary-600">{{ currentOption?.description }}</p>
        </div>

        <div v-if="requiresIds" class="space-y-2">
          <label class="text-xs font-semibold text-secondary-700">{{ argsPlaceholder }}</label>
          <input
            v-model="idEntry"
            type="text"
            class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            :placeholder="argsPlaceholder"
          />
          <p class="text-[11px] text-secondary-500">Separate multiple IDs with commas. Leave blank to use the active entity.</p>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="text-xs text-secondary-600">
            <p v-if="!repoPath">Select or configure a context repository to enable pipeline execution.</p>
            <p v-else>Repository: <span class="font-mono text-secondary-800">{{ repoPath }}</span></p>
          </div>
          <button
            class="px-4 py-2 text-sm font-medium rounded-m3-md shadow-elevation-1 transition-colors"
            :class="canRunPipeline ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-secondary-200 text-secondary-500 cursor-not-allowed'"
            :disabled="!canRunPipeline || isBusy"
            @click="runSelectedPipeline"
          >
            {{ isBusy ? 'Running…' : 'Run pipeline' }}
          </button>
        </div>

        <div v-if="pipelineFeedback.success" class="text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-m3-md px-3 py-2">
          {{ pipelineFeedback.success }}
        </div>
        <div v-if="pipelineFeedback.error" class="text-xs text-error-700 bg-error-50 border border-error-200 rounded-m3-md px-3 py-2">
          {{ pipelineFeedback.error }}
        </div>
      </div>
    </div>

    <div class="rounded-m3-md border border-surface-variant bg-white shadow-elevation-1">
      <div class="p-4 space-y-4">
        <header>
          <h4 class="text-sm font-semibold text-secondary-900">Repository Context Reader</h4>
          <p class="text-xs text-secondary-600">Perform read-only file previews with provenance metadata.</p>
        </header>

        <div class="flex flex-col gap-3 sm:flex-row">
          <div class="flex-1 space-y-1">
            <label class="text-xs font-semibold text-secondary-700">Relative path</label>
            <input
              v-model="readPath"
              type="text"
              class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="contexts/features/example.yaml"
            />
            <p class="text-[11px] text-secondary-500">Paths are resolved against the repository root.</p>
          </div>
          <div class="w-full sm:w-40 space-y-1">
            <label class="text-xs font-semibold text-secondary-700">Encoding</label>
            <input
              v-model="readEncoding"
              type="text"
              class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p class="text-[11px] text-secondary-500">Defaults to utf-8.</p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div class="text-xs text-secondary-600">
            <p v-if="!repoPath">Configure a context repository to enable previews.</p>
            <p v-else>Repository: <span class="font-mono text-secondary-800">{{ repoPath }}</span></p>
          </div>
          <button
            class="px-4 py-2 text-sm font-medium rounded-m3-md shadow-elevation-1 transition-colors"
            :class="canReadContext ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-secondary-200 text-secondary-500 cursor-not-allowed'"
            :disabled="!canReadContext"
            @click="readContextArtifact"
          >
            {{ isBusy ? 'Loading…' : 'Preview file' }}
          </button>
        </div>

        <div v-if="contextFeedback.success" class="text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-m3-md px-3 py-2">
          {{ contextFeedback.success }}
        </div>
        <div v-if="contextFeedback.error" class="text-xs text-error-700 bg-error-50 border border-error-200 rounded-m3-md px-3 py-2">
          {{ contextFeedback.error }}
        </div>
      </div>
    </div>

    <ResponsePane
      :result="latestReadResult"
      :error="responseError"
      :is-busy="isBusy"
    />

    <TranscriptView
      :transcript="transcript"
      :is-busy="isBusy"
      empty-message="Run a pipeline or context read to populate the transcript."
    />

    <ApprovalDialog />

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold text-secondary-700 uppercase">Telemetry log</h4>
        <button
          class="text-[11px] text-secondary-600 hover:text-secondary-900"
          @click="assistantStore.refreshTelemetry(true)"
        >Refresh</button>
      </div>
      <div v-if="telemetryRecords.length === 0" class="text-xs text-secondary-500 border border-dashed border-surface-variant rounded-m3-md px-3 py-2">
        No telemetry records available yet.
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="record in telemetryRecords"
          :key="record.id"
          class="border border-surface-variant rounded-m3-md px-3 py-2 bg-white shadow-elevation-1"
        >
          <div class="flex items-center justify-between text-xs text-secondary-700">
            <span class="font-semibold text-secondary-900">{{ record.toolId }}</span>
            <span class="font-mono text-[11px] text-secondary-500">{{ record.id }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-secondary-500 mt-1">
            <span>Status: <span :class="record.status === 'succeeded' ? 'text-primary-700' : record.status === 'failed' ? 'text-error-700' : 'text-secondary-700'">{{ record.status }}</span></span>
            <span>{{ formatTimestamp(record.startedAt) }} → {{ formatTimestamp(record.finishedAt) }}</span>
          </div>
          <p class="text-xs text-secondary-700 mt-2">{{ describeOutcome(record) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>
