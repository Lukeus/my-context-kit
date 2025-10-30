<template>
  <div class="rag-sources-panel">
    <div class="sources-header">
      <h3 class="sources-title">
        <span class="icon">📚</span>
        Context Sources
      </h3>
      <div class="sources-meta">
        <span v-if="ragStore.activeSources.length > 0" class="source-count">
          {{ ragStore.activeSources.length }} sources
        </span>
        <button 
          v-if="ragStore.activeSources.length > 0"
          @click="ragStore.clearSources()"
          class="clear-btn"
          title="Clear sources"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="ragStore.activeSources.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <p class="empty-message">No context sources loaded</p>
      <p class="empty-hint">Ask a question to see relevant context</p>
    </div>

    <!-- Sources list -->
    <div v-else class="sources-list">
      <div
        v-for="(source, index) in ragStore.activeSources"
        :key="source.id"
        class="source-card"
        :class="{ 'highly-relevant': source.relevance >= 80 }"
      >
        <div class="source-header">
          <div class="source-info">
            <span class="source-badge" :class="`badge-${source.type}`">
              {{ formatType(source.type) }}
            </span>
            <span class="source-id">{{ source.id }}</span>
            <span class="source-title" v-if="source.title">
              {{ source.title }}
            </span>
          </div>
          <div class="source-relevance">
            <div class="relevance-bar">
              <div
                class="relevance-fill"
                :style="{ width: `${source.relevance}%` }"
                :class="getRelevanceClass(source.relevance)"
              ></div>
            </div>
            <span class="relevance-score">{{ source.relevance }}%</span>
          </div>
        </div>

        <div class="source-excerpt">
          <p>{{ source.excerpt }}</p>
        </div>

        <div class="source-actions">
          <button
            @click="viewEntity(source.id)"
            class="action-btn"
            title="View full entity"
          >
            <span class="icon">👁️</span> View
          </button>
          <button
            @click="findSimilar(source.id)"
            class="action-btn"
            title="Find similar entities"
          >
            <span class="icon">🔗</span> Similar
          </button>
          <button
            @click="copyId(source.id)"
            class="action-btn"
            title="Copy ID"
          >
            <span class="icon">📋</span> Copy
          </button>
        </div>
      </div>
    </div>

    <!-- Relevance legend -->
    <div v-if="ragStore.activeSources.length > 0" class="relevance-legend">
      <span class="legend-title">Relevance:</span>
      <span class="legend-item">
        <span class="legend-color high"></span> High (80%+)
      </span>
      <span class="legend-item">
        <span class="legend-color medium"></span> Medium (50-79%)
      </span>
      <span class="legend-item">
        <span class="legend-color low"></span> Low (&lt;50%)
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRAGStore } from '../../stores/ragStore';
import { useContextStore } from '../../stores/contextStore';
import { useSnackbarStore } from '../../stores/snackbarStore';

const ragStore = useRAGStore();
const contextStore = useContextStore();
const snackbarStore = useSnackbarStore();

function formatType(type: string): string {
  const typeMap: Record<string, string> = {
    feature: 'Feature',
    userstory: 'Story',
    spec: 'Spec',
    task: 'Task',
    service: 'Service',
    package: 'Package',
    governance: 'Gov'
  };
  return typeMap[type] || type;
}

function getRelevanceClass(relevance: number): string {
  if (relevance >= 80) return 'high';
  if (relevance >= 50) return 'medium';
  return 'low';
}

async function viewEntity(entityId: string) {
  try {
    // Find the entity file
    const typeGuess = entityId.split('-')[0].toLowerCase();
    const result = await window.api.fs.findEntityFile(
      contextStore.repoPath!,
      typeGuess,
      entityId
    );

    if (result.ok && result.filePath) {
      // Emit event to open entity in editor
      // This would need to be handled by a parent component
      snackbarStore.showSuccess(`Entity file: ${result.filePath}`);
    } else {
      snackbarStore.showError('Entity file not found');
    }
  } catch (error) {
    console.error('Failed to view entity:', error);
    snackbarStore.showError('Failed to view entity');
  }
}

