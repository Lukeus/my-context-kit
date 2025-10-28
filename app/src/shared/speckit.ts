// Shared Spec Kit domain types used across main, preload, and renderer layers

export type SpecKitEntityType =
  | 'feature'
  | 'userstory'
  | 'spec'
  | 'governance'
  | 'template';

export interface SpecKitArtifactInventory {
  docs: string[];
  templates: string[];
  memory: string[];
}

export interface SpecKitCacheSnapshot {
  releaseTag: string;
  commit: string;
  fetchedAt: string;
  durationMs: number;
  artifacts: SpecKitArtifactInventory;
}

export interface SpecKitFetchSource {
  repository: string;
  releaseTag: string | null;
  commit: string | null;
}

export interface SpecKitFetchTiming {
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
}

export interface SpecKitFetchStatus {
  ok: boolean;
  error: string | null;
  inProgress?: boolean;
  stale?: boolean;
}

export interface SpecKitFetchSummary {
  source: SpecKitFetchSource;
  timing: SpecKitFetchTiming;
  artifacts: SpecKitArtifactInventory;
  status: SpecKitFetchStatus;
  warnings?: string[];
}

export interface SpecKitFetchPipelineSuccess extends SpecKitFetchSummary {
  ok: true;
  cachePath: string;
  releaseTag: string;
  commit: string;
  durationMs: number;
  fetchedAt: string;
}

export interface SpecKitFetchPipelineInProgress {
  ok: false;
  inProgress: true;
  startedAt: string | null;
  error: string;
}

export interface SpecKitFetchPipelineFailure {
  ok: false;
  error: string;
  stack?: string;
  status?: SpecKitFetchStatus;
}

export type SpecKitFetchPipelineResult =
  | SpecKitFetchPipelineSuccess
  | SpecKitFetchPipelineInProgress
  | SpecKitFetchPipelineFailure;

export interface SpecKitEntityPreview {
  id: string;
  displayName: string;
  entityType: SpecKitEntityType;
  content: string;
  source: {
    releaseTag: string;
    commit: string;
    path: string;
    sourcePath?: string;
  };
}

export interface SpecKitEntityPreviewGroup {
  entityType: SpecKitEntityType;
  items: SpecKitEntityPreview[];
}

export interface SpecKitPreviewCollection {
  releaseTag: string;
  commit: string;
  fetchedAt: string | null;
  generatedAt: string;
  totalCount: number;
  groups: SpecKitEntityPreviewGroup[];
  warnings: string[];
  details?: unknown;
}

export interface SpecKitPreviewListSuccess {
  ok: true;
  data: SpecKitPreviewCollection;
}

export interface SpecKitPreviewListFailure {
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
}

export type SpecKitPreviewListResponse =
  | SpecKitPreviewListSuccess
  | SpecKitPreviewListFailure;

export interface SpecKitPipelineRun {
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  logPath?: string;
  error?: string;
  details?: unknown;
}

export interface SpecKitPipelineEntityResult {
  id: string;
  type: SpecKitEntityType;
  status: 'succeeded' | 'failed';
  errors: string[];
  path?: string;
  sourcePath?: string;
}

export interface SpecKitPipelineReport {
  batchId: string;
  entities: SpecKitPipelineEntityResult[];
  generatedFiles?: string[];
  sourcePreviews?: string[];
  pipelines: {
    validate: SpecKitPipelineRun;
    buildGraph: SpecKitPipelineRun;
    impact: SpecKitPipelineRun;
    generate: SpecKitPipelineRun;
  };
}

export interface SpecKitFetchLock {
  ownerPid: number;
  acquiredAt: string;
}
