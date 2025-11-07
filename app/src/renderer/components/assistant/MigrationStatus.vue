<template>
  <button
    v-if="visible"
    type="button"
    class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
    :class="badgeClass"
    role="status"
    :aria-label="ariaLabel"
    @click="emit('open')"
  >
    <span>{{ icon }}</span>
    <span class="font-medium">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { listImportedSessions } from '@/services/assistant/migrationAdapter';

interface Props {
  dismissed?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ open: [] }>();

// Derive status from imported session ledger
const imported = computed(() => listImportedSessions());

const label = computed(() => {
  if (imported.value.length === 0) return 'Legacy Pending';
  return 'Legacy Migrated';
});

const icon = computed(() => imported.value.length === 0 ? '🕒' : '✅');

const badgeClass = computed(() => imported.value.length === 0
  ? 'bg-amber-100 text-amber-700'
  : 'bg-green-100 text-green-800');

const visible = computed(() => !props.dismissed);

const ariaLabel = computed(() => imported.value.length === 0
  ? 'Legacy migration pending'
  : 'Legacy migration completed');
</script>

<!-- Tailwind utility classes inline -->
