<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';

const assistantStore = useAssistantStore();
const { activePending } = storeToRefs(assistantStore);

const content = computed(() => activePending.value?.diffPreview ?? 'No diff available.');
const notes = ref('');

function lines() {
  const raw = content.value ?? '';
  return raw.split('\n');
}

function approve() {
  if (!activePending.value) return;
  void assistantStore.approvePending(activePending.value.id, notes.value || 'Approved via UI');
  assistantStore.closePendingApproval();
}

function reject() {
  if (!activePending.value) return;
  void assistantStore.rejectPending(activePending.value.id, notes.value || 'Rejected via UI');
  assistantStore.closePendingApproval();
}

function close() {
  assistantStore.closePendingApproval();
}
</script>

<template>
  <div v-if="activePending && activePending.id" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
    <div class="w-full max-w-2xl bg-white rounded-m3-xl shadow-elevation-2 p-4">
      <header class="flex items-start justify-between">
        <div>
          <h3 class="text-sm font-semibold">Approval required</h3>
          <p class="text-xs text-secondary-600">Tool: {{ activePending?.toolId }}</p>
        </div>
        <button class="text-secondary-600" @click="close">✕</button>
      </header>

      <section class="mt-3">
        <div class="text-xs text-secondary-600 mb-2">Diff preview</div>
        <div class="bg-surface-1 p-3 rounded-m3-md overflow-auto max-h-60 border border-surface-variant">
          <template v-for="(line, idx) in lines()" :key="idx">
            <div :class="['text-xs font-mono break-words', line.startsWith('+') ? 'text-primary-700 bg-primary-50' : line.startsWith('-') ? 'text-error-700 bg-error-50' : 'text-secondary-800']">{{ line }}</div>
          </template>
        </div>

        <label class="mt-3 text-xs font-semibold">Notes</label>
        <textarea v-model="notes" class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-white" rows="3" placeholder="Optional notes for the approval"></textarea>
      </section>

      <footer class="mt-4 flex justify-end gap-2">
        <button class="px-3 py-2 text-sm bg-secondary-200 rounded-m3-md" @click="reject">Reject</button>
        <button class="px-3 py-2 text-sm bg-primary-600 text-white rounded-m3-md" @click="approve">Approve</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.max-h-60 { max-height: 15rem; }
</style>
