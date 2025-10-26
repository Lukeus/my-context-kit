<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSpeckitStore } from '@/stores/speckitStore';
import { useContextStore } from '@/stores/contextStore';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const speckitStore = useSpeckitStore();
const contextStore = useContextStore();

const description = ref('');
const techStack = ref(['TypeScript', 'Vue 3', 'Tailwind CSS']);
const generateEntities = ref(true);
const isGeneratingEntities = ref(false);
const entitiesGenerated = ref(false);
const entityGenerationError = ref<string | null>(null);
const useAI = ref(false);
const isGeneratingAISpec = ref(false);
const aiSpecData = ref<any | null>(null);
const aiError = ref<string | null>(null);
const showAIPreview = ref(false);

const currentStep = computed(() => speckitStore.workflow.currentStep);
const spec = computed(() => speckitStore.workflow.specification);
const plan = computed(() => speckitStore.workflow.plan);
const taskList = computed(() => speckitStore.workflow.taskList);

const gatesSummary = computed(() => speckitStore.getGatesSummary());

async function handleGenerateAISpec() {
  if (!description.value.trim()) {
    return;
  }

  isGeneratingAISpec.value = true;
  aiError.value = null;

  try {
    const result = await window.api.speckit.aiGenerateSpec(
      contextStore.repoPath || '',
      description.value
    );

    if (result.ok && result.spec) {
      aiSpecData.value = result.spec;
      showAIPreview.value = true;
    } else {
      aiError.value = result.error || 'Failed to generate spec with AI';
    }
  } catch (error: any) {
    aiError.value = error.message || 'Unknown error generating AI spec';
  } finally {
    isGeneratingAISpec.value = false;
  }
}

async function handleCreateSpec() {
  if (!description.value.trim()) {
    return;
  }

  const result = await speckitStore.createSpecification(
    contextStore.repoPath || '',
    description.value
  );

  if (result.ok) {
    // Success - spec created
  }
}

async function handleUseAISpec() {
  if (!aiSpecData.value) return;

  // Close preview
  showAIPreview.value = false;

  // Use the AI-generated spec data directly
  // The speckit pipeline will use the enhanced description
  const enhancedDescription = aiSpecData.value.title;

  const result = await speckitStore.createSpecification(
    contextStore.repoPath || '',
    enhancedDescription
  );

  if (result.ok) {
    // Store AI spec data for later use in spec generation
    // We could enhance the spec file with AI content here if needed
  }
}

async function handleGeneratePlan() {
  if (!spec.value) return;

  const result = await speckitStore.generatePlan(
    contextStore.repoPath || '',
    spec.value.specPath,
    techStack.value
  );

  if (result.ok) {
    // Success - plan generated
  }
}

async function handleGenerateTasks() {
  if (!plan.value) return;

  const result = await speckitStore.generateTasks(
    contextStore.repoPath || '',
    plan.value.planPath
  );

  if (result.ok) {
    // Success - tasks generated
  }
}

function handleClose() {
  speckitStore.resetWorkflow();
  emit('close');
}

async function handleGenerateEntities() {
  if (!spec.value) return;

  isGeneratingEntities.value = true;
  entityGenerationError.value = null;

  try {
    const result = await window.api.speckit.toEntity(
      contextStore.repoPath || '',
      spec.value.specPath,
      { createFeature: true, createStories: true }
    );

    if (result.ok) {
      entitiesGenerated.value = true;
    } else {
      entityGenerationError.value = result.error || 'Failed to generate entities';
    }
  } catch (error: any) {
    entityGenerationError.value = error.message || 'Unknown error generating entities';
  } finally {
    isGeneratingEntities.value = false;
  }
}

