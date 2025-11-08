<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTemplateStore, type SpecTemplate, type TemplateCategory } from '@/stores/templateStore';

const templateStore = useTemplateStore();

interface Props {
  show: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'select', template: SpecTemplate): void;
  (e: 'create-new'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const searchQuery = ref('');
const selectedCategory = ref<TemplateCategory | 'all'>('all');
const selectedTemplate = ref<SpecTemplate | null>(null);

const categoryOptions: Array<{ value: TemplateCategory | 'all'; label: string; icon: string }> = [
  { value: 'all', label: 'All Templates', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { value: 'feature', label: 'Features', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { value: 'api', label: 'APIs', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { value: 'component', label: 'Components', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z' },
  { value: 'service', label: 'Services', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
];

const filteredTemplates = computed(() => {
  let templates = templateStore.allTemplates;

  // Filter by category
  if (selectedCategory.value !== 'all') {
    templates = templates.filter(t => t.category === selectedCategory.value);
  }

  // Filter by search query
  if (searchQuery.value) {
    templates = templateStore.searchTemplates(searchQuery.value);
  }

  return templates;
});

function selectTemplate(template: SpecTemplate) {
  selectedTemplate.value = template;
}

function useTemplate() {
  if (selectedTemplate.value) {
    emit('select', selectedTemplate.value);
    handleClose();
  }
}

function handleClose() {
  selectedTemplate.value = null;
  searchQuery.value = '';
  selectedCategory.value = 'all';
  emit('close');
}

function deleteTemplate(template: SpecTemplate) {
  if (confirm(`Delete template "${template.name}"?`)) {
    templateStore.deleteTemplate(template.id);
    if (selectedTemplate.value?.id === template.id) {
      selectedTemplate.value = null;
    }
  }
}

function exportTemplate(template: SpecTemplate) {
  const json = templateStore.exportTemplate(template.id);
  if (json) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function getCategoryColor(category: TemplateCategory): string {
  switch (category) {
    case 'feature': return 'bg-primary-container text-on-primary-container';
    case 'api': return 'bg-success-container text-on-success-container';
    case 'component': return 'bg-primary-100 text-primary-800';
    case 'service': return 'bg-secondary-100 text-secondary-800';
    case 'custom': return 'bg-surface-variant text-on-surface-variant';
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 bg-primary-700 text-white">
          <div>
            <h2 class="text-xl font-semibold">Template Library</h2>
            <p class="text-sm text-white/80">Choose a template to start your specification</p>
          </div>
          <button
            @click="handleClose"
            class="text-white hover:bg-white/10 rounded-m3-full p-2 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex flex-1 overflow-hidden">
          <!-- Sidebar - Template List -->
          <div class="w-96 border-r border-surface-variant flex flex-col overflow-hidden bg-surface-1">
            <!-- Search and Filters -->
            <div class="p-4 space-y-3 border-b border-surface-variant">
              <div class="relative">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search templates..."
                  class="w-full pl-10 pr-4 py-2 rounded-m3-md border border-surface-variant bg-surface text-secondary-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <svg class="w-5 h-5 text-secondary-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <!-- Category Filter -->
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="cat in categoryOptions"
                  :key="cat.value"
                  @click="selectedCategory = cat.value"
                  class="px-3 py-1.5 rounded-m3-full text-xs font-medium border transition-colors"
                  :class="selectedCategory === cat.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-surface text-secondary-700 border-surface-variant hover:bg-surface-2'"
                >
                  {{ cat.label }}
                </button>
              </div>

              <button
                @click="emit('create-new')"
                class="w-full px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                + Create New Template
              </button>
            </div>

            <!-- Template Cards -->
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
              <div
                v-for="template in filteredTemplates"
                :key="template.id"
                @click="selectTemplate(template)"
                class="p-3 rounded-m3-md border cursor-pointer transition-all"
                :class="selectedTemplate?.id === template.id
                  ? 'bg-primary-50 border-primary-600 shadow-elevation-1'
                  : 'bg-surface border-surface-variant hover:bg-surface-2'"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-semibold text-secondary-900 truncate">{{ template.name }}</h3>
                    <p class="text-xs text-secondary-600 mt-1 line-clamp-2">{{ template.description }}</p>
                  </div>
                  <span class="ml-2 px-2 py-0.5 rounded-m3-full text-xs font-medium capitalize" :class="getCategoryColor(template.category)">
                    {{ template.category }}
                  </span>
                </div>
                <div class="flex items-center gap-2 mt-2 text-xs text-secondary-500">
                  <span>v{{ template.version }}</span>
                  <span>•</span>
                  <span>{{ template.variables.length }} variable(s)</span>
                </div>
              </div>

              <div v-if="filteredTemplates.length === 0" class="text-center py-12 text-secondary-500">
                <p class="text-sm">No templates found</p>
                <p class="text-xs mt-1">Try adjusting your search or filters</p>
              </div>
            </div>
          </div>

          <!-- Main - Template Preview -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <div v-if="selectedTemplate" class="flex-1 overflow-y-auto p-6">
              <!-- Template Header -->
              <div class="mb-6">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <h2 class="text-2xl font-bold text-secondary-900">{{ selectedTemplate.name }}</h2>
                    <p class="text-sm text-secondary-600 mt-1">{{ selectedTemplate.description }}</p>
                  </div>
                  <span class="px-3 py-1 rounded-m3-full text-sm font-medium capitalize" :class="getCategoryColor(selectedTemplate.category)">
                    {{ selectedTemplate.category }}
                  </span>
                </div>

                <div class="flex items-center gap-4 text-sm text-secondary-600">
                  <span>Version {{ selectedTemplate.version }}</span>
                  <span>•</span>
                  <span>By {{ selectedTemplate.metadata.author }}</span>
                  <span>•</span>
                  <span>{{ new Date(selectedTemplate.metadata.created).toLocaleDateString() }}</span>
                </div>

                <div class="flex flex-wrap gap-2 mt-3">
                  <span
                    v-for="tag in selectedTemplate.metadata.tags"
                    :key="tag"
                    class="px-2 py-1 rounded-m3-md bg-surface-2 text-xs text-secondary-700"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>

              <!-- Variables -->
              <div class="mb-6">
                <h3 class="text-base font-semibold text-secondary-900 mb-3">Template Variables</h3>
                <div class="space-y-2">
                  <div
                    v-for="variable in selectedTemplate.variables"
                    :key="variable.name"
                    class="p-3 rounded-m3-md bg-surface-1 border border-surface-variant"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <code class="text-sm font-mono text-primary-700">{{ variable.name }}</code>
                        <span v-if="variable.required" class="px-2 py-0.5 rounded-m3-full bg-error-100 text-error-800 text-xs font-medium">
                          Required
                        </span>
                        <span class="px-2 py-0.5 rounded-m3-full bg-secondary-100 text-secondary-800 text-xs font-medium">
                          {{ variable.type }}
                        </span>
                      </div>
                      <span v-if="variable.default !== undefined" class="text-xs text-secondary-600">
                        Default: {{ variable.default }}
                      </span>
                    </div>
                    <p class="text-sm text-secondary-600 mt-1">{{ variable.description }}</p>
                  </div>
                </div>
              </div>

              <!-- Content Preview -->
              <div>
                <h3 class="text-base font-semibold text-secondary-900 mb-3">Template Preview</h3>
                <pre class="p-4 rounded-m3-lg bg-surface-3 border border-surface-variant text-sm text-secondary-900 overflow-x-auto max-h-96">{{ selectedTemplate.content }}</pre>
              </div>
            </div>

            <div v-else class="flex-1 flex items-center justify-center text-secondary-500">
              <div class="text-center">
                <svg class="w-16 h-16 mx-auto mb-4 text-secondary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-base font-medium">Select a template to preview</p>
                <p class="text-sm mt-1">Choose from the list on the left</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-6 py-4 bg-surface-1 border-t border-surface-variant">
              <div v-if="selectedTemplate" class="flex gap-2">
                <button
                  @click="exportTemplate(selectedTemplate)"
                  class="px-3 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 text-sm font-medium transition-colors"
                >
                  Export
                </button>
                <button
                  v-if="selectedTemplate.metadata.author !== 'System'"
                  @click="deleteTemplate(selectedTemplate)"
                  class="px-3 py-2 rounded-m3-md border border-error-200 text-error-700 hover:bg-error-50 text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
              <div v-else></div>

              <div class="flex gap-2">
                <button
                  @click="handleClose"
                  class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  @click="useTemplate"
                  :disabled="!selectedTemplate"
                  class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Use This Template
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
