import { defineStore } from 'pinia';
import { ref } from 'vue';

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
  currentStep: 'specify' | 'plan' | 'tasks' | 'complete' | null;
}

export const useSpeckitStore = defineStore('speckit', () => {
  // Current workflow state
  const workflow = ref<WorkflowState>({
    currentStep: null,
  });

  // Loading states
  const isCreatingSpec = ref(false);
  const isGeneratingPlan = ref(false);
  const isGeneratingTasks = ref(false);

  // Error states
  const specError = ref<string | null>(null);
  const planError = ref<string | null>(null);
  const tasksError = ref<string | null>(null);

  /**
   * Step 1: Create a new specification
   */
  const createSpecification = async (repoPath: string, description: string) => {
    isCreatingSpec.value = true;
    specError.value = null;

    try {
      const result = await window.api.speckit.specify(repoPath, description);

      if (!result.ok) {
        specError.value = result.error || 'Failed to create specification';
        return { ok: false, error: specError.value };
      }

      workflow.value.specification = {
        specNumber: result.specNumber!,
        branchName: result.branchName!,
        specPath: result.specPath!,
        description,
        createdAt: new Date().toISOString(),
      };

      workflow.value.currentStep = 'specify';

      return { ok: true, specification: workflow.value.specification };
    } catch (error: any) {
      specError.value = error.message || 'Unknown error creating specification';
      return { ok: false, error: specError.value };
    } finally {
      isCreatingSpec.value = false;
    }
  };

  /**
   * Step 2: Generate implementation plan from specification
   */
  const generatePlan = async (repoPath: string, specPath: string, techStack?: string[]) => {
    isGeneratingPlan.value = true;
    planError.value = null;

    try {
      const result = await window.api.speckit.plan(repoPath, specPath, techStack);

      if (!result.ok) {
        planError.value = result.error || 'Failed to generate implementation plan';
        return { ok: false, error: planError.value };
      }

      workflow.value.plan = {
        planPath: result.planPath!,
        specNumber: workflow.value.specification?.specNumber || '???',
        gates: result.gates || { passed: true, warnings: [] },
        createdAt: new Date().toISOString(),
      };

      workflow.value.currentStep = 'plan';

      return { ok: true, plan: workflow.value.plan };
    } catch (error: any) {
      planError.value = error.message || 'Unknown error generating plan';
      return { ok: false, error: planError.value };
    } finally {
      isGeneratingPlan.value = false;
    }
  };

  /**
   * Step 3: Generate task list from implementation plan
   */
  const generateTasks = async (repoPath: string, planPath: string) => {
    isGeneratingTasks.value = true;
    tasksError.value = null;

    try {
      const result = await window.api.speckit.tasks(repoPath, planPath);

      if (!result.ok) {
        tasksError.value = result.error || 'Failed to generate task list';
        return { ok: false, error: tasksError.value };
      }

      workflow.value.taskList = {
        tasksPath: result.tasksPath!,
        tasks: result.tasks || [],
        parallelGroups: result.parallelGroups || [],
        specNumber: workflow.value.specification?.specNumber || '???',
        createdAt: new Date().toISOString(),
      };

      workflow.value.currentStep = 'tasks';

      return { ok: true, taskList: workflow.value.taskList };
    } catch (error: any) {
      tasksError.value = error.message || 'Unknown error generating tasks';
      return { ok: false, error: tasksError.value };
    } finally {
      isGeneratingTasks.value = false;
    }
  };

  /**
   * Complete the workflow and reset state
   */
  const completeWorkflow = () => {
    workflow.value.currentStep = 'complete';
  };

  /**
   * Reset the workflow to start a new one
   */
  const resetWorkflow = () => {
    workflow.value = {
      currentStep: null,
    };
    specError.value = null;
    planError.value = null;
    tasksError.value = null;
  };

  /**
   * Get constitutional gate status summary
   */
  const getGatesSummary = () => {
    if (!workflow.value.plan?.gates) {
      return null;
    }

    const gates = workflow.value.plan.gates;
    const allPassed = gates.passed;
    const totalIssues = 
      (gates.checks?.simplicity?.issues.length || 0) +
      (gates.checks?.antiAbstraction?.issues.length || 0) +
      (gates.checks?.integrationFirst?.issues.length || 0);

    return {
      allPassed,
      totalIssues,
      warnings: gates.warnings.length,
      details: gates.checks,
    };
  };

  return {
    // State
    workflow,
    isCreatingSpec,
    isGeneratingPlan,
    isGeneratingTasks,
    specError,
    planError,
    tasksError,

    // Actions
    createSpecification,
    generatePlan,
    generateTasks,
    completeWorkflow,
    resetWorkflow,
    getGatesSummary,
  };
});
