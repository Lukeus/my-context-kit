<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, defineAsyncComponent } from 'vue';
// Core components (always needed)
import LeftPanelContainer from './components/LeftPanelContainer.vue';
import DeveloperHub from './components/DeveloperHub.vue';
import Snackbar from './components/Snackbar.vue';
// Stores and composables
import { useContextStore } from './stores/contextStore';
import { useBuilderStore } from './stores/builderStore';
import { useAIStore } from './stores/aiStore';
import { useGitStore } from './stores/gitStore';
import { useSnackbar } from './composables/useSnackbar';
import { useRouting } from './composables/useRouting';

// Lazy-loaded modals (Phase 1.1 - only loaded when opened)
const GraphView = defineAsyncComponent(() => import('./components/GraphView.vue'));
const GitPanel = defineAsyncComponent(() => import('./components/GitPanel.vue'));
const NewRepoModal = defineAsyncComponent(() => import('./components/NewRepoModal.vue'));
const AISettingsModal = defineAsyncComponent(() => import('./components/AISettingsModal.vue'));
const SpeckitWizard = defineAsyncComponent(() => import('./components/SpeckitWizard.vue'));
const CommandPalette = defineAsyncComponent(() => import('./components/CommandPalette.vue'));
const ContextBuilderModal = defineAsyncComponent(() => import('./components/ContextBuilderModal.vue'));

// Lazy-loaded tab components (Phase 1.2 - only loaded when tab is active)
const YamlEditor = defineAsyncComponent(() => import('./components/YamlEditor.vue'));
const EntityPreview = defineAsyncComponent(() => import('./components/EntityPreview.vue'));
const EntityDiff = defineAsyncComponent(() => import('./components/EntityDiff.vue'));
const EntityDependencyGraph = defineAsyncComponent(() => import('./components/EntityDependencyGraph.vue'));
const PromptPanel = defineAsyncComponent(() => import('./components/PromptPanel.vue'));
const ImpactReportPanel = defineAsyncComponent(() => import('./components/ImpactReportPanel.vue'));

// Lazy-loaded documentation (Phase 1.4 - rarely used)
const WelcomeDocumentation = defineAsyncComponent(() => import('./components/WelcomeDocumentation.vue'));

// Lazy-loaded C4 diagram components (Phase 1.3 - biggest win, 2.5MB from Mermaid)
const C4DiagramRenderer = defineAsyncComponent(() => import('./components/C4DiagramRenderer.vue'));
const C4DiagramBuilder = defineAsyncComponent(() => import('./components/C4DiagramBuilder.vue'));

// AI Assistant - keep eager loaded as it's frequently used
import AIAssistantPanel from './components/AIAssistantPanel.vue';

const contextStore = useContextStore();
const builderStore = useBuilderStore();
const gitStore = useGitStore();
const {
  show: snackbarVisible,
  message: snackbarMessage,
  type: snackbarType,
  action: snackbarAction,
  hide: hideSnackbar,
  handleAction: handleSnackbarAction,
  showSnackbar: triggerSnackbar
} = useSnackbar();

// Router integration (enterprise routing)
const { 
  navigateTo: routerNavigateTo, 
  currentRouteName, 
  currentParams,
  isRouteActive,
  breadcrumbs: routerBreadcrumbs 
} = useRouting();

const showGraphModal = ref(false);
const showAISettings = ref(false);
const showRepoManager = ref(false);
const showNewRepoModal = ref(false);
const showSpeckitWizard = ref(false);
const newRepoLabel = ref('');
const newRepoPath = ref('');
const repoFormError = ref('');
const isSavingRepo = ref(false);
const repoActionMessage = ref('');
const removingRepoId = ref<string | null>(null);
const repoSelection = ref('');

// Command palette visibility
const showCommandPalette = ref(false);


const showDocsCenter = ref(false);

const lastValidationAt = ref<string | null>(null);
const lastValidationStatus = ref<'success' | 'error' | null>(null);
const lastGraphRefresh = ref<string | null>(null);

type NavId = 'hub' | 'entities' | 'graph' | 'git' | 'validate' | 'docs' | 'ai' | 'c4' | 'entity';
type NavRailId = Exclude<NavId, 'entity'>;

const activeNavId = ref<NavId>('hub');

const navRailItems: Array<{ id: NavRailId; label: string; requiresRepo?: boolean; shortcut?: string }> = [
  { id: 'hub', label: 'Hub', shortcut: 'Home' },
  { id: 'entities', label: 'Tree', shortcut: 'Toggle' },
  { id: 'c4', label: 'C4', shortcut: 'Architecture' },
  { id: 'graph', label: 'Graph', requiresRepo: true, shortcut: 'View' },
  { id: 'git', label: 'Git', requiresRepo: true, shortcut: 'Status' },
  { id: 'validate', label: 'Validate', requiresRepo: true, shortcut: 'Run' },
  { id: 'docs', label: 'Docs', shortcut: 'Docs' },
  { id: 'ai', label: 'Assistant', shortcut: 'Ctrl+Shift+A' },
];