async function findSimilar(entityId: string) {
  try {
    const similar = await ragStore.findSimilar(entityId, 5);
    
    if (similar.length > 0) {
      snackbarStore.showInfo(`Found ${similar.length} similar entities`);
      // Could emit event or open a modal to display similar entities
      console.log('Similar entities:', similar);
    } else {
      snackbarStore.showInfo('No similar entities found');
    }
  } catch (error) {
    console.error('Failed to find similar entities:', error);
    snackbarStore.showError('Failed to find similar entities');
  }
}

async function copyId(entityId: string) {
  try {
    await window.api.clipboard.writeText(entityId);
    snackbarStore.showSuccess('ID copied to clipboard');
  } catch (error) {
    console.error('Failed to copy ID:', error);
    snackbarStore.showError('Failed to copy ID');
  }
}
</script>

<style scoped>
.rag-sources-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-surface-1, #fafafa);
  border-left: 1px solid var(--color-surface-variant, #e0e0e0);
  overflow: hidden;
}

.sources-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--color-surface-variant, #e0e0e0);
  background: var(--color-surface-2, #f5f5f5);
}

.sources-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-secondary-900, #1a1a1a);
}

.sources-title .icon {
  font-size: 1.25rem;
}

.sources-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.source-count {
  font-size: 0.875rem;
  color: var(--color-secondary-600, #666);
  font-weight: 500;
}

.clear-btn {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--color-secondary-600, #666);
  cursor: pointer;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: var(--color-surface-3, #eeeeee);
  color: var(--color-secondary-900, #1a1a1a);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-message {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
  color: var(--color-secondary-900, #1a1a1a);
}

.empty-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-secondary-600, #666);
}

.sources-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.source-card {
  background: var(--color-surface-2, #f5f5f5);
  border: 1px solid var(--color-surface-variant, #e0e0e0);
  border-radius: 16px;
  padding: 0.75rem;
  transition: all 0.2s;
}

.source-card:hover {
  border-color: var(--color-primary-600, #1976d2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.source-card.highly-relevant {
  border: 2px solid var(--color-success-600, #4caf50);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.source-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.source-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-feature { background: #dbeafe; color: #1e40af; }
.badge-userstory { background: #fce7f3; color: #be185d; }
.badge-spec { background: #e0e7ff; color: #4338ca; }
.badge-task { background: #d1fae5; color: #047857; }
.badge-service { background: #fef3c7; color: #92400e; }
.badge-package { background: #e0e7ff; color: #5b21b6; }
.badge-governance { background: #fee2e2; color: #991b1b; }

.source-id {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  font-weight: 500;
}

.source-title {
  font-size: 0.875rem;
  color: var(--color-text, #111827);
  font-weight: 500;
}

.source-relevance {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 80px;
}

.relevance-bar {
  width: 40px;
  height: 8px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 4px;
  overflow: hidden;
}

.relevance-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 4px;
}

.relevance-fill.high { background: #10b981; }
.relevance-fill.medium { background: #f59e0b; }
.relevance-fill.low { background: #ef4444; }

.relevance-score {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
}

.source-excerpt {
  margin: 0.5rem 0;
  padding: 0.5rem;
  background: var(--color-surface-3, #eeeeee);
  border-radius: 8px;
}

.source-excerpt p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-secondary-700, #555);
}

.source-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-surface-variant, #e0e0e0);
  background: var(--color-surface-2, #f5f5f5);
  border-radius: 8px;
  font-size: 0.75rem;
  color: var(--color-secondary-700, #555);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: var(--color-primary-600, #1976d2);
  color: var(--color-primary-600, #1976d2);
  background: var(--color-primary-50, #e3f2fd);
}

.action-btn .icon {
  font-size: 0.875rem;
}

.relevance-legend {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-2, #f5f5f5);
  border-top: 1px solid var(--color-surface-variant, #e0e0e0);
  font-size: 0.75rem;
  color: var(--color-secondary-600, #666);
}

.legend-title {
  font-weight: 600;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.high { background: #10b981; }
.legend-color.medium { background: #f59e0b; }
.legend-color.low { background: #ef4444; }
</style>
