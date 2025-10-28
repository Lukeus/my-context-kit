import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  SpecKitFetchSummary,
  SpecKitFetchPipelineInProgress,
  SpecKitFetchPipelineResult,
  SpecKitFetchPipelineSuccess,
  SpecKitPipelineReport,
} from '@shared/speckit';
import { speckitClient } from '@/services/speckitClient';

export interface SpecificationInfo {
  specNumber: string;
  branchName: string;
  specPath: string;
  description: string;
  createdAt: string;
}

export interface ImplementationPlan {
  planPath: string;
  specNumber: string;
  gates: {
    passed: boolean;
    warnings: string[];
    checks?: {
      simplicity?: { passed: boolean; issues: string[] };
      antiAbstraction?: { passed: boolean; issues: string[] };
      integrationFirst?: { passed: boolean; issues: string[] };
    };
  };
  createdAt: string;
}

export interface TaskInfo {
  id: string;
  description: string;
  parallel: boolean;
}

export interface TaskList {
  tasksPath: string;
  tasks: TaskInfo[];
  parallelGroups: Array<{ groupId: number; taskIds: string[] }>;
  specNumber: string;
  createdAt: string;
}

export interface WorkflowState {
  specification?: SpecificationInfo;
  plan?: ImplementationPlan;
  taskList?: TaskList;
  fetchSummary?: SpecKitFetchSummary;
  currentStep: 'specify' | 'plan' | 'tasks' | 'complete' | null;
}

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

const computeStaleFromTimestamp = (timestamp: string | null | undefined) => {
  if (!timestamp) {
    return true;
  }

  const fetchedAt = Date.parse(timestamp);
  if (Number.isNaN(fetchedAt)) {
    return true;
  }

  return Date.now() - fetchedAt > STALE_THRESHOLD_MS;
};

const isSuccessFetchResult = (result: SpecKitFetchPipelineResult): result is SpecKitFetchPipelineSuccess =>
  result.ok === true;

const isInProgressFetchResult = (result: SpecKitFetchPipelineResult): result is SpecKitFetchPipelineInProgress =>
  !result.ok && 'inProgress' in result && result.inProgress === true;

const toFetchSummary = (result: SpecKitFetchPipelineSuccess): SpecKitFetchSummary => {
  const staleFlag = typeof result.status?.stale === 'boolean'
    ? result.status.stale
    : computeStaleFromTimestamp(result.timing?.finishedAt ?? result.fetchedAt ?? null);

  const summary: SpecKitFetchSummary = {
    source: {
      repository: result.source.repository,
      releaseTag: result.source.releaseTag,
      commit: result.source.commit,
    },
    timing: {
      startedAt: result.timing?.startedAt ?? null,
      finishedAt: result.timing?.finishedAt ?? result.fetchedAt ?? null,
      durationMs: result.timing?.durationMs ?? result.durationMs ?? 0,
    },
    artifacts: {
      docs: [...(result.artifacts?.docs ?? [])],
      templates: [...(result.artifacts?.templates ?? [])],
      memory: [...(result.artifacts?.memory ?? [])],
    },
    status: {
      ok: result.status?.ok ?? result.ok,
      error: result.status?.error ?? null,
      stale: staleFlag,
    },
    warnings: result.warnings ?? [],
  };

  if (result.status?.inProgress) {
    summary.status.inProgress = result.status.inProgress;
  }

  return summary;
};