// Panel state
const leftPanelOpen = ref(false); // Start with left panel closed (hub view)
const rightPanelOpen = ref(true);
const leftPanelWidth = ref(256); // 64 * 4 = 256px (w-64)
const rightPanelWidth = ref(380);

const isResizingLeft = ref(false);
const isResizingRight = ref(false);

const activeEntity = computed(() => contextStore.activeEntity);
const repoOptions = computed(() => contextStore.repoOptions);
const isRepoConfigured = computed(() => Boolean(contextStore.repoPath?.trim().length));
const repoStatusHint = computed(() => {
  if (isRepoConfigured.value) {
    return '';
  }
  return 'Select or add a context repository to unlock validation, impact analysis, and Git features.';
});

const activeRepoMeta = computed(() => contextStore.getActiveRepoMeta());
const repoSummaryLine = computed(() => {
  if (activeRepoMeta.value) {
    return activeRepoMeta.value.path;
  }
  return 'No repository configured';
});
const repoLastUsedDisplay = computed(() => {
  if (!activeRepoMeta.value) {
    return '';
  }
  try {
    return new Date(activeRepoMeta.value.lastUsed).toLocaleString();
  } catch {
    return activeRepoMeta.value.lastUsed;
  }
});
const totalEntities = computed(() => contextStore.entityCount);

const totalChanges = computed(() => {
  if (!gitStore.status) return 0;
  const s = gitStore.status;
  return (
    s.modified.length + 
    s.created.length + 
    s.deleted.length + 
    s.renamed.length + 
    (s.not_added?.length || 0)
  );
});
const typeLabelMap: Record<string, string> = {
  governance: 'Governance',
  feature: 'Feature',
  userstory: 'User Story',
  spec: 'Specification',
  task: 'Task',
  service: 'Service',
  package: 'Package'
};
const activeEntitySummary = computed(() => {
  const entity = activeEntity.value;
  if (!entity) {
    return 'Welcome documentation';
  }
  const typeLabel = typeLabelMap[entity._type] || (entity._type ? entity._type.charAt(0).toUpperCase() + entity._type.slice(1) : 'Entity');
  const id = entity.id || 'Untitled';
  return `${typeLabel} • ${id}`;
});

const activeEntityDescription = computed(() => {
  const entity = activeEntity.value;
  if (!entity) {
    return 'Select an item from the context tree to inspect its YAML definition.';
  }
  return entity.title || entity.name || 'No additional details available.';
});

// Panel is always AI Assistant now

// Center tabs state
const centerTab = ref<'yaml' | 'preview' | 'diff' | 'graph' | 'impact' | 'prompt'>('yaml');
function setCenterTab(tab: 'yaml' | 'preview' | 'diff' | 'graph' | 'impact' | 'prompt') { centerTab.value = tab; }

// Router watchers - placed after computed properties to ensure proper initialization
// Sync entity route params with active entity
watch(currentParams, (params) => {
  if (currentRouteName.value === 'entity' && params.id) {
    contextStore.setActiveEntity(params.id as string);
  }
});

// Sync active entity with route
watch(() => activeEntity.value, (entity) => {
  if (entity && currentRouteName.value !== 'entity') {
    routerNavigateTo('entity', { id: entity.id });
  }
});

// Panel resize handlers
function startResizeLeft() {
  isResizingLeft.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function startResizeRight() {
  isResizingRight.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

async function handleNavClick(id: NavRailId) {
  // Sync with Vue Router for enterprise routing
  const routeMap: Record<string, string> = {
    'hub': 'hub',
    'c4': 'c4',
    'docs': 'docs',
    'entities': 'entities'
  };
  
  if (routeMap[id]) {
    await routerNavigateTo(routeMap[id]);
  }
  
  switch (id) {
    case 'hub':
      openWorkspace();
      activeNavId.value = 'hub';
      leftPanelOpen.value = false; // Hide left panel on hub
      break;
    case 'entities':
      activeNavId.value = 'entities';
      leftPanelOpen.value = true; // Show left panel for entities
      // If no entity is selected, select the first one
      if (!contextStore.activeEntity && contextStore.entityCount > 0) {
        const allEntities = Object.values(contextStore.entitiesByType).flat();
        if (allEntities.length > 0) {
          contextStore.setActiveEntity(allEntities[0].id);
        }
      }
      break;
    case 'c4':
      openC4Builder();
      leftPanelOpen.value = true; // Show left panel for C4
      break;
    case 'graph':
      await openGraphModal();
      break;
    case 'git':
      await openGitPanel();
      break;
    case 'validate':
      await runValidation();
      break;
    case 'docs':
      openDocs();
      activeNavId.value = 'docs';
      leftPanelOpen.value = false; // Hide left panel on docs
      break;
    case 'ai':
      openAssistantPanel();
      break;
    default:
      break;
  }
}

function isNavActive(id: NavRailId) {
  switch (id) {
    case 'hub':
      return activeNavId.value === 'hub';
    case 'entities':
      return activeNavId.value === 'entities';
    case 'c4':
      return activeNavId.value === 'c4';
    case 'graph':
      return showGraphModal.value;
    case 'git':
      return activeNavId.value === 'git';
    case 'docs':
      return activeNavId.value === 'docs';
    case 'ai':
      return rightPanelOpen.value;
    case 'validate':
    default:
      return false;
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isResizingLeft.value) {
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 500) {
      leftPanelWidth.value = newWidth;
    }
  } else if (isResizingRight.value) {
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 280 && newWidth <= 600) {
      rightPanelWidth.value = newWidth;
    }
  }
}

