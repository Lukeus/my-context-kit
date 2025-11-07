<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAssistantStore } from '@/stores/assistantStore';

const assistantStore = useAssistantStore();
const { activePending } = storeToRefs(assistantStore);

const content = computed(() => activePending.value?.diffPreview ?? 'No diff available.');
const notes = ref('');

// T033: Destructive double-confirm flow state
const confirmStep = ref<1 | 2>(1); // Step 1: Initial approval, Step 2: Reason + final confirm
const destructiveReason = ref('');
const confirm1At = ref<string | null>(null);
const confirm2At = ref<string | null>(null);

// T033: Identify destructive tools requiring double-confirm (file deletion, directory removal, etc.)
const isDestructiveTool = computed(() => {
  const toolId = activePending.value?.toolId ?? '';
  // TODO(FR-032): Retrieve safetyClass from capability manifest once integrated
  // For now, heuristic based on tool ID keywords
  return /delete|remove|drop|destroy|wipe|clear/i.test(toolId);
});

// T033: Validate reason for destructive tools (≥8 non-whitespace characters)
const isReasonValid = computed(() => {
  if (!isDestructiveTool.value) return true;
  const trimmed = destructiveReason.value.trim();
  return trimmed.length >= 8;
});

function lines() {
  const raw = content.value ?? '';
  return raw.split('\n');
}

function handleFirstConfirm() {
  if (!activePending.value) return;
  
  if (isDestructiveTool.value) {
    // T033: Destructive tool - proceed to step 2 (reason input)
    confirmStep.value = 2;
    confirm1At.value = new Date().toISOString();
  } else {
    // Non-destructive tool - approve immediately with single click
    approve(false);
  }
}

function handleSecondConfirm() {
  if (!activePending.value || !isReasonValid.value) return;
  
  // T033: Capture second confirmation timestamp
  confirm2At.value = new Date().toISOString();
  
  // Approve with destructive flag and reason
  approve(true);
}

function approve(isDestructive: boolean) {
  if (!activePending.value) return;
  
  const approvalNotes = isDestructive 
    ? `DESTRUCTIVE ACTION CONFIRMED. Reason: ${destructiveReason.value.trim()}. ${notes.value ? `Additional notes: ${notes.value}` : ''}`
    : notes.value || 'Approved via UI';
  
  // T033: Emit telemetry with timestamps and reason length
  void assistantStore.approvePending(
    activePending.value.id, 
    approvalNotes,
    {
      isDestructive,
      reasonLength: isDestructive ? destructiveReason.value.trim().length : 0,
      confirm1At: confirm1At.value,
      confirm2At: confirm2At.value
    }
  );
  
  resetAndClose();
}

function reject() {
  if (!activePending.value) return;
  void assistantStore.rejectPending(activePending.value.id, notes.value || 'Rejected via UI');
  resetAndClose();
}

function resetAndClose() {
  // Reset double-confirm state
  confirmStep.value = 1;
  destructiveReason.value = '';
  confirm1At.value = null;
  confirm2At.value = null;
  notes.value = '';
  
  assistantStore.closePendingApproval();
}

// T033: Keyboard navigation - Esc=cancel
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    resetAndClose();
  }
}
</script>

<template>
  <div 
    v-if="activePending && activePending.id" 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
    @keydown="handleKeydown"
    role="dialog"
    aria-modal="true"
    aria-labelledby="approval-dialog-title"
  >
    <div class="w-full max-w-2xl bg-white rounded-m3-xl shadow-elevation-2 p-4">
      <header class="flex items-start justify-between">
        <div>
          <h3 id="approval-dialog-title" class="text-sm font-semibold">
            {{ confirmStep === 1 ? 'Approval required' : 'Confirm destructive action' }}
          </h3>
          <p class="text-xs text-secondary-600">Tool: {{ activePending?.toolId }}</p>
          <p v-if="isDestructiveTool && confirmStep === 1" class="text-xs text-error-700 font-semibold mt-1">
            ⚠️ DESTRUCTIVE OPERATION - Second confirmation required
          </p>
        </div>
        <button class="text-secondary-600" @click="resetAndClose" aria-label="Close dialog">✕</button>
      </header>

      <!-- Step 1: Initial review + optional notes -->
      <section v-if="confirmStep === 1" class="mt-3">
        <div class="text-xs text-secondary-600 mb-2">Diff preview</div>
        <div class="bg-surface-1 p-3 rounded-m3-md overflow-auto max-h-60 border border-surface-variant">
          <template v-for="(line, idx) in lines()" :key="idx">
            <div :class="['text-xs font-mono break-words', line.startsWith('+') ? 'text-primary-700 bg-primary-50' : line.startsWith('-') ? 'text-error-700 bg-error-50' : 'text-secondary-800']">{{ line }}</div>
          </template>
        </div>

        <label class="mt-3 text-xs font-semibold">Notes (optional)</label>
        <textarea 
          v-model="notes" 
          class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-white" 
          rows="3" 
          placeholder="Optional notes for the approval"
          aria-label="Approval notes"
        ></textarea>
      </section>

      <!-- Step 2: Destructive confirmation + reason (T033) -->
      <section v-if="confirmStep === 2" class="mt-3">
        <div class="bg-error-50 border border-error-300 rounded-m3-md p-4 mb-4">
          <p class="text-sm text-error-900 font-semibold mb-2">
            ⚠️ You are about to perform a DESTRUCTIVE action
          </p>
          <p class="text-xs text-error-800">
            This operation cannot be undone. Please provide a reason for this action (minimum 8 characters).
          </p>
        </div>

        <label class="block text-xs font-semibold mb-1" for="destructive-reason">
          Reason for destructive action *
        </label>
        <textarea 
          id="destructive-reason"
          v-model="destructiveReason" 
          class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-white" 
          rows="4" 
          placeholder="Explain why this destructive action is necessary (minimum 8 characters)"
          aria-required="true"
          aria-describedby="reason-validation"
          :aria-invalid="!isReasonValid"
        ></textarea>
        <p id="reason-validation" class="text-xs mt-1" :class="isReasonValid ? 'text-secondary-600' : 'text-error-700'">
          {{ destructiveReason.trim().length }}/8 characters minimum
        </p>
      </section>

      <!-- Footer with dynamic buttons based on step -->
      <footer class="mt-4 flex justify-end gap-2">
        <button 
          class="px-3 py-2 text-sm bg-secondary-200 rounded-m3-md" 
          @click="reject"
          tabindex="0"
        >
          {{ confirmStep === 1 ? 'Reject' : 'Cancel' }}
        </button>
        
        <button 
          v-if="confirmStep === 1"
          class="px-3 py-2 text-sm bg-primary-600 text-white rounded-m3-md" 
          @click="handleFirstConfirm"
          tabindex="0"
        >
          {{ isDestructiveTool ? 'Continue' : 'Approve' }}
        </button>
        
        <button 
          v-if="confirmStep === 2"
          class="px-3 py-2 text-sm bg-error-600 text-white rounded-m3-md disabled:opacity-50 disabled:cursor-not-allowed" 
          @click="handleSecondConfirm"
          :disabled="!isReasonValid"
          tabindex="0"
          aria-label="Confirm destructive action"
        >
          Confirm Destructive Action
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.max-h-60 { max-height: 15rem; }
</style>
