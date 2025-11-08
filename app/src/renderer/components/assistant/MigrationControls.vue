<template>
  <div class="p-3 border-b border-surface-variant bg-surface-variant/40 flex flex-col gap-3" role="group" aria-label="Legacy Migration Controls">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-secondary-900 flex items-center gap-2">
        🧬 Legacy Migration
        <span v-if="statusTag" class="text-xs px-2 py-0.5 rounded-full" :class="statusClasses">{{ statusTag }}</span>
      </h3>
      <button
        class="text-xs px-2 py-1 rounded-m3-md bg-surface-variant hover:bg-surface-variant-hover transition-colors"
        @click="dismissed = true"
        aria-label="Dismiss migration controls"
      >✕</button>
    </div>

    <p class="text-xs text-secondary-700" v-if="!dismissed">
      Migrate legacy assistant conversation data into unified sessions. This runs automatically once, but you can re-run manually if needed.
    </p>

    <div v-if="!dismissed" class="flex items-center gap-2">
      <button
        class="px-3 py-1.5 text-xs rounded-m3-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="isRunning"
        @click="handleManualMigration"
      >
        <span v-if="!isRunning">Run Migration</span>
        <span v-else>Running...</span>
      </button>
      <button
        v-if="importedCount > 0"
        class="px-3 py-1.5 text-xs rounded-m3-md bg-surface-variant hover:bg-surface-variant-hover"
        @click="showLedger = !showLedger"
        :aria-pressed="showLedger"
      >Ledger ({{ importedCount }})</button>
    </div>

    <div v-if="showLedger && importedRecords.length" class="mt-2 border-t border-surface-variant pt-2">
      <ul class="space-y-1 max-h-32 overflow-auto" aria-label="Imported sessions ledger">
        <li v-for="r in importedRecords" :key="r.newSessionId" class="text-xs flex justify-between">
          <span class="truncate" :title="r.newSessionId">{{ r.newSessionId }}</span>
          <span class="text-secondary-600">{{ r.messageCount }} msgs</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ensureLegacyMigration, listImportedSessions, importLegacySessions, scanLegacySessions, batchMigrateSessions, dedupeLegacySessions } from '@/services/assistant/migrationAdapter';
import { useAssistantStore } from '@/stores/assistantStore';

const assistantStore = useAssistantStore();

const isRunning = ref(false);
const dismissed = ref(false);
const showLedger = ref(false);
const importedRecords = ref(listImportedSessions());
const lastRunErrors = ref<string[]>([]);
const lastRunSucceeded = ref<boolean | null>(null);

const importedCount = computed(() => importedRecords.value.length);
const statusTag = computed(() => {
  if (lastRunSucceeded.value === null) return importedCount.value > 0 ? 'migrated' : 'pending';
  return lastRunSucceeded.value ? 'completed' : 'failed';
});
const statusClasses = computed(() => {
  switch (statusTag.value) {
    case 'completed': return 'bg-success-container text-on-success-container';
    case 'failed': return 'bg-error-container text-on-error-container';
    case 'migrated': return 'bg-primary-container text-on-primary-container';
    default: return 'bg-warning-container text-on-warning-container';
  }
});

async function handleManualMigration() {
  if (isRunning.value) return;
  isRunning.value = true;
  lastRunErrors.value = [];
  lastRunSucceeded.value = null;s
  try {
    // Rescan legacy store fresh (manual re-run)
    const legacy = scanLegacySessions();
    if (!legacy.length) {
      lastRunSucceeded.value = true; // Nothing to do counts as success
      return;
    }
    const unique = dedupeLegacySessions(legacy);
    const migrated = await batchMigrateSessions(unique);
    const importResult = await importLegacySessions(
      migrated,
      (s) => assistantStore.applySession(s),
      // rollback stub: not yet implemented in assistantStore
      undefined
    );
    if (importResult.failed > 0) {
      lastRunErrors.value = importResult.errors;
      lastRunSucceeded.value = importResult.imported > 0 && importResult.failed === 0;
    } else {
      lastRunSucceeded.value = true;
    }
    importedRecords.value = listImportedSessions();
  } catch (err) {
    lastRunErrors.value = [err instanceof Error ? err.message : 'Unknown manual migration error'];
    lastRunSucceeded.value = false;
  } finally {
    isRunning.value = false;
  }
}
</script>

<!-- No component-scoped styles; all Tailwind utility classes inline -->