watch(
  () => contextStore.activeRepoId,
  (newId) => {
    repoSelection.value = newId ?? '';
  },
  { immediate: true }
);

watch(
  () => contextStore.repoPath,
  async (path, previousPath) => {
    repoActionMessage.value = '';
    if (path && path !== previousPath) {
      lastValidationAt.value = null;
      lastValidationStatus.value = null;
      await gitStore.loadStatus();
      await gitStore.loadBranches();
    }
    if (!path) {
      lastGraphRefresh.value = null;
    }
  }
);

watch(
  () => contextStore.graph,
  (graph) => {
    if (graph) {
      lastGraphRefresh.value = new Date().toISOString();
    }
  }
);

watch(showRepoManager, async (isOpen) => {
  if (isOpen) {
    await contextStore.refreshRepoRegistry();
  }
});

watch(activeEntity, (entity) => {
  if (entity) {
    activeNavId.value = 'entities';
    leftPanelOpen.value = true; // Open left panel when entity selected
  } else {
    // Preserve current view if it's C4, docs, or hub
    if (!['c4', 'docs', 'hub'].includes(activeNavId.value)) {
      activeNavId.value = 'hub';
      leftPanelOpen.value = false;
    }
  }
});

function stopResize() {
  isResizingLeft.value = false;
  isResizingRight.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

// Keyboard shortcuts
function handleKeyboard(e: KeyboardEvent) {
  // Ctrl+N or Cmd+N to create new entity
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    contextStore.initializeStore().then(() => {
      builderStore.initBuilder('feature', {}, contextStore.repoPath);
    });
    return;
  }

  // Ctrl+K Command Palette
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    showCommandPalette.value = !showCommandPalette.value;
    return;
  }
  
  // Ctrl+I to open Impact tab
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault();
    if (contextStore.activeEntity) {
      setCenterTab('impact');
    }
    return;
  }
  
  // Ctrl+Shift+A to toggle AI Assistant panel
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    rightPanelOpen.value = !rightPanelOpen.value;
    return;
  }
  
  // Escape to close modals/palette
  if (e.key === 'Escape') {
    if (showCommandPalette.value) {
      showCommandPalette.value = false;
      return;
    }
    if (showGraphModal.value) {
      showGraphModal.value = false;
    } else if (showRepoManager.value) {
      showRepoManager.value = false;
    } else if (showAISettings.value) {
      showAISettings.value = false;
    }
  }
}

onMounted(async () => {
  // Initialize router service with routes
  const { routes } = await import('./config/routes');
  const router = await import('./composables/useRouting').then(m => m.getRouterService());
  router.registerAll(routes);
  
  // Initialize context store on app mount
  await contextStore.initializeStore();
  await contextStore.refreshRepoRegistry();
  
  // Load repo data if configured
  if (contextStore.repoPath) {
    const graphLoaded = await contextStore.loadGraph();
    if (graphLoaded) {
      lastGraphRefresh.value = new Date().toISOString();
    }
    await gitStore.loadStatus();
    await gitStore.loadBranches();
  }
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('keydown', handleKeyboard);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', stopResize);
  window.removeEventListener('keydown', handleKeyboard);
});

const runValidation = async () => {
  if (!isRepoConfigured.value) {
    triggerSnackbar({ message: 'Connect a context repository to run validation.', type: 'warning' });
    return;
  }
  const result = await contextStore.validateRepo();
  lastValidationAt.value = new Date().toISOString();
  lastValidationStatus.value = result.ok ? 'success' : 'error';

  if (result.ok) {
    triggerSnackbar({ message: 'Validation passed', type: 'success' });
  } else {
    triggerSnackbar({ message: result.error || 'Validation failed', type: 'error' });
  }
  await gitStore.loadStatus();
};

