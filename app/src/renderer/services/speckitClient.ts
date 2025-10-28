import type {
  SpecKitEntityType,
  SpecKitFetchPipelineResult,
  SpecKitPipelineReport,
  SpecKitPreviewCollection,
  SpecKitPreviewListResponse,
} from '@shared/speckit';

interface FetchOptions {
  repoPath: string;
  releaseTag?: string;
  forceRefresh?: boolean;
}

export const speckitClient = {
  async fetch(options: FetchOptions): Promise<SpecKitFetchPipelineResult> {
    const { repoPath, releaseTag, forceRefresh } = options;
    if (!repoPath) {
      throw new Error('Context repository path is required to fetch Spec Kit data.');
    }
    return await window.api.speckit.fetch(repoPath, releaseTag, forceRefresh);
  },

  async listPreviews(repoPath: string): Promise<SpecKitPreviewListResponse> {
    if (!repoPath) {
      return { ok: false, error: 'Context repository path is required to list Spec Kit previews.' };
    }
    return await window.api.speckit.listPreviews(repoPath);
  },

  async runPipelines(
    repoPath: string,
    options?: {
      createdPaths?: string[];
      entityMetadata?: Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>;
      sourcePreviewPaths?: string[];
    },
  ): Promise<{ ok: boolean; data?: SpecKitPipelineReport; error?: string }> {
    if (!repoPath) {
      return { ok: false, error: 'Context repository path is required to run Spec Kit pipelines.' };
    }

    return await window.api.speckit.runPipelines(repoPath, {
      createdPaths: options?.createdPaths,
      entityMetadata: options?.entityMetadata,
      sourcePreviewPaths: options?.sourcePreviewPaths,
    });
  },
};

export type { SpecKitPreviewCollection };
