<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useContextKitStore, type SpecGenerateResponse, type PromptifyResponse, type CodegenResponse } from '@/stores/contextKitStore';
import { useCache } from '@/composables/useCache';

const contextKitStore = useContextKitStore();
const { cache } = useCache();

interface SpecLogEntry {
  id: string;
  type: 'spec-generate' | 'promptify' | 'codegen';
  timestamp: string;
  status: string;
  data: SpecGenerateResponse | PromptifyResponse | CodegenResponse;
}

type ViewMode = 'list' | 'timeline';
type SortOrder = 'newest' | 'oldest';

const selectedEntry = ref<SpecLogEntry | null>(null);
const filterType = ref<string>('all');
const searchQuery = ref('');
const viewMode = ref<ViewMode>('list');
const sortOrder = ref<SortOrder>('newest');
const dateFilter = ref<{ start: string; end: string }>({ start: '', end: '' });
const showExportMenu = ref(false);

const specLogs = computed(() => {
  const logs: SpecLogEntry[] = [];
  
  // Collect all generated specs
  contextKitStore.generatedSpecs.forEach((spec, id) => {
    logs.push({
      id,
      type: 'spec-generate',
      timestamp: new Date().toISOString(), // Would come from log entry in production
      status: 'success',
      data: spec,
    });
  });
  
  // Collect all generated prompts
  contextKitStore.generatedPrompts.forEach((prompt, id) => {
    logs.push({
      id,
      type: 'promptify',
      timestamp: new Date().toISOString(),
      status: 'success',
      data: prompt,
    });
  });
  
  // Collect all generated code
  contextKitStore.generatedCode.forEach((code, id) => {
    logs.push({
      id,
      type: 'codegen',
      timestamp: new Date().toISOString(),
      status: 'success',
      data: code,
    });
  });
  
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
});

const filteredLogs = computed(() => {
  let logs = specLogs.value;

  // Filter by type
  if (filterType.value !== 'all') {
    logs = logs.filter(log => log.type === filterType.value);
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    logs = logs.filter(log => {
      const data = log.data as any;
      return (
        log.id.toLowerCase().includes(query) ||
        (data.spec_id && data.spec_id.toLowerCase().includes(query)) ||
        (data.spec_content && data.spec_content.toLowerCase().includes(query)) ||
        (data.prompt && data.prompt.toLowerCase().includes(query)) ||
        (data.summary && data.summary.toLowerCase().includes(query))
      );
    });
  }

  // Filter by date range
  if (dateFilter.value.start || dateFilter.value.end) {
    logs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const start = dateFilter.value.start ? new Date(dateFilter.value.start) : null;
      const end = dateFilter.value.end ? new Date(dateFilter.value.end) : null;
      
      if (start && logDate < start) return false;
      if (end && logDate > end) return false;
      return true;
    });
  }

  // Sort
  logs.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return logs;
});

