import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { SpecKitPreviewCollection } from '@shared/speckit';

vi.mock('@/services/speckitClient', () => ({
  speckitClient: {
    listPreviews: vi.fn(),
    fetch: vi.fn(),
  },
}));

import { speckitClient } from '@/services/speckitClient';
import { useSpeckitLibraryStore } from '@/stores/speckitLibraryStore';

const listPreviewsMock = speckitClient.listPreviews as Mock;

const sampleCollection: SpecKitPreviewCollection = {
  releaseTag: 'v0.0.79',
  commit: 'abc123def',
  fetchedAt: '2025-10-28T12:00:00.000Z',
  generatedAt: '2025-10-28T12:05:00.000Z',
  totalCount: 3,
  warnings: [],
  groups: [
    {
      entityType: 'template',
      items: [
        {
          id: 'templates/feature-spec-template.md',
          displayName: 'Feature Spec Template',
          entityType: 'template',
          content: '# Feature Template',
          source: {
            releaseTag: 'v0.0.79',
            commit: 'abc123def',
            path: 'templates/feature-spec-template.md',
          },
        },
      ],
    },
    {
      entityType: 'spec',
      items: [
        {
          id: 'docs/spec-driven-development.md',
          displayName: 'Spec Driven Development',
          entityType: 'spec',
          content: '# Spec Driven Development',
          source: {
            releaseTag: 'v0.0.79',
            commit: 'abc123def',
            path: 'docs/spec-driven-development.md',
          },
        },
      ],
    },
    {
      entityType: 'userstory',
      items: [
        {
          id: 'docs/user-stories/onboarding.md',
          displayName: 'Onboarding Story',
          entityType: 'userstory',
          content: '# Onboarding',
          source: {
            releaseTag: 'v0.0.79',
            commit: 'abc123def',
            path: 'docs/user-stories/onboarding.md',
          },
        },
      ],
    },
  ],
};

describe('speckitLibraryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    listPreviewsMock.mockReset();
  });

  it('loads previews and initializes filters', async () => {
    listPreviewsMock.mockResolvedValue({ ok: true, data: sampleCollection });

    const store = useSpeckitLibraryStore();
    const result = await store.loadPreviews('C:/repo');

    expect(result.ok).toBe(true);
    expect(store.collection?.releaseTag).toBe('v0.0.79');
    expect(store.availableTypes).toContain('template');
    expect(store.availableTypes).toContain('spec');
    expect(store.availableTypes).toContain('userstory');
    expect(store.selectedIds).toHaveLength(0);
    expect(store.searchTerm).toBe('');
  });

  it('applies search and type filters', async () => {
    listPreviewsMock.mockResolvedValue({ ok: true, data: sampleCollection });
    const store = useSpeckitLibraryStore();
    await store.loadPreviews('C:/repo');

    store.setSearch('template');
    expect(store.filteredGroups).toHaveLength(1);
    expect(store.filteredGroups[0].entityType).toBe('template');

    store.clearSearch();
    store.toggleType('userstory');
    expect(store.filteredGroups.some((group) => group.entityType === 'userstory')).toBe(false);

    store.selectOnly('spec');
    expect(store.filteredGroups).toHaveLength(1);
    expect(store.filteredGroups[0].entityType).toBe('spec');

    store.resetFilters();
    expect(store.filteredGroups.length).toBeGreaterThan(1);
  });

  it('manages selection state', async () => {
    listPreviewsMock.mockResolvedValue({ ok: true, data: sampleCollection });
    const store = useSpeckitLibraryStore();
    await store.loadPreviews('C:/repo');

    const previewId = 'docs/spec-driven-development.md';
    store.toggleSelection(previewId);
    expect(store.selectedIds).toContain(previewId);
    expect(store.selectedCount).toBe(1);

    store.toggleSelection(previewId);
    expect(store.selectedIds).not.toContain(previewId);
    expect(store.selectedCount).toBe(0);

    store.toggleSelection(previewId);
    store.clearSelection();
    expect(store.selectedCount).toBe(0);
  });

  it('propagates load errors', async () => {
    listPreviewsMock.mockResolvedValue({ ok: false, error: 'failed' });
    const store = useSpeckitLibraryStore();
    const result = await store.loadPreviews('C:/repo');

    expect(result.ok).toBe(false);
    expect(store.error).toBe('failed');
  });
});