const reloadGraph = async (options?: { silent?: boolean }) => {
  if (!isRepoConfigured.value) {
    triggerSnackbar({ message: 'Connect a context repository to refresh the graph.', type: 'warning' });
    return;
  }
  const isSuccess = await contextStore.loadGraph();
  if (isSuccess) {
    lastGraphRefresh.value = new Date().toISOString();
    if (!options?.silent) {
      triggerSnackbar({ message: 'Graph refreshed', type: 'success' });
    }
  } else {
    const errorDetail = typeof contextStore.error === 'string' ? contextStore.error : 'Failed to refresh graph';
    triggerSnackbar({ message: errorDetail, type: 'error' });
  }
};

async function openGraphModal() {
  if (!isRepoConfigured.value) {
    triggerSnackbar({ message: 'Connect a context repository to view the graph.', type: 'warning' });
    return;
  }
  await reloadGraph({ silent: true });
  showGraphModal.value = true;
  activeNavId.value = 'graph';
}

async function openGitPanel() {
  if (!isRepoConfigured.value) {
    triggerSnackbar({ message: 'Connect a context repository to use Git workflows.', type: 'warning' });
    return;
  }
  await gitStore.loadStatus();
  await gitStore.loadBranches();
  contextStore.setActiveEntity(null);
  activeNavId.value = 'git';
}

function openDocs() {
  contextStore.setActiveEntity(null);
  activeNavId.value = 'docs';
  leftPanelOpen.value = false; // Close left panel on docs
}

function openWorkspace() {
  contextStore.setActiveEntity(null);
  activeNavId.value = 'hub';
  leftPanelOpen.value = false; // Close left panel when going to hub
}

function openC4Builder() {
  contextStore.setActiveEntity(null);
  activeNavId.value = 'c4';
  leftPanelOpen.value = true; // Open left panel for C4 diagrams
}


function openNewRepoModal() {
  showNewRepoModal.value = true;
}

function toggleRightPanel() {
  rightPanelOpen.value = !rightPanelOpen.value;
  if (rightPanelOpen.value) {
    activeNavId.value = 'ai';
  } else if (activeEntity.value) {
    activeNavId.value = 'entities';
  } else if (!['c4', 'docs', 'hub'].includes(activeNavId.value)) {
    activeNavId.value = 'hub';
  }
}

function openAssistantPanel() {
  rightPanelOpen.value = true;
  activeNavId.value = 'ai';
}

const aiStore = useAIStore();

async function handleAskAboutEntity(entityId: string) {
  openAssistantPanel();
  await aiStore.initialize();
  const entity = contextStore.getEntity(entityId);
  const prompt = entity ? `Give a concise brief on ${entityId} (type: ${entity._type}). Highlight risks, dependencies, and next steps.` : `Give a concise brief on ${entityId}.`;
  await aiStore.ask(prompt, { mode: 'general', focusId: entityId });
}

async function handleCommandExecute(commandId: string) {
  // Handle navigation commands from router
  if (commandId.startsWith('nav:')) {
    const routeId = commandId.substring(4); // Remove 'nav:' prefix
    await handleRouteNavigation(routeId);
    showCommandPalette.value = false;
    return;
  }
  
  // Handle action commands
  switch (commandId) {
    case 'speckit:workflow':
      showSpeckitWizard.value = true;
      break;
    case 'assistant:open':
      openAssistantPanel();
      break;
    case 'impact:analyze':
      openImpactView();
      break;
    case 'create:feature':
      openBuilderModal('feature');
      break;
    case 'create:userstory':
      openBuilderModal('userstory');
      break;
    case 'create:spec':
      openBuilderModal('spec');
      break;
    case 'create:task':
      openBuilderModal('task');
      break;
    default:
      break;
  }
  showCommandPalette.value = false;
}

// Handle route-based navigation from commands or nav rail
async function handleRouteNavigation(routeId: string) {
  const result = await routerNavigateTo(routeId as any);
  
  if (!result.success) {
    triggerSnackbar({ 
      message: result.error || `Cannot navigate to ${routeId}`, 
      type: 'warning' 
    });
    return;
  }
  
  // Sync UI state with route
  switch (routeId) {
    case 'hub':
      openWorkspace();
      break;
    case 'entities':
      leftPanelOpen.value = true;
      activeNavId.value = 'entities';
      break;
    case 'c4':
      openC4Builder();
      break;
    case 'graph':
      await openGraphModal();
      break;
    case 'git':
      await openGitPanel();
      break;
    case 'docs':
      openDocs();
      break;
    case 'ai':
      openAssistantPanel();
      break;
    case 'validate':
      await runValidation();
      activeNavId.value = 'hub'; // Return to hub after validation
      break;
    default:
      // Generic fallback
      activeNavId.value = routeId as NavId;
  }
}