function handleComplete() {
  speckitStore.completeWorkflow();
  setTimeout(() => {
    handleClose();
  }, 2000);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style="background-color: rgba(0, 0, 0, 0.5)"
        @click.self="handleClose"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <div>
              <h2 class="text-xl font-semibold text-primary-700">Speckit Workflow</h2>
              <p class="text-xs text-secondary-600">Specification-Driven Development</p>
            </div>
            <button
              @click="handleClose"
              class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            <!-- Step 1: Specify -->
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <div 
                  :class="[
                    'w-8 h-8 rounded-m3-full flex items-center justify-center text-sm font-semibold',
                    currentStep === 'specify' || currentStep === 'plan' || currentStep === 'tasks' || currentStep === 'complete'
                      ? 'bg-primary text-white'
                      : 'bg-surface-3 text-secondary-600'
                  ]"
                >
                  1
                </div>
                <h3 class="text-lg font-semibold text-secondary-900">Create Specification</h3>
              </div>

              <div v-if="!spec" class="ml-10 space-y-3">
                <textarea
                  v-model="description"
                  placeholder="Describe your feature (e.g., 'Real-time chat system with message history')"
                  class="w-full px-4 py-3 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-1"
                  rows="3"
                  :disabled="speckitStore.isCreatingSpec || isGeneratingAISpec"
                />

                <!-- AI Assistance Toggle -->
                <div class="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-m3-md">
                  <input
                    id="useAI"
                    v-model="useAI"
                    type="checkbox"
                    class="w-4 h-4 text-primary border-surface-variant rounded focus:ring-2 focus:ring-primary"
                  />
                  <label for="useAI" class="text-sm text-secondary-900 cursor-pointer flex-1">
                    <span class="font-semibold">✨ AI-Assisted Spec Generation</span>
                    <p class="text-xs text-secondary-600 mt-0.5">
                      Let AI help create a comprehensive specification with user stories, acceptance criteria, and constitutional checks
                    </p>
                  </label>
                </div>

                <!-- AI Generate Button (if AI enabled) -->
                <div v-if="useAI" class="flex gap-2">
                  <button
                    @click="handleGenerateAISpec"
                    :disabled="!description.trim() || isGeneratingAISpec"
                    class="px-4 py-2 text-sm bg-purple-600 text-white rounded-m3-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span v-if="isGeneratingAISpec">🤖 Generating...</span>
                    <span v-else>✨ Generate with AI</span>
                  </button>
                  
                  <button
                    v-if="!isGeneratingAISpec"
                    @click="handleCreateSpec"
                    :disabled="!description.trim() || speckitStore.isCreatingSpec"
                    class="px-4 py-2 text-sm bg-surface-3 text-secondary-900 border border-surface-variant rounded-m3-lg hover:bg-surface-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ speckitStore.isCreatingSpec ? 'Creating...' : 'Create Manually' }}
                  </button>
                </div>

                <!-- Manual Create Button (if AI not enabled) -->
                <button
                  v-if="!useAI"
                  @click="handleCreateSpec"
                  :disabled="!description.trim() || speckitStore.isCreatingSpec"
                  class="px-4 py-2 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ speckitStore.isCreatingSpec ? 'Creating...' : 'Create Spec' }}
                </button>

                <p v-if="aiError" class="text-sm text-error-600">
                  {{ aiError }}
                </p>

                <p v-if="speckitStore.specError" class="text-sm text-error-600">
                  {{ speckitStore.specError }}
                </p>
              </div>

              <div v-else class="ml-10 p-4 bg-green-50 border border-green-200 rounded-m3-md">
                <div class="text-sm space-y-1">
                  <div><strong>Spec Number:</strong> {{ spec.specNumber }}</div>
                  <div><strong>Branch:</strong> {{ spec.branchName }}</div>
                  <div><strong>Path:</strong> <code class="text-xs bg-green-100 px-2 py-0.5 rounded">{{ spec.specPath }}</code></div>
                </div>
              </div>
            </div>

            <!-- Step 2: Plan -->
            <div v-if="spec" class="space-y-3">
              <div class="flex items-center gap-2">
                <div 
                  :class="[
                    'w-8 h-8 rounded-m3-full flex items-center justify-center text-sm font-semibold',
                    currentStep === 'plan' || currentStep === 'tasks' || currentStep === 'complete'
                      ? 'bg-primary text-white'
                      : 'bg-surface-3 text-secondary-600'
                  ]"
                >
                  2
                </div>
                <h3 class="text-lg font-semibold text-secondary-900">Generate Implementation Plan</h3>
              </div>

              <div v-if="!plan" class="ml-10 space-y-3">
                <div class="space-y-2">
                  <label class="block text-xs text-secondary-600">Tech Stack (optional)</label>
                  <input
                    v-model="techStack[0]"
                    type="text"
                    placeholder="TypeScript"
                    class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-1"
                    :disabled="speckitStore.isGeneratingPlan"
                  />
                </div>

                <button
                  @click="handleGeneratePlan"
                  :disabled="speckitStore.isGeneratingPlan"
                  class="px-4 py-2 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ speckitStore.isGeneratingPlan ? 'Generating...' : 'Generate Plan' }}
                </button>

                <p v-if="speckitStore.planError" class="text-sm text-error-600">
                  {{ speckitStore.planError }}
                </p>
              </div>

              <div v-else class="ml-10 p-4 bg-blue-50 border border-blue-200 rounded-m3-md">
                <div class="text-sm space-y-2">
                  <div><strong>Plan:</strong> <code class="text-xs bg-blue-100 px-2 py-0.5 rounded">{{ plan.planPath }}</code></div>
                  
                  <!-- Constitutional Gates -->
                  <div v-if="gatesSummary" class="pt-2 border-t border-blue-200">
                    <div class="font-semibold mb-1">Constitutional Gates:</div>
                    <div :class="gatesSummary.allPassed ? 'text-green-700' : 'text-error-600'">
                      {{ gatesSummary.allPassed ? '✓ All gates passed' : `✗ ${gatesSummary.totalIssues} issues found` }}
                    </div>
                    <div v-if="gatesSummary.warnings > 0" class="text-yellow-700 text-xs">
                      ⚠ {{ gatesSummary.warnings }} warning(s)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Tasks -->
            <div v-if="plan" class="space-y-3">
              <div class="flex items-center gap-2">
                <div 
                  :class="[
                    'w-8 h-8 rounded-m3-full flex items-center justify-center text-sm font-semibold',
                    currentStep === 'tasks' || currentStep === 'complete'
                      ? 'bg-primary text-white'
                      : 'bg-surface-3 text-secondary-600'
                  ]"
                >
                  3
                </div>
                <h3 class="text-lg font-semibold text-secondary-900">Generate Task List</h3>
              </div>

              <div v-if="!taskList" class="ml-10 space-y-3">
                <button
                  @click="handleGenerateTasks"
                  :disabled="speckitStore.isGeneratingTasks"
                  class="px-4 py-2 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ speckitStore.isGeneratingTasks ? 'Generating...' : 'Generate Tasks' }}
                </button>

                <p v-if="speckitStore.tasksError" class="text-sm text-error-600">
                  {{ speckitStore.tasksError }}
                </p>
              </div>

              <div v-else class="ml-10 p-4 bg-purple-50 border border-purple-200 rounded-m3-md">
                <div class="text-sm space-y-2">
                  <div><strong>Tasks:</strong> <code class="text-xs bg-purple-100 px-2 py-0.5 rounded">{{ taskList.tasksPath }}</code></div>
                  <div><strong>Count:</strong> {{ taskList.tasks.length }} tasks</div>
                  <div><strong>Parallel Groups:</strong> {{ taskList.parallelGroups.length }}</div>
                </div>
              </div>
            </div>

            <!-- Complete -->
            <div v-if="taskList && currentStep === 'tasks'" class="ml-10 pt-4 space-y-4">
              <!-- Entity Generation Option -->
              <div class="p-4 bg-surface-1 border border-surface-variant rounded-m3-md">
                <div class="flex items-start gap-3">
                  <input
                    id="generateEntities"
                    v-model="generateEntities"
                    type="checkbox"
                    class="mt-1 w-4 h-4 text-primary border-surface-variant rounded focus:ring-2 focus:ring-primary"
                  />
                  <div class="flex-1">
                    <label for="generateEntities" class="text-sm font-semibold text-secondary-900 cursor-pointer">
                      Generate YAML Entities
                    </label>
                    <p class="text-xs text-secondary-600 mt-1">
                      Create Feature and UserStory entities in contexts/ from this specification
                    </p>
                  </div>
                </div>

                <div v-if="generateEntities && !entitiesGenerated" class="mt-3">
                  <button
                    @click="handleGenerateEntities"
                    :disabled="isGeneratingEntities"
                    class="px-4 py-2 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ isGeneratingEntities ? 'Generating Entities...' : 'Generate Entities' }}
                  </button>

                  <p v-if="entityGenerationError" class="text-sm text-error-600 mt-2">
                    {{ entityGenerationError }}
                  </p>
                </div>

                <div v-if="entitiesGenerated" class="mt-3 p-3 bg-green-50 border border-green-200 rounded-m3-md">
                  <div class="text-sm text-green-800">
                    <strong>✓ Entities Generated</strong>
                    <p class="text-xs mt-1">Feature and UserStory entities created in contexts/</p>
                  </div>
                </div>
              </div>

              <button
                @click="handleComplete"
                :disabled="generateEntities && !entitiesGenerated"
                class="px-6 py-3 text-sm bg-green-600 text-white rounded-m3-lg hover:bg-green-700 shadow-elevation-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✓ Complete Workflow
              </button>
            </div>

            <!-- Success Message -->
            <div v-if="currentStep === 'complete'" class="p-6 bg-green-100 border-2 border-green-500 rounded-m3-lg text-center">
              <div class="text-2xl mb-2">🎉</div>
              <div class="text-lg font-semibold text-green-900">Workflow Complete!</div>
              <div class="text-sm text-green-700 mt-2">
                Your specification, implementation plan, and task list have been created.
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-surface-2 border-t border-surface-variant flex justify-between items-center">
            <div class="text-xs text-secondary-600">
              Step {{ currentStep === 'specify' ? 1 : currentStep === 'plan' ? 2 : currentStep === 'tasks' || currentStep === 'complete' ? 3 : 1 }} of 3
            </div>
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm border border-surface-variant rounded-m3-md hover:bg-surface-3 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- AI Spec Preview Modal -->
    <Transition name="modal">
      <div
        v-if="showAIPreview && aiSpecData"
        class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="showAIPreview = false"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[800px] max-h-[85vh] flex flex-col overflow-hidden border border-surface-variant">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-surface-variant bg-surface-2">
            <div>
              <h2 class="text-xl font-semibold text-secondary-900">✨ AI-Generated Specification</h2>
              <p class="text-sm text-secondary-600 mt-1">Review and use this spec or regenerate</p>
            </div>
            <button
              @click="showAIPreview = false"
              class="p-2 hover:bg-surface-3 rounded-m3-full transition-colors text-secondary-600 hover:text-secondary-900"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <!-- Title -->
            <div>
              <label class="block text-xs font-semibold text-secondary-600 mb-1">Title</label>
              <div class="text-lg font-semibold text-secondary-900">{{ aiSpecData.title }}</div>
            </div>

            <!-- Overview -->
            <div v-if="aiSpecData.overview">
              <label class="block text-xs font-semibold text-secondary-600 mb-1">Overview</label>
              <div class="text-sm text-secondary-800">{{ aiSpecData.overview }}</div>
            </div>

            <!-- User Stories -->
            <div v-if="aiSpecData.userStories && aiSpecData.userStories.length > 0">
              <label class="block text-xs font-semibold text-secondary-600 mb-2">User Stories</label>
              <div class="space-y-2">
                <div
                  v-for="(story, idx) in aiSpecData.userStories"
                  :key="idx"
                  class="p-3 bg-blue-50 border border-blue-200 rounded-m3-md text-sm"
                >
                  <strong>As a {{ story.asA }}</strong>, I want <strong>{{ story.iWant }}</strong>, so that <strong>{{ story.soThat }}</strong>
                </div>
              </div>
            </div>

            <!-- Acceptance Criteria -->
            <div v-if="aiSpecData.acceptanceCriteria && aiSpecData.acceptanceCriteria.length > 0">
              <label class="block text-xs font-semibold text-secondary-600 mb-2">Acceptance Criteria</label>
              <ul class="list-disc list-inside space-y-1 text-sm text-secondary-800">
                <li v-for="(criterion, idx) in aiSpecData.acceptanceCriteria" :key="idx">{{ criterion }}</li>
              </ul>
            </div>

            <!-- Constitutional Considerations -->
            <div v-if="aiSpecData.constitutionalConsiderations" class="p-4 bg-yellow-50 border border-yellow-200 rounded-m3-md">
              <label class="block text-xs font-semibold text-yellow-900 mb-2">🏛️ Constitutional Considerations</label>
              <div class="space-y-1 text-sm text-yellow-800">
                <div><strong>Simplicity:</strong> {{ aiSpecData.constitutionalConsiderations.simplicity }}</div>
                <div><strong>Anti-Abstraction:</strong> {{ aiSpecData.constitutionalConsiderations.antiAbstraction }}</div>
                <div><strong>Integration-First:</strong> {{ aiSpecData.constitutionalConsiderations.integrationFirst }}</div>
              </div>
            </div>

            <!-- Clarification Questions -->
            <div v-if="aiSpecData.clarificationQuestions && aiSpecData.clarificationQuestions.length > 0" class="p-4 bg-orange-50 border border-orange-200 rounded-m3-md">
              <label class="block text-xs font-semibold text-orange-900 mb-2">❓ Questions for Clarification</label>
              <ul class="list-disc list-inside space-y-1 text-sm text-orange-800">
                <li v-for="(question, idx) in aiSpecData.clarificationQuestions" :key="idx">{{ question }}</li>
              </ul>
            </div>

            <!-- Constraints -->
            <div v-if="aiSpecData.constraints && aiSpecData.constraints.length > 0">
              <label class="block text-xs font-semibold text-secondary-600 mb-2">Constraints & Assumptions</label>
              <ul class="list-disc list-inside space-y-1 text-sm text-secondary-800">
                <li v-for="(constraint, idx) in aiSpecData.constraints" :key="idx">{{ constraint }}</li>
              </ul>
            </div>

            <!-- Out of Scope -->
            <div v-if="aiSpecData.outOfScope && aiSpecData.outOfScope.length > 0">
              <label class="block text-xs font-semibold text-secondary-600 mb-2">Out of Scope</label>
              <ul class="list-disc list-inside space-y-1 text-sm text-secondary-800">
                <li v-for="(item, idx) in aiSpecData.outOfScope" :key="idx">{{ item }}</li>
              </ul>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="px-6 py-5 bg-surface-2 border-t border-surface-variant flex justify-between items-center">
            <button
              @click="handleGenerateAISpec"
              :disabled="isGeneratingAISpec"
              class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:bg-surface-3 rounded-m3-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="isGeneratingAISpec">♻️ Regenerating...</span>
              <span v-else>♻️ Regenerate</span>
            </button>

            <div class="flex gap-3">
              <button
                @click="showAIPreview = false"
                class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:bg-surface-3 rounded-m3-lg transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleUseAISpec"
                class="px-5 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 transition-all shadow-elevation-2 hover:shadow-elevation-3"
              >
                ✓ Use This Spec
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .bg-surface,
.modal-leave-active .bg-surface {
  transition: transform 0.3s ease;
}

.modal-enter-from .bg-surface {
  transform: scale(0.9);
}

.modal-leave-to .bg-surface {
  transform: scale(0.9);
}
</style>
