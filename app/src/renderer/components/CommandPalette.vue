<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const emit = defineEmits<{ 'close': []; 'execute': [string] }>();

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
}

const query = ref('');
const selectedIndex = ref(0);

// Minimal command set for quick navigation and actions
const commands = ref<CommandItem[]>([
  { id: 'speckit:workflow', title: 'Speckit Workflow', subtitle: 'Start SDD specification-to-tasks workflow', keywords: ['speckit','sdd','spec','workflow','specify','plan','tasks'] },
  { id: 'assistant:open', title: 'Open AI Assistant', subtitle: 'Toggle the right assistant panel', keywords: ['ai','assistant','chat'] },
  { id: 'impact:analyze', title: 'Open Impact Analysis', subtitle: 'Analyze impact for active entity', keywords: ['impact','analysis'] },
  { id: 'graph:open', title: 'Open Graph View', subtitle: 'Visualize dependency graph', keywords: ['graph','visualize'] },
  { id: 'c4:open', title: 'Open C4 Diagrams', subtitle: 'View architecture diagrams', keywords: ['c4','architecture','diagram','mermaid'] },
  { id: 'git:open', title: 'Open Git Workflow', subtitle: 'View changes, stage and commit', keywords: ['git','commit','pr'] },
  { id: 'create:feature', title: 'Create Feature', subtitle: 'Start feature wizard', keywords: ['new','feature','create'] },
  { id: 'create:userstory', title: 'Create User Story', subtitle: 'Start user story wizard', keywords: ['new','user story','story','create'] },
  { id: 'create:spec', title: 'Create Spec', subtitle: 'Start spec wizard', keywords: ['new','spec','create'] },
  { id: 'create:task', title: 'Create Task', subtitle: 'Start task wizard', keywords: ['new','task','create'] },
]);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return commands.value;
  return commands.value.filter(c =>
    c.title.toLowerCase().includes(q) ||
    (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
    (c.keywords && c.keywords.some(k => k.toLowerCase().includes(q)))
  );
});

function close() {
  emit('close');
}

function execute(item?: CommandItem) {
  const cmd = item || filtered.value[selectedIndex.value];
  if (cmd) {
    emit('execute', cmd.id);
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    execute();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, filtered.value.length - 1);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    return;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="fixed inset-0 z-[100] flex items-start justify-center p-4" style="background-color: rgba(0,0,0,0.4);" @click.self="close">
    <div class="w-full max-w-xl rounded-m3-xl bg-surface shadow-elevation-5 border border-surface-variant overflow-hidden">
      <div class="px-4 py-3 bg-surface-2 border-b border-surface-variant">
        <input
          v-model="query"
          type="text"
          placeholder="Type a command… (e.g., ‘Open AI’, ‘Create feature’)"
          class="w-full px-3 py-2 text-sm rounded-m3-md border border-surface-variant bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
          autofocus
        />
      </div>
      <ul class="max-h-80 overflow-y-auto">
        <li
          v-for="(item, idx) in filtered"
          :key="item.id"
          @click="execute(item)"
          class="px-4 py-3 cursor-pointer border-b border-surface-variant"
          :class="idx === selectedIndex ? 'bg-primary-50' : 'bg-surface'"
        >
          <div class="text-sm font-medium" :class="idx === selectedIndex ? 'text-primary-900' : 'text-secondary-900'">{{ item.title }}</div>
          <div v-if="item.subtitle" class="text-[11px] mt-0.5" :class="idx === selectedIndex ? 'text-primary-700' : 'text-secondary-600'">{{ item.subtitle }}</div>
        </li>
        <li v-if="filtered.length === 0" class="px-4 py-6 text-center text-xs text-secondary-600">No matching commands</li>
      </ul>
      <div class="px-4 py-2 bg-surface-2 text-[10px] text-secondary-500 flex items-center justify-between">
        <span>↑/↓ to navigate • Enter to run • Esc to close</span>
        <span>Ctrl+K</span>
      </div>
    </div>
  </div>
</template>