function openImpactView() {
  if (contextStore.activeEntity) {
    setCenterTab('impact');
    return;
  }
  triggerSnackbar({ message: 'Select an entity to review impact insights.', type: 'info' });
}

async function handleOpenDiff() {
  if (contextStore.activeEntity) {
    setCenterTab('diff');
  } else if (isRepoConfigured.value) {
    await openGitPanel();
  } else {
    triggerSnackbar({ message: 'Configure a repository to inspect diffs.', type: 'warning' });
  }
}

function handleOpenPrompts() {
  if (contextStore.activeEntity) {
    setCenterTab('prompt');
  } else {
    triggerSnackbar({ message: 'Select an entity to generate prompts.', type: 'info' });
  }
}

function openBuilderModal(type: string = 'feature') {
  if (!contextStore.repoPath) {
    showRepoManager.value = true;
    repoFormError.value = 'Select a repository before creating new entities.';
    return;
  }
  repoFormError.value = '';
  repoActionMessage.value = '';
  builderStore.initBuilder(type, {}, contextStore.repoPath);
}

function toggleLeftPanel() {
  leftPanelOpen.value = !leftPanelOpen.value;
  if (leftPanelOpen.value) {
    activeNavId.value = 'entities';
  } else if (!activeEntity.value && !['c4', 'docs', 'hub'].includes(activeNavId.value)) {
    activeNavId.value = 'hub';
  }
}

async function handleRepoChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newId = target.value;
  if (!newId) {
    return;
  }
  if (newId === contextStore.activeRepoId) {
    return;
  }
  repoFormError.value = '';
  repoActionMessage.value = '';
  try {
    await contextStore.selectActiveRepo(newId);
    repoActionMessage.value = 'Repository activated';
  } catch (err: any) {
    repoFormError.value = err?.message || 'Failed to switch repository';
  }
}

function openRepoManager() {
  repoFormError.value = '';
  repoActionMessage.value = '';
  newRepoLabel.value = '';
  newRepoPath.value = '';
  showRepoManager.value = true;
}

async function handleAddRepo() {
  repoFormError.value = '';
  repoActionMessage.value = '';
  isSavingRepo.value = true;
  try {
    const result = await contextStore.addRepository({
      label: newRepoLabel.value,
      path: newRepoPath.value,
    });
    if (!result.ok) {
      repoFormError.value = result.error || 'Failed to add repository';
      return;
    }
    repoActionMessage.value = 'Repository added successfully';
    newRepoLabel.value = '';
    newRepoPath.value = '';
  } finally {
    isSavingRepo.value = false;
  }
}

