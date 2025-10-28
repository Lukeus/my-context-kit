import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  SpecKitEntityPreview,
  SpecKitEntityType,
  SpecKitPreviewCollection,
} from '@shared/speckit';
import { speckitClient } from '@/services/speckitClient';

interface LoadResult {
  ok: boolean;
  collection?: SpecKitPreviewCollection;
  error?: string;
}

const normalize = (value: string): string => value.trim().toLowerCase();

export const useSpeckitLibraryStore = defineStore('speckitLibrary', () => {
  const collection = ref<SpecKitPreviewCollection | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const warnings = ref<string[]>([]);
  const searchTerm = ref('');
  const activeTypes = ref<SpecKitEntityType[]>([]);
  const selectedIds = ref<string[]>([]);
  const lastLoadedAt = ref<string | null>(null);

  const availableTypes = computed<SpecKitEntityType[]>(() => {
    if (!collection.value) {
      return [];
    }
    return collection.value.groups
      .filter((group) => group.items.length > 0)
      .map((group) => group.entityType);
  });

  const hasActiveFilters = computed(() => activeTypes.value.length > 0);

  const effectiveTypes = computed<SpecKitEntityType[]>(() => {
    if (!hasActiveFilters.value) {
      return availableTypes.value;
    }
    return activeTypes.value;
  });

  const normalizedSearch = computed(() => normalize(searchTerm.value));

  const filteredGroups = computed(() => {
    if (!collection.value) {
      return [] as Array<{ entityType: SpecKitEntityType; items: SpecKitEntityPreview[] }>;
    }

    const search = normalizedSearch.value;
    const types = new Set(effectiveTypes.value);

    return collection.value.groups
      .map(({ entityType, items }) => {
        if (types.size > 0 && !types.has(entityType)) {
          return { entityType, items: [] as SpecKitEntityPreview[] };
        }

        const filtered = items.filter((item) => {
          if (search.length === 0) {
            return true;
          }
          const haystack = `${item.displayName} ${item.id}`.toLowerCase();
          return haystack.includes(search);
        });

        return { entityType, items: filtered };
      })
      .filter((group) => group.items.length > 0);
  });

  const flattenedPreviews = computed(() =>
    filteredGroups.value.flatMap((group) => group.items)
  );

  const selectionSet = computed(() => new Set(selectedIds.value));

  const selectedPreviews = computed<SpecKitEntityPreview[]>(() => {
    if (!collection.value) {
      return [];
    }

    const available = new Map<string, SpecKitEntityPreview>();
    collection.value.groups.forEach((group) => {
      group.items.forEach((item) => {
        available.set(item.id, item);
      });
    });

    return selectedIds.value
      .map((id) => available.get(id))
      .filter((item): item is SpecKitEntityPreview => Boolean(item));
  });

  const selectedCount = computed(() => selectedIds.value.length);

  async function loadPreviews(repoPath: string): Promise<LoadResult> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await speckitClient.listPreviews(repoPath);
      if (!response.ok) {
        const fallbackMessage = 'Failed to load Spec Kit previews.';
        let message = fallbackMessage;

        if ('error' in response && typeof response.error === 'string') {
          message = response.error;
        }

        error.value = message;
        return { ok: false, error: message };
      }

      if (!response.data) {
        const message = 'Spec Kit preview payload was empty.';
        error.value = message;
        return { ok: false, error: message };
      }

      collection.value = response.data;
      warnings.value = [...response.data.warnings];
      lastLoadedAt.value = response.data.generatedAt;

      const available = availableTypes.value;
      activeTypes.value = [...available];

      const selectableIds = new Set(
        response.data.groups.flatMap((group) => group.items.map((item) => item.id))
      );
      selectedIds.value = selectedIds.value.filter((id) => selectableIds.has(id));

      return { ok: true, collection: response.data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error loading Spec Kit previews.';
      error.value = message;
      return { ok: false, error: message };
    } finally {
      isLoading.value = false;
    }
  }

  function setSearch(term: string): void {
    searchTerm.value = term;
  }

  function clearSearch(): void {
    searchTerm.value = '';
  }

  function toggleType(entityType: SpecKitEntityType): void {
    if (activeTypes.value.includes(entityType)) {
      activeTypes.value = activeTypes.value.filter((type) => type !== entityType);
    } else {
      activeTypes.value = [...activeTypes.value, entityType];
    }
  }

  function selectOnly(entityType: SpecKitEntityType): void {
    activeTypes.value = [entityType];
  }

  function resetFilters(): void {
    activeTypes.value = [...availableTypes.value];
  }

  function toggleSelection(id: string): void {
    if (selectionSet.value.has(id)) {
      selectedIds.value = selectedIds.value.filter((selected) => selected !== id);
    } else {
      selectedIds.value = [...selectedIds.value, id];
    }
  }

  function setSelection(ids: string[]): void {
    selectedIds.value = [...ids];
  }

  function clearSelection(): void {
    selectedIds.value = [];
  }

  function isSelected(id: string): boolean {
    return selectionSet.value.has(id);
  }

  return {
    collection,
    isLoading,
    error,
    warnings,
    searchTerm,
    activeTypes,
    selectedIds,
    lastLoadedAt,
    availableTypes,
    hasActiveFilters,
    filteredGroups,
    flattenedPreviews,
    selectedPreviews,
    selectedCount,
    loadPreviews,
    setSearch,
    clearSearch,
    toggleType,
    selectOnly,
    resetFilters,
    toggleSelection,
    setSelection,
    clearSelection,
    isSelected,
  };
});