const typeColor = (type: string) => {
  switch (type) {
    case 'spec-generate': return 'bg-blue-100 text-blue-800';
    case 'promptify': return 'bg-blue-100 text-blue-800';
    case 'codegen': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const typeLabel = (type: string) => {
  switch (type) {
    case 'spec-generate': return 'Spec';
    case 'promptify': return 'Prompt';
    case 'codegen': return 'Code';
    default: return type;
  }
};

function selectEntry(entry: SpecLogEntry) {
  selectedEntry.value = entry;
}

function closeDetail() {
  selectedEntry.value = null;
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function exportLogs(format: 'json' | 'csv' | 'markdown') {
  const logs = filteredLogs.value;
  
  if (format === 'json') {
    const json = JSON.stringify(logs, null, 2);
    downloadFile(json, 'spec-logs.json', 'application/json');
  } else if (format === 'csv') {
    const csv = convertToCSV(logs);
    downloadFile(csv, 'spec-logs.csv', 'text/csv');
  } else if (format === 'markdown') {
    const md = convertToMarkdown(logs);
    downloadFile(md, 'spec-logs.md', 'text/markdown');
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function convertToCSV(logs: SpecLogEntry[]): string {
  const headers = ['ID', 'Type', 'Timestamp', 'Status', 'Duration (ms)'];
  const rows = logs.map(log => [
    log.id,
    log.type,
    new Date(log.timestamp).toISOString(),
    log.status,
    (log.data as any).duration_ms || 'N/A'
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

function convertToMarkdown(logs: SpecLogEntry[]): string {
  let md = '# Spec Log Export\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Total Entries: ${logs.length}\n\n`;
  
  logs.forEach(log => {
    md += `## ${typeLabel(log.type)} - ${log.id}\n`;
    md += `- **Timestamp**: ${formatTimestamp(log.timestamp)}\n`;
    md += `- **Status**: ${log.status}\n`;
    md += `- **Duration**: ${(log.data as any).duration_ms || 'N/A'}ms\n\n`;
  });
  
  return md;
}

function clearFilters() {
  searchQuery.value = '';
  filterType.value = 'all';
  dateFilter.value = { start: '', end: '' };
  sortOrder.value = 'newest';
}

function clearCache() {
  if (confirm('Clear all cached inspection results? This will improve performance for changed repositories.')) {
    cache.invalidate('inspect:');
    alert('Cache cleared successfully');
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-surface-variant bg-surface">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold text-secondary-900">Spec Logs</h2>
          <p class="text-sm text-secondary-600 mt-1">Generated specifications, prompts, and code artifacts</p>
        </div>
        <div class="flex gap-2">
          <!-- View Mode Toggle -->
          <div class="flex rounded-m3-md border border-surface-variant overflow-hidden">
            <button
              @click="viewMode = 'list'"
              class="px-3 py-2 text-sm font-medium transition-colors"
              :class="viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-surface text-secondary-700 hover:bg-surface-2'"
            >
              List
            </button>
            <button
              @click="viewMode = 'timeline'"
              class="px-3 py-2 text-sm font-medium transition-colors"
              :class="viewMode === 'timeline' ? 'bg-primary-600 text-white' : 'bg-surface text-secondary-700 hover:bg-surface-2'"
            >
              Timeline
            </button>
          </div>

          <!-- Export Dropdown -->
          <div class="relative">
            <button
              @click="showExportMenu = !showExportMenu"
              class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <div v-if="showExportMenu" class="absolute right-0 mt-2 w-48 rounded-m3-md shadow-elevation-3 bg-surface border border-surface-variant z-10">
              <button @click="exportLogs('json'); showExportMenu = false" class="w-full px-4 py-2 text-left text-sm hover:bg-surface-2 transition-colors">Export as JSON</button>
              <button @click="exportLogs('csv'); showExportMenu = false" class="w-full px-4 py-2 text-left text-sm hover:bg-surface-2 transition-colors">Export as CSV</button>
              <button @click="exportLogs('markdown'); showExportMenu = false" class="w-full px-4 py-2 text-left text-sm hover:bg-surface-2 transition-colors">Export as Markdown</button>
            </div>
          </div>

          <!-- Cache Management -->
          <button
            @click="clearCache"
            class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 text-sm font-medium transition-colors"
            title="Clear cached inspection results"
          >
            Clear Cache
          </button>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="mt-4 flex gap-3">
        <div class="flex-1 relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search logs by ID, content, or spec..."
            class="w-full pl-10 pr-4 py-2 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <svg class="w-5 h-5 text-secondary-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <select
          v-model="sortOrder"
          class="px-4 py-2 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        <button
          v-if="searchQuery || filterType !== 'all' || dateFilter.start || dateFilter.end"
          @click="clearFilters"
          class="px-4 py-2 rounded-m3-md text-sm font-medium text-error-700 hover:bg-error-50 transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="px-6 py-3 border-b border-surface-variant bg-surface-1 flex gap-2">
      <button
        @click="filterType = 'all'"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="filterType === 'all' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        All ({{ specLogs.length }})
      </button>
      <button
        @click="filterType = 'spec-generate'"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="filterType === 'spec-generate' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        Specifications
      </button>
      <button
        @click="filterType = 'promptify'"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="filterType === 'promptify' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        Prompts
      </button>
      <button
        @click="filterType = 'codegen'"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="filterType === 'codegen' 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        Code
      </button>
    </div>

    <!-- Log List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="filteredLogs.length === 0" class="flex items-center justify-center h-full text-gray-500">
        <div class="text-center">
          <p class="text-lg font-medium">No logs yet</p>
          <p class="text-sm mt-1">Generate specs, prompts, or code to see them here</p>
        </div>
      </div>

      <div v-else class="divide-y">
        <div
          v-for="log in filteredLogs"
          :key="log.id"
          @click="selectEntry(log)"
          class="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span
                  class="px-2 py-1 rounded text-xs font-medium"
                  :class="typeColor(log.type)"
                >
                  {{ typeLabel(log.type) }}
                </span>
                <span class="text-sm text-gray-500">{{ formatTimestamp(log.timestamp) }}</span>
              </div>
              
              <div class="mt-2">
                <div v-if="log.type === 'spec-generate'" class="text-sm">
                  <p class="font-medium text-gray-900">{{ (log.data as SpecGenerateResponse).spec_id }}</p>
                  <p class="text-gray-600 mt-1 line-clamp-2">
                    {{ (log.data as SpecGenerateResponse).spec_content.substring(0, 150) }}...
                  </p>
                </div>
                
                <div v-else-if="log.type === 'promptify'" class="text-sm">
                  <p class="font-medium text-gray-900">Prompt for {{ (log.data as PromptifyResponse).spec_id }}</p>
                  <p class="text-gray-600 mt-1">
                    Context: {{ (log.data as PromptifyResponse).context_included.length }} entities
                  </p>
                </div>
                
                <div v-else-if="log.type === 'codegen'" class="text-sm">
                  <p class="font-medium text-gray-900">{{ (log.data as CodegenResponse).summary }}</p>
                  <p class="text-gray-600 mt-1">
                    {{ (log.data as CodegenResponse).artifacts.length }} files generated
                  </p>
                </div>
              </div>
            </div>
            
            <div class="text-sm text-gray-400 ml-4">
              {{ (log.data as any).duration_ms }}ms
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Panel -->
    <div
      v-if="selectedEntry"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="closeDetail"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col m-4">
        <div class="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 class="text-xl font-semibold">{{ typeLabel(selectedEntry.type) }} Details</h3>
            <p class="text-sm text-gray-600 mt-1">{{ formatTimestamp(selectedEntry.timestamp) }}</p>
          </div>
          <button
            @click="closeDetail"
            class="text-gray-400 hover:text-gray-600 rounded p-2"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <!-- Spec Content -->
          <div v-if="selectedEntry.type === 'spec-generate'" class="space-y-4">
            <div>
              <h4 class="font-medium text-gray-700 mb-2">Specification ID</h4>
              <p class="font-mono text-sm">{{ (selectedEntry.data as SpecGenerateResponse).spec_id }}</p>
            </div>
            
            <div>
              <h4 class="font-medium text-gray-700 mb-2">Content</h4>
              <pre class="bg-gray-50 p-4 rounded text-sm overflow-x-auto">{{ (selectedEntry.data as SpecGenerateResponse).spec_content }}</pre>
            </div>
            
            <div>
              <h4 class="font-medium text-gray-700 mb-2">Related Entities</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="entity in (selectedEntry.data as SpecGenerateResponse).related_entities"
                  :key="entity"
                  class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {{ entity }}
                </span>
              </div>
            </div>
          </div>

          <!-- Prompt Content -->
          <div v-else-if="selectedEntry.type === 'promptify'" class="space-y-4">
            <div>
              <h4 class="font-medium text-gray-700 mb-2">Prompt</h4>
              <pre class="bg-gray-50 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">{{ (selectedEntry.data as PromptifyResponse).prompt }}</pre>
            </div>
            
            <div>
              <h4 class="font-medium text-gray-700 mb-2">Included Context</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="entity in (selectedEntry.data as PromptifyResponse).context_included"
                  :key="entity"
                  class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {{ entity }}
                </span>
              </div>
            </div>
          </div>

          <!-- Code Artifacts -->
          <div v-else-if="selectedEntry.type === 'codegen'" class="space-y-4">
            <div>
              <h4 class="font-medium text-gray-700 mb-2">Summary</h4>
              <p>{{ (selectedEntry.data as CodegenResponse).summary }}</p>
            </div>
            
            <div v-for="(artifact, index) in (selectedEntry.data as CodegenResponse).artifacts" :key="index" class="space-y-2">
              <h4 class="font-medium text-gray-700">{{ artifact.path }}</h4>
              <p v-if="artifact.description" class="text-sm text-gray-600">{{ artifact.description }}</p>
              <pre class="bg-gray-50 p-4 rounded text-sm overflow-x-auto">{{ artifact.content }}</pre>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t flex justify-end gap-2">
          <button
            @click="copyToClipboard(JSON.stringify(selectedEntry.data, null, 2))"
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Copy JSON
          </button>
          <button
            @click="closeDetail"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