async function handleRemoveRepo(id: string) {
  repoFormError.value = '';
  repoActionMessage.value = '';
  removingRepoId.value = id;
  try {
    const result = await contextStore.removeRepository(id);
    if (!result.ok) {
      repoFormError.value = result.error || 'Failed to remove repository';
      return;
    }
    repoActionMessage.value = 'Repository removed';
  } finally {
    removingRepoId.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface">
    <!-- Simplified App Header (Material 3) -->
    <header class="sticky top-0 z-50 shadow-elevation-3">
      <div class="bg-primary text-white">
        <div class="px-6 py-3 flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <button @click="toggleLeftPanel" class="p-2 rounded-m3-full hover:bg-white/15 border border-white/10" title="Toggle Context Tree">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div class="p-2.5 rounded-m3-xl bg-white/10 border border-white/20 shadow-elevation-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-semibold tracking-tight">FCS Context-Sync</h1>
              <div class="flex items-center gap-2 text-[11px] text-white/70">
                <span v-if="totalEntities" class="px-2 py-0.5 rounded-m3-full bg-white/20">{{ totalEntities }} {{ totalEntities === 1 ? 'Entity' : 'Entities' }}</span>
              </div>
            </div>
          </div>
          
          <!-- Center: Repo Info with Git Status -->
          <button
            v-if="isRepoConfigured"
            @click="openRepoManager"
            class="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-m3-lg border border-white/20 hover:bg-white/15 transition-all cursor-pointer"
            title="Click to manage repositories"
          >
            <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span class="text-sm font-medium text-white">{{ activeRepoMeta ? activeRepoMeta.label : 'Repository' }}</span>
            
            <!-- Branch Badge -->
            <div v-if="gitStore.currentBranch" class="flex items-center gap-1 px-2 py-0.5 bg-white/90 text-primary-800 rounded-m3-full text-xs font-semibold shadow-sm">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {{ gitStore.currentBranch }}
            </div>
            
            <!-- Changes Count Badge -->
            <div v-if="gitStore.status && totalChanges > 0" class="flex items-center gap-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded-m3-full text-xs font-semibold shadow-sm">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              {{ totalChanges }}
            </div>
          </button>
          
          <div class="flex items-center gap-2 flex-wrap">
            <button @click="openDocs" class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-m3-full bg-white/15 hover:bg-white/25 border border-white/20 transition-all hover:shadow-elevation-2" title="Open Docs">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 20l9-16H3l9 16z"/></svg>
              Docs
            </button>
            <button
              @click="toggleRightPanel"
              class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-m3-full border transition-all"
              :class="rightPanelOpen ? 'bg-white text-primary-700 border-white shadow-elevation-2' : 'bg-white/15 hover:bg-white/25 border-white/20'"
              :title="rightPanelOpen ? 'Hide AI Assistant (Ctrl+Shift+A)' : 'Show AI Assistant (Ctrl+Shift+A)'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Assistant
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Quick actions for compact layouts -->
    <div class="border-b border-surface-variant bg-surface-1 shadow-elevation-1 lg:hidden">
      <div class="px-4 py-2 flex flex-wrap gap-2">
        <button
          @click="openWorkspace"
          class="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-all"
          title="Open Workspace Hub"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Home
        </button>
        <button
          @click="openGraphModal"
          :disabled="!isRepoConfigured"
          class="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Open dependency graph"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Graph
        </button>
        <button
          @click="openGitPanel"
          :disabled="!isRepoConfigured"
          class="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Open Git workflow"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Git
        </button>
        <button
          @click="runValidation"
          :disabled="!isRepoConfigured"
          class="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title="Run schema validation"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6M5 7h14" />
          </svg>
          Validate
        </button>
        <button
          @click="toggleRightPanel"
          class="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-all"
          title="Toggle AI assistant"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Assistant
        </button>
      </div>
    </div>

    <div
      v-if="!isRepoConfigured"
      class="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm px-6 py-3 flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z" />
      </svg>
      <span>{{ repoStatusHint }}</span>
    </div>

    <!-- Main content -->
    <main class="flex-1 flex overflow-hidden relative">
      <!-- Navigation Rail -->
      <aside class="hidden lg:flex flex-col items-center py-6 gap-4 w-20 bg-surface-1 border-r border-surface-variant shadow-elevation-1">
        <div class="text-xs font-semibold text-secondary-600 uppercase tracking-[0.2em]">Hub</div>
        <button
          v-for="item in navRailItems"
          :key="item.id"
          class="relative flex flex-col items-center gap-2 px-3 py-2 rounded-m3-lg text-xs font-medium transition-all"
          :class="[
            isNavActive(item.id) ? 'bg-primary-50 text-primary-700 shadow-elevation-1' : 'text-secondary-500 hover:bg-surface-2 hover:text-secondary-800',
            item.requiresRepo && !isRepoConfigured ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-secondary-500' : ''
          ]"
          :disabled="item.requiresRepo && !isRepoConfigured"
          :title="item.shortcut ? `${item.label} (${item.shortcut})` : item.label"
          @click="handleNavClick(item.id)"
        >
          <span class="text-base font-semibold">{{ item.label.charAt(0) }}</span>
          <span class="text-[10px] uppercase tracking-wide">{{ item.label }}</span>
          <div
            v-if="isNavActive(item.id)"
            class="absolute left-0 inset-y-0 w-1 rounded-r-full bg-primary-500"
          ></div>
        </button>
      </aside>

      <!-- Left Panel (Dynamic based on active view) -->
      <aside
        v-if="leftPanelOpen"
        :style="{ width: leftPanelWidth + 'px' }"
        class="relative flex-shrink-0"
      >
        <LeftPanelContainer :active-view="activeNavId" @ask-about-entity="handleAskAboutEntity" />
        <!-- Resize handle -->
        <div
          @mousedown="startResizeLeft"
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary-300 transition-colors group z-10"
        >
          <div class="absolute inset-y-0 right-0 w-1 bg-transparent group-hover:bg-primary-400"></div>
        </div>
      </aside>

      <!-- Center area with YAML/Preview/Diff/Docs or Hub -->
      <section class="flex-1 flex flex-col overflow-hidden min-w-0">
        <!-- Active Entity View with tabs -->
        <div v-if="activeEntity" class="h-full flex flex-col">
          <div class="flex items-center gap-2 border-b border-surface-variant bg-surface-1 px-4">
            <button 
              v-if="activeEntity._type !== 'c4diagram'"
              @click="setCenterTab('yaml')" 
              :class="centerTab==='yaml' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'" 
              class="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all"
              title="Edit YAML source (raw entity definition)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              YAML
            </button>
            <button 
              @click="setCenterTab('preview')" 
              :class="centerTab==='preview' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'" 
              class="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all"
              :title="activeEntity._type === 'c4diagram' ? 'View diagram' : 'View formatted entity details'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {{ activeEntity._type === 'c4diagram' ? 'Diagram' : 'Preview' }}
            </button>
            <button 
              v-if="activeEntity._type !== 'c4diagram'"
              @click="setCenterTab('diff')" 
              :class="centerTab==='diff' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'" 
              class="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all"
              title="Compare changes with Git history"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01" />
              </svg>
              Diff
            </button>
            <button 
              v-if="activeEntity._type !== 'c4diagram'"
              @click="setCenterTab('graph')" 
              :class="centerTab==='graph' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'" 
              class="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all"
              title="View entity dependency graph"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Graph
            </button>
            <button 
              v-if="activeEntity._type !== 'c4diagram'"
              @click="setCenterTab('impact')" 
              :class="centerTab==='impact' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'" 
              class="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all"
              title="Analyze impact on related entities (Ctrl+I)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Impact
            </button>
            <button 
              v-if="activeEntity._type !== 'c4diagram'"
              @click="setCenterTab('prompt')" 
              :class="centerTab==='prompt' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'" 
              class="flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-all"
              title="Generate AI context prompt for this entity"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Prompt
            </button>
          </div>
          <div class="flex-1 min-h-0">
            <Suspense>
              <template #default>
                <YamlEditor v-if="centerTab==='yaml' && activeEntity._type !== 'c4diagram'" />
                <C4DiagramRenderer v-else-if="centerTab==='preview' && activeEntity._type === 'c4diagram'" />
                <EntityPreview v-else-if="centerTab==='preview'" />
                <EntityDiff v-else-if="centerTab==='diff'" />
                <EntityDependencyGraph v-else-if="centerTab==='graph'" />
                <ImpactReportPanel v-else-if="centerTab==='impact'" />
                <PromptPanel v-else-if="centerTab==='prompt'" />
              </template>
              <template #fallback>
                <div class="flex items-center justify-center h-full">
                  <div class="text-center">
                    <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-sm text-secondary-600">Loading...</p>
                  </div>
                </div>
              </template>
            </Suspense>
          </div>
        </div>

        <!-- C4 Architecture Builder View -->
        <Suspense v-else-if="activeNavId === 'c4'">
          <template #default>
            <C4DiagramBuilder />
          </template>
          <template #fallback>
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-secondary-600">Loading C4 builder...</p>
              </div>
            </div>
          </template>
        </Suspense>
        <!-- Git Workflow View -->
        <div v-else-if="activeNavId === 'git'" class="flex flex-col h-full bg-surface">
          <!-- Git Page Header -->
          <div class="flex items-center justify-between px-6 py-4 bg-surface-1 border-b border-surface-variant shadow-elevation-1">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-m3-full bg-primary-50">
                <svg class="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h2 class="text-2xl font-semibold text-primary-900">Git Workflow</h2>
                <p class="text-sm text-secondary-600">Manage changes, stage, commit, and sync</p>
              </div>
            </div>
            <button
              @click="activeNavId = 'hub'"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-700 hover:text-primary-700 hover:bg-surface-2 rounded-m3-lg transition-all"
              title="Back to Hub"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>
          <!-- Git Content -->
          <div class="flex-1 overflow-hidden">
            <Suspense>
              <template #default>
                <GitPanel />
              </template>
              <template #fallback>
                <div class="flex items-center justify-center h-full">
                  <div class="text-center">
                    <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p class="text-sm text-secondary-600">Loading Git workflow...</p>
                  </div>
                </div>
              </template>
            </Suspense>
          </div>
        </div>

        <!-- Documentation View -->
        <Suspense v-else-if="activeNavId === 'docs'">
          <template #default>
            <WelcomeDocumentation />
          </template>
          <template #fallback>
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-secondary-600">Loading documentation...</p>
              </div>
            </div>
          </template>
        </Suspense>
        <!-- Developer Hub View (default) -->
        <DeveloperHub
          v-else-if="activeNavId === 'hub'"
          :last-validation-status="lastValidationStatus"
          :last-validation-at="lastValidationAt"
          :last-graph-refresh="lastGraphRefresh"
          @run-validation="runValidation"
          @refresh-graph="reloadGraph"
          @open-impact="openImpactView"
          @open-git="openGitPanel"
          @open-assistant="openAssistantPanel"
          @open-diff="handleOpenDiff"
          @open-prompts="handleOpenPrompts"
          @create-repo="openNewRepoModal"
        />
      </section>

      <!-- Right Panel (AI Assistant) -->
      <aside
        v-if="rightPanelOpen"
        :style="{ width: rightPanelWidth + 'px' }"
        class="bg-surface-1 border-l border-surface-variant shadow-elevation-1 relative flex-shrink-0"
      >
        <div class="h-full">
          <AIAssistantPanel @open-settings="showAISettings = true" />
        </div>
        <!-- Resize handle -->
        <div
          @mousedown="startResizeRight"
          class="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary-300 transition-colors group"
        >
          <div class="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-primary-400"></div>
        </div>
      </aside>
    </main>

    <!-- Graph Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showGraphModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          style="background-color: rgba(0, 0, 0, 0.5);"
          @click.self="showGraphModal = false"
        >
          <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[95vw] h-[90vh] flex flex-col overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
              <h2 class="text-xl font-semibold text-primary-700">Dependency Graph Visualization</h2>
              <button
                @click="showGraphModal = false"
                class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Graph Content -->
            <div class="flex-1 overflow-hidden">
              <GraphView @ask-about-entity="handleAskAboutEntity" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- New Repo Modal -->
    <Teleport to="body">
      <NewRepoModal v-if="showNewRepoModal" @close="showNewRepoModal = false" />
    </Teleport>
    
    <!-- Context Builder Modal -->
    <ContextBuilderModal />
    <AISettingsModal v-if="showAISettings" @close="showAISettings = false" />
    
    <!-- Speckit Workflow Modal -->
    <SpeckitWizard :show="showSpeckitWizard" @close="showSpeckitWizard = false" />
    
    
    <!-- Global Snackbar -->
    <Snackbar
      :show="snackbarVisible"
      :message="snackbarMessage"
      :type="snackbarType"
      :action="snackbarAction"
      @close="hideSnackbar"
      @action="handleSnackbarAction"
    />

    <!-- Command Palette -->
    <CommandPalette
      v-if="showCommandPalette"
      @close="showCommandPalette = false"
      @execute="handleCommandExecute"
    />

    <!-- Repo Manager Modal -->
    <Transition name="modal">
      <div
        v-if="showRepoManager"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background-color: rgba(0, 0, 0, 0.5);"
        @click.self="showRepoManager = false"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <div>
              <h2 class="text-xl font-semibold text-primary-700">Manage Repositories</h2>
              <p class="text-xs text-secondary-600">Switch between or add context repositories.</p>
            </div>
            <button
              @click="showRepoManager = false"
              class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div class="space-y-2">
              <h3 class="text-sm font-semibold text-secondary-700">Registered Repositories</h3>
              <div v-if="repoOptions.length === 0" class="text-xs text-secondary-500">
                No repositories registered yet.
              </div>
              <ul v-else class="space-y-2">
                <li
                  v-for="repo in repoOptions"
                  :key="repo.id"
                  class="border border-surface-variant rounded-m3-md px-3 py-2 flex items-center justify-between"
                >
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-secondary-900 truncate">{{ repo.label }}</div>
                    <div class="text-xs text-secondary-500 truncate">{{ repo.path }}</div>
                    <div class="text-[11px] text-secondary-400">
                      Last used: {{ new Date(repo.lastUsed).toLocaleString() }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="text-xs px-2 py-1 rounded-m3-md border border-primary-500 text-primary-600 hover:bg-primary-50"
                      :disabled="contextStore.activeRepoId === repo.id"
                      @click="contextStore.selectActiveRepo(repo.id)"
                    >
                      Activate
                    </button>
                    <button
                      class="text-xs px-2 py-1 rounded-m3-md border border-error-300 text-error-600 hover:bg-error-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="(contextStore.activeRepoId === repo.id && repoOptions.length <= 1) || removingRepoId === repo.id"
                      @click="handleRemoveRepo(repo.id)"
                    >
                      <span v-if="removingRepoId === repo.id" class="animate-pulse">Removing…</span>
                      <span v-else>Remove</span>
                    </button>
                  </div>
                </li>
              </ul>
            </div>

            <div class="pt-4 border-t border-surface-variant space-y-3">
              <h3 class="text-sm font-semibold text-secondary-700">Add Repository</h3>
              <div class="space-y-2">
                <label class="block text-xs text-secondary-600">Label</label>
                <input
                  v-model="newRepoLabel"
                  type="text"
                  class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-1"
                  placeholder="e.g. Main Context Repo"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-xs text-secondary-600">Path</label>
                <input
                  v-model="newRepoPath"
                  type="text"
                  class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-1"
                  placeholder="C:\\path\\to\\context-repo"
                />
              </div>
              <button
                class="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
                :disabled="isSavingRepo"
                @click="handleAddRepo"
              >
                <span v-if="isSavingRepo" class="animate-pulse">Saving…</span>
                <span v-else>Add Repository</span>
              </button>
              <div v-if="repoFormError" class="text-xs text-error-600">{{ repoFormError }}</div>
              <div v-else-if="repoActionMessage" class="text-xs text-primary-600">{{ repoActionMessage }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.header-collapse-enter-active,
.header-collapse-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.header-collapse-enter-from,
.header-collapse-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
