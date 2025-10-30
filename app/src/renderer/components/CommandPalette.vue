<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { routes } from '../config/routes';
import type { Route } from '../services/RouterService';

const emit = defineEmits<{ 'close': []; 'execute': [string] }>();

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  category?: 'navigation' | 'action';
}

const query = ref('');
const selectedIndex = ref(0);

// Build navigation commands from routes
function buildNavigationCommands(): CommandItem[] {
  return routes
    .filter(route => route.meta?.title && route.meta?.icon)
    .map(route => ({
      id: `nav:${route.id}`,
      title: `Go to ${route.meta!.title}`,
      subtitle: route.meta!.requiresRepo ? 'Requires repository' : 'Navigate to view',
      keywords: [route.id, route.meta!.title!.toLowerCase(), route.meta!.icon!, 'navigate', 'go', 'open'],
      category: 'navigation' as const
    }));
}

// Action commands for workflows and creation
const actionCommands: CommandItem[] = [
  { id: 'speckit:workflow', title: 'Speckit Workflow', subtitle: 'Start SDD specification-to-tasks workflow', keywords: ['speckit','sdd','spec','workflow','specify','plan','tasks'], category: 'action' },
  { id: 'assistant:open', title: 'Open AI Assistant', subtitle: 'Toggle the right assistant panel', keywords: ['ai','assistant','chat'], category: 'action' },
  { id: 'impact:analyze', title: 'Open Impact Analysis', subtitle: 'Analyze impact for active entity', keywords: ['impact','analysis'], category: 'action' },
  { id: 'create:feature', title: 'Create Feature', subtitle: 'Start feature wizard', keywords: ['new','feature','create'], category: 'action' },
  { id: 'create:userstory', title: 'Create User Story', subtitle: 'Start user story wizard', keywords: ['new','user story','story','create'], category: 'action' },
  { id: 'create:spec', title: 'Create Spec', subtitle: 'Start spec wizard', keywords: ['new','spec','create'], category: 'action' },
  { id: 'create:task', title: 'Create Task', subtitle: 'Start task wizard', keywords: ['new','task','create'], category: 'action' },
];

// Combine navigation and action commands
const commands = ref<CommandItem[]>([
  ...buildNavigationCommands(),
  ...actionCommands
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

// Group commands by category for better UX
const groupedCommands = computed(() => {
  const navigation = filtered.value.filter(c => c.category === 'navigation');
  const actions = filtered.value.filter(c => c.category === 'action');
  return { navigation, actions };
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
    <div class="w-full max-w-xl rounded-m3-md bg-surface shadow-elevation-5 border border-surface-variant overflow-hidden">
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
        <!-- Navigation Commands -->
        <template v-if="groupedCommands.navigation.length > 0">
          <li class="px-4 py-2 bg-surface-2 border-b border-surface-variant">
            <div class="text-[10px] font-semibold text-secondary-500 uppercase tracking-wide">Navigation</div>
          </li>
          <li
            v-for="(item, idx) in groupedCommands.navigation"
            :key="item.id"
            @click="execute(item)"
            class="px-4 py-3 cursor-pointer border-b border-surface-variant"
            :class="idx === selectedIndex ? 'bg-primary-50' : 'bg-surface'"
          >
            <div class="text-sm font-medium" :class="idx === selectedIndex ? 'text-primary-900' : 'text-secondary-900'">{{ item.title }}</div>
            <div v-if="item.subtitle" class="text-[11px] mt-0.5" :class="idx === selectedIndex ? 'text-primary-700' : 'text-secondary-600'">{{ item.subtitle }}</div>
          </li>
        </template>
        
        <!-- Action Commands -->
        <template v-if="groupedCommands.actions.length > 0">
          <li class="px-4 py-2 bg-surface-2 border-b border-surface-variant">
            <div class="text-[10px] font-semibold text-secondary-500 uppercase tracking-wide">Actions</div>
          </li>
          <li
            v-for="(item, idx) in groupedCommands.actions"
            :key="item.id"
            @click="execute(item)"
            class="px-4 py-3 cursor-pointer border-b border-surface-variant"
            :class="(idx + groupedCommands.navigation.length) === selectedIndex ? 'bg-primary-50' : 'bg-surface'"
          >
            <div class="text-sm font-medium" :class="(idx + groupedCommands.navigation.length) === selectedIndex ? 'text-primary-900' : 'text-secondary-900'">{{ item.title }}</div>
            <div v-if="item.subtitle" class="text-[11px] mt-0.5" :class="(idx + groupedCommands.navigation.length) === selectedIndex ? 'text-primary-700' : 'text-secondary-600'">{{ item.subtitle }}</div>
          </li>
        </template>
        
        <li v-if="filtered.length === 0" class="px-4 py-6 text-center text-xs text-secondary-600">No matching commands</li>
      </ul>
      <div class="px-4 py-2 bg-surface-2 text-[10px] text-secondary-500 flex items-center justify-between">
        <span>↑/↓ to navigate • Enter to run • Esc to close</span>
        <span>Ctrl+K</span>
      </div>
    </div>
  </div>
</template>