export const useSpeckitStore = defineStore('speckit', () => {
  const workflow = ref<WorkflowState>({
    currentStep: null,
  });

  const isCreatingSpec = ref(false);
  const isGeneratingPlan = ref(false);
  const isGeneratingTasks = ref(false);
  const isFetchingSpecKit = ref(false);
  const isGeneratingEntities = ref(false);
  const isRunningPipelines = ref(false);

  const specError = ref<string | null>(null);
  const planError = ref<string | null>(null);
  const tasksError = ref<string | null>(null);
  const fetchError = ref<string | null>(null);
  const pipelineError = ref<string | null>(null);
  const pipelineReport = ref<SpecKitPipelineReport | null>(null);

  const createSpecification = async (repoPath: string, description: string) => {
    isCreatingSpec.value = true;
    specError.value = null;

    try {
      const result = await window.api.speckit.specify(repoPath, description);

      if (!result.ok) {
        specError.value = result.error || 'Failed to create specification';
        return { ok: false, error: specError.value } as const;
      }

      if (!result.specNumber || !result.branchName || !result.specPath) {
        const message = 'Specification pipeline returned incomplete data';
        specError.value = message;
        return { ok: false, error: message } as const;
      }

      const specification: SpecificationInfo = {
        specNumber: result.specNumber,
        branchName: result.branchName,
        specPath: result.specPath,
        description,
        createdAt: new Date().toISOString(),
      };

      workflow.value.specification = specification;
      workflow.value.currentStep = 'specify';

      return { ok: true, specification } as const;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error creating specification';
      specError.value = message;
      return { ok: false, error: message } as const;
    } finally {
      isCreatingSpec.value = false;
    }
  };

  const generatePlan = async (repoPath: string, specPath: string, techStack?: string[]) => {
    isGeneratingPlan.value = true;
    planError.value = null;

    try {
      const result = await window.api.speckit.plan(repoPath, specPath, techStack);

      if (!result.ok) {
        planError.value = result.error || 'Failed to generate implementation plan';
        return { ok: false, error: planError.value } as const;
      }

      if (!result.planPath) {
        const message = 'Plan pipeline returned incomplete data';
        planError.value = message;
        return { ok: false, error: message } as const;
      }

      const plan: ImplementationPlan = {
        planPath: result.planPath,
        specNumber: workflow.value.specification?.specNumber || 'UNKNOWN',
        gates: result.gates || { passed: true, warnings: [] },
        createdAt: new Date().toISOString(),
      };

      workflow.value.plan = plan;
      workflow.value.currentStep = 'plan';

      return { ok: true, plan } as const;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error generating plan';
      planError.value = message;
      return { ok: false, error: message } as const;
    } finally {
      isGeneratingPlan.value = false;
    }
  };

  const generateTasks = async (repoPath: string, planPath: string) => {
    isGeneratingTasks.value = true;
    tasksError.value = null;

    try {
      const result = await window.api.speckit.tasks(repoPath, planPath);

      if (!result.ok) {
        tasksError.value = result.error || 'Failed to generate task list';
        return { ok: false, error: tasksError.value } as const;
      }

      if (!result.tasksPath) {
        const message = 'Tasks pipeline returned incomplete data';
        tasksError.value = message;
        return { ok: false, error: message } as const;
      }

      const taskList: TaskList = {
        tasksPath: result.tasksPath,
        tasks: result.tasks || [],
        parallelGroups: result.parallelGroups || [],
        specNumber: workflow.value.specification?.specNumber || 'UNKNOWN',
        createdAt: new Date().toISOString(),
      };

      workflow.value.taskList = taskList;
      workflow.value.currentStep = 'tasks';

      return { ok: true, taskList } as const;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error generating tasks';
      tasksError.value = message;
      return { ok: false, error: message } as const;
    } finally {
      isGeneratingTasks.value = false;
    }
  };

  const generateEntities = async (
    repoPath: string,
    specPath: string,
    sourcePreviewPaths: string[],
    options?: { createFeature?: boolean; createStories?: boolean },
  ) => {
    if (!repoPath) {
      return { ok: false, error: 'Context repository path is required to generate entities.' } as const;
    }

    if (!specPath) {
      return { ok: false, error: 'Specification path is required to generate entities.' } as const;
    }

    isGeneratingEntities.value = true;
    pipelineError.value = null;
    pipelineReport.value = null;

    try {
      const entityResult = await window.api.speckit.toEntity(repoPath, specPath, {
        createFeature: options?.createFeature ?? true,
        createStories: options?.createStories ?? true,
        sourcePreviewPaths,
      });

      if (!entityResult.ok) {
        const message = entityResult.error ?? 'Failed to generate entities from specification.';
        pipelineError.value = message;
        return { ok: false, error: message, entityResult } as const;
      }

      const createdPaths = Array.isArray(entityResult.created) ? entityResult.created : [];

      isRunningPipelines.value = true;

      try {
        const pipelineResponse = await speckitClient.runPipelines(repoPath, {
          createdPaths,
          sourcePreviewPaths,
        });

        if (pipelineResponse.ok && pipelineResponse.data) {
          pipelineReport.value = pipelineResponse.data;
          return { ok: true, entityResult, pipeline: pipelineResponse.data } as const;
        }

        const failureMessage = pipelineResponse.error ?? 'Spec Kit pipelines failed to complete.';
        pipelineError.value = failureMessage;
        return { ok: false, error: failureMessage, entityResult } as const;
      } finally {
        isRunningPipelines.value = false;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error generating entities.';
      pipelineError.value = message;
      return { ok: false, error: message } as const;
    } finally {
      isGeneratingEntities.value = false;
    }
  };

  const fetchSpecKit = async (repoPath: string, releaseTag?: string, forceRefresh?: boolean) => {
    isFetchingSpecKit.value = true;
    fetchError.value = null;

    try {
      const result = await speckitClient.fetch({ repoPath, releaseTag, forceRefresh });

      if (isInProgressFetchResult(result)) {
        const inProgressSummary: SpecKitFetchSummary = {
          source: {
            repository: 'github/spec-kit',
            releaseTag: null,
            commit: null,
          },
          timing: {
            startedAt: result.startedAt ?? null,
            finishedAt: null,
            durationMs: 0,
          },
          artifacts: {
            docs: [],
            templates: [],
            memory: [],
          },
          status: {
            ok: false,
            error: result.error ?? 'Fetch already in progress',
            inProgress: true,
            stale: true,
          },
          warnings: [],
        };

        workflow.value.fetchSummary = inProgressSummary;
        return { ok: false, error: result.error ?? 'Fetch already in progress', inProgress: true } as const;
      }

      if (!isSuccessFetchResult(result)) {
        const message = typeof result.error === 'string' && result.error.length > 0
          ? result.error
          : 'Failed to fetch Spec Kit cache';
        fetchError.value = message;
        return { ok: false, error: message } as const;
      }

      const summary = toFetchSummary(result);
      workflow.value.fetchSummary = summary;

      return { ok: true, summary } as const;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error fetching Spec Kit cache';
      fetchError.value = message;
      return { ok: false, error: message } as const;
    } finally {
      isFetchingSpecKit.value = false;
    }
  };

  const isCacheStale = computed(() => {
    const summary = workflow.value.fetchSummary;
    if (!summary) {
      return true;
    }

    if (typeof summary.status.stale === 'boolean') {
      return summary.status.stale;
    }

    return computeStaleFromTimestamp(summary.timing.finishedAt);
  });

  const completeWorkflow = () => {
    workflow.value.currentStep = 'complete';
  };

  const resetWorkflow = () => {
    const existingSummary = workflow.value.fetchSummary;

    workflow.value = {
      currentStep: null,
      fetchSummary: existingSummary,
    };

    specError.value = null;
    planError.value = null;
    tasksError.value = null;
    pipelineError.value = null;
    pipelineReport.value = null;
    isGeneratingEntities.value = false;
    isRunningPipelines.value = false;
  };

  const getGatesSummary = () => {
    if (!workflow.value.plan?.gates) {
      return null;
    }

    const gates = workflow.value.plan.gates;
    const totalIssues =
      (gates.checks?.simplicity?.issues.length || 0) +
      (gates.checks?.antiAbstraction?.issues.length || 0) +
      (gates.checks?.integrationFirst?.issues.length || 0);

    return {
      allPassed: gates.passed,
      totalIssues,
      warnings: gates.warnings.length,
      details: gates.checks,
    } as const;
  };

  return {
    workflow,
    isCreatingSpec,
    isGeneratingPlan,
    isGeneratingTasks,
    isFetchingSpecKit,
    isGeneratingEntities,
    isRunningPipelines,
    specError,
    planError,
    tasksError,
    fetchError,
    pipelineError,
    pipelineReport,
    isCacheStale,
    createSpecification,
    generatePlan,
    generateTasks,
    generateEntities,
    fetchSpecKit,
    completeWorkflow,
    resetWorkflow,
    getGatesSummary,
  };
});
