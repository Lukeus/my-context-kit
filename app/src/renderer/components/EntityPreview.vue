<script setup lang="ts">
import { computed } from 'vue';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

const entity = computed(() => contextStore.activeEntity);
const type = computed(() => entity.value?._type || '');
</script>

<template>
  <div class="h-full overflow-auto p-4">
    <div v-if="!entity" class="text-xs text-secondary-600">No entity selected.</div>
    <div v-else class="space-y-4">
      <div class="text-lg font-semibold">{{ entity.title || entity.name || entity.id }}</div>
      <div class="flex flex-wrap items-center gap-2 text-[11px]">
        <span class="px-2 py-0.5 rounded-m3-md bg-surface-3 border border-surface-variant">{{ type }}</span>
        <span v-if="entity.status" class="px-2 py-0.5 rounded-m3-md bg-surface-3 border border-surface-variant">status: {{ entity.status }}</span>
        <span v-if="entity.domain" class="px-2 py-0.5 rounded-m3-md bg-surface-3 border border-surface-variant">domain: {{ entity.domain }}</span>
      </div>

      <div v-if="type === 'feature'" class="space-y-2">
        <h3 class="text-sm font-semibold">User Stories</h3>
        <ul class="list-disc list-inside text-sm">
          <li v-for="id in entity.userStories || []" :key="id">{{ id }}</li>
        </ul>
        <h3 class="text-sm font-semibold mt-2">Specs</h3>
        <ul class="list-disc list-inside text-sm">
          <li v-for="id in entity.specs || []" :key="id">{{ id }}</li>
        </ul>
        <h3 class="text-sm font-semibold mt-2">Tasks</h3>
        <ul class="list-disc list-inside text-sm">
          <li v-for="id in entity.tasks || []" :key="id">{{ id }}</li>
        </ul>
      </div>

      <div v-else-if="type === 'userstory'" class="space-y-2">
        <div class="text-sm"><strong>As a</strong> {{ entity.asA }}, <strong>I want</strong> {{ entity.iWant }}, <strong>so that</strong> {{ entity.soThat }}</div>
        <h3 class="text-sm font-semibold mt-2">Acceptance Criteria</h3>
        <ul class="list-disc list-inside text-sm">
          <li v-for="(c, i) in entity.acceptanceCriteria || []" :key="i">{{ c }}</li>
        </ul>
      </div>

      <div v-else-if="type === 'spec'" class="space-y-2">
        <h3 class="text-sm font-semibold">Type</h3>
        <div class="text-sm">{{ entity.type }}</div>
        <h3 class="text-sm font-semibold mt-2">Related</h3>
        <pre class="text-xs bg-surface-2 border border-surface-variant rounded-m3-md p-3">{{ JSON.stringify(entity.related || {}, null, 2) }}</pre>
      </div>

      <div v-else class="text-sm text-secondary-700">No preview available for this entity type yet.</div>
    </div>
  </div>
</template>
