import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { stringify as stringifyYAML } from 'yaml';

interface ValidationResult {
  valid: boolean;
  errors?: any[];
  warnings?: string[];
}

interface PartialEntity {
  id?: string;
  title?: string;
  domain?: string;
  status?: string;
  [key: string]: any;
}

interface DomainSuggestion {
  domain: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface RelatedSuggestion {
  id: string;
  title?: string;
  name?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

interface Suggestions {
  domains: DomainSuggestion[];
  features: RelatedSuggestion[];
  services: RelatedSuggestion[];
  packages: RelatedSuggestion[];
  specs: RelatedSuggestion[];
  tasks: RelatedSuggestion[];
}

export const useBuilderStore = defineStore('builder', () => {
  // State
  const isOpen = ref(false);
  const currentStep = ref(1);
  const entityType = ref<string>('feature');
  const partialEntity = ref<PartialEntity>({});
  const validationState = ref<ValidationResult>({ valid: true });
  const isGenerating = ref(false);
  const repoPath = ref('');
  const suggestions = ref<Suggestions>({
    domains: [],
    features: [],
    services: [],
    packages: [],
    specs: [],
    tasks: []
  });
  const idConflict = ref<{ conflict: boolean; message: string | null }>({ conflict: false, message: null });
  const availableTemplates = ref<any[]>([]);
  const selectedTemplate = ref<any | null>(null);
  const autoCommit = ref(false);
  const createBranch = ref(false);
  const errorMessage = ref<string | null>(null);
  const isLoadingSuggestions = ref(false);
  const isLoadingTemplates = ref(false);
  const createRelatedEntities = ref(false);
  const relatedEntitiesToCreate = ref<Array<{ type: string; count: number }>>([]);
  const loadingState = ref<'idle' | 'preparing' | 'loading'>('idle');
  const loadingMessage = ref('');

  // Computed
  const totalSteps = computed(() => 4); // Basic Info, Relationships, Details, Review

  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1: // Basic Info
        return !!(partialEntity.value.id && partialEntity.value.title);
      case 2: // Relationships
        return true; // Optional step
      case 3: // Details
        return true; // Optional step
      case 4: // Review
        return validationState.value.valid;
      default:
        return false;
    }
  });

  const yamlPreview = computed(() => {
    try {
      // Create a clean copy without undefined values
      const cleanEntity = Object.fromEntries(
        Object.entries(partialEntity.value).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      return stringifyYAML(cleanEntity);
    } catch (error) {
      return '# Error generating YAML preview';
    }
  });

  const isBusy = computed(() => {
    if (loadingState.value !== 'idle') {
      return true;
    }
    if (isLoadingSuggestions.value) {
      return true;
    }
    if (isLoadingTemplates.value) {
      return true;
    }
    return isGenerating.value;
  });

  const busyMessage = computed(() => {
    if (loadingState.value !== 'idle') {
      return loadingMessage.value;
    }
    if (isGenerating.value) {
      return 'Creating entity...';
    }
    if (isLoadingSuggestions.value) {
      return 'Updating suggestions...';
    }
    if (isLoadingTemplates.value) {
      return 'Loading templates...';
    }
    return '';
  });

  // Actions
  function initBuilder(type: string, initialData?: Partial<PartialEntity>, repoPathValue?: string) {
    isOpen.value = true;
    currentStep.value = 1;
    entityType.value = type;
    partialEntity.value = { ...initialData };
    validationState.value = { valid: true };
    // Always set repo path if provided, even if empty string (allows override)
    if (repoPathValue !== undefined) {
      repoPath.value = repoPathValue;
    }
  }

  function closeBuilder() {
    isOpen.value = false;
    currentStep.value = 1;
    partialEntity.value = {};
    validationState.value = { valid: true };
    isGenerating.value = false;
    errorMessage.value = null;
    autoCommit.value = false;
    createBranch.value = false;
  }

  function nextStep() {
    if (currentStep.value < totalSteps.value && canProceed.value) {
      currentStep.value++;
    }
  }

  function prevStep() {
    if (currentStep.value > 1) {
      currentStep.value--;
    }
  }

  function updateField(field: string, value: any) {
    partialEntity.value[field] = value;
  }

  function updateEntity(updates: Partial<PartialEntity>) {
    partialEntity.value = { ...partialEntity.value, ...updates };
  }

  async function generateNextId(): Promise<string> {
    try {
      const result = await window.api.context.nextId(repoPath.value, entityType.value);
      if (result.ok && result.id) {
        updateField('id', result.id);
        await checkIdConflict(result.id);
        return result.id;
      }
      return '';
    } catch (error) {
      console.error('Failed to generate next ID:', error);
      return '';
    }
  }

  async function getSuggestions() {
    if (!repoPath.value) return;

    isLoadingSuggestions.value = true;
    errorMessage.value = null;

    try {
      // Get domain suggestions
      const domainResult = await window.api.context.getSuggestions(
        repoPath.value,
        'suggest-domains',
        [partialEntity.value.title || '', entityType.value]
      );
      if (domainResult && !domainResult.error) {
        suggestions.value.domains = domainResult;
      } else if (domainResult?.error) {
        console.warn('Domain suggestions failed:', domainResult.error);
      }

      // Get related entity suggestions - convert reactive object to plain object
      const plainEntity = JSON.parse(JSON.stringify(partialEntity.value));
      const relatedResult = await window.api.context.getSuggestions(
        repoPath.value,
        'suggest-related',
        [entityType.value, plainEntity]
      );
      if (relatedResult && !relatedResult.error) {
        suggestions.value.features = relatedResult.features || [];
        suggestions.value.services = relatedResult.services || [];
        suggestions.value.packages = relatedResult.packages || [];
        suggestions.value.specs = relatedResult.specs || [];
        suggestions.value.tasks = relatedResult.tasks || [];
      } else if (relatedResult?.error) {
        console.warn('Related suggestions failed:', relatedResult.error);
      }
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      errorMessage.value = 'Failed to load suggestions. Continuing without them.';
    } finally {
      isLoadingSuggestions.value = false;
    }
  }

  async function checkIdConflict(id: string) {
    if (!id || !repoPath.value) {
      idConflict.value = { conflict: false, message: null };
      return;
    }

    try {
      const result = await window.api.context.getSuggestions(
        repoPath.value,
        'check-id',
        [id]
      );
      if (result && !result.error) {
        idConflict.value = result;
      }
    } catch (error) {
      console.error('Failed to check ID conflict:', error);
    }
  }

  async function loadTemplates() {
    if (!repoPath.value) return;

    isLoadingTemplates.value = true;

    try {
      const result = await window.api.context.getTemplates(repoPath.value, entityType.value);
      if (result.ok) {
        availableTemplates.value = result.templates;
      } else if (result.error) {
        console.warn('Failed to load templates:', result.error);
        // Don't show error to user - templates are optional
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      // Templates are optional, so don't block the workflow
    } finally {
      isLoadingTemplates.value = false;
    }
  }

  async function prepareForOpen(repoPathValue: string) {
    if (!repoPathValue) {
      return;
    }

    repoPath.value = repoPathValue;
    loadingState.value = 'preparing';
    loadingMessage.value = 'Preparing builder workspace...';

    try {
      availableTemplates.value = [];
      selectedTemplate.value = null;

      if (!partialEntity.value.id) {
        await generateNextId();
      }

      if (entityType.value === 'feature' && !Array.isArray(partialEntity.value.requires)) {
        partialEntity.value.requires = [];
      }

      loadingState.value = 'loading';
      loadingMessage.value = 'Loading templates and suggestions...';

      await Promise.all([loadTemplates(), getSuggestions()]);
    } catch (error) {
      const message = (error as Error).message || 'Failed to prepare builder';
      errorMessage.value = message;
    } finally {
      loadingState.value = 'idle';
      loadingMessage.value = '';
    }
  }

  function substituteTemplate(template: any, values: Record<string, string>): any {
    const templateStr = JSON.stringify(template);
    let result = templateStr;

    // Replace all {{placeholder}} with values
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value || '');
    }

    return JSON.parse(result);
  }

  function applyTemplate(template: any) {
    selectedTemplate.value = template;
    
    // Get current values for substitution
    const values = {
      id: partialEntity.value.id || '',
      title: partialEntity.value.title || '',
      domain: partialEntity.value.domain || '',
      feature: partialEntity.value.feature || '',
      ...partialEntity.value
    };

    // Substitute placeholders in template content
    const substituted = substituteTemplate(template.content, values);
    
    // Remove template metadata
    delete substituted._template;
    
    // Update entity with template data
    partialEntity.value = { ...substituted, ...partialEntity.value };
  }

  function clearTemplate() {
    selectedTemplate.value = null;
    // Keep ID and basic info, clear everything else
    const id = partialEntity.value.id;
    const title = partialEntity.value.title;
    const domain = partialEntity.value.domain;
    partialEntity.value = { id, title, domain };
  }

  async function validateCurrent(): Promise<boolean> {
    try {
      // For now, basic validation - check required fields by entity type
      
      // For now, basic validation - check required fields by entity type
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!partialEntity.value.id) {
        errors.push('ID is required');
      }
      if (!partialEntity.value.title) {
        errors.push('Title is required');
      }

      // Entity-specific validation
      switch (entityType.value) {
        case 'feature':
          if (!partialEntity.value.status) {
            warnings.push('Status is recommended');
          }
          break;
        case 'userstory':
          if (!partialEntity.value.feature) {
            warnings.push('Linking to a feature is recommended');
          }
          if (!partialEntity.value.asA || !partialEntity.value.iWant || !partialEntity.value.soThat) {
            errors.push('User story format requires: asA, iWant, soThat');
          }
          break;
        case 'task':
          if (!partialEntity.value.status) {
            partialEntity.value.status = 'todo';
          }
          break;
      }

      validationState.value = {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

      return errors.length === 0;
    } catch (error) {
      validationState.value = {
        valid: false,
        errors: [(error as Error).message]
      };
      return false;
    }
  }

  async function saveEntity(): Promise<{ ok: boolean; filePath?: string; error?: string }> {
    try {
      isGenerating.value = true;

      // Validate before saving
      const isValid = await validateCurrent();
      if (!isValid) {
        return { ok: false, error: 'Validation failed' };
      }

      // Create feature branch if requested
      if (createBranch.value && entityType.value === 'feature' && partialEntity.value.id) {
        const branchName = `feature/${partialEntity.value.id}-${(partialEntity.value.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30)}`;
        try {
          await window.api.git.createBranch(repoPath.value, branchName, true);
        } catch (branchError) {
          console.warn('Failed to create feature branch:', branchError);
          // Don't fail the whole operation if branch creation fails
        }
      }

      // Save entity via IPC - create a plain serializable copy
      const serializableEntity = JSON.parse(JSON.stringify(partialEntity.value));
      const result = await window.api.context.createEntity(
        repoPath.value,
        serializableEntity,
        entityType.value
      );

      if (result.ok) {
        // Auto-commit if requested
        if (autoCommit.value && result.filePath) {
          try {
            const commitMsg = `feat(${partialEntity.value.id}): ${partialEntity.value.title || 'Add new entity'}`;
            const relativePath = result.filePath.replace(repoPath.value, '').replace(/^[\\/]/, '');
            await window.api.git.commit(repoPath.value, commitMsg, [relativePath]);
          } catch (commitError) {
            console.warn('Failed to auto-commit:', commitError);
            // Don't fail the operation if commit fails
          }
        }

        // Handle bulk creation mode
        if (createRelatedEntities.value && entityType.value === 'feature' && relatedEntitiesToCreate.value.length > 0) {
          const featureId = partialEntity.value.id;
          const featureTitle = partialEntity.value.title;
          
          closeBuilder();
          
          // Schedule related entity creation
          setTimeout(() => {
            const firstRelated = relatedEntitiesToCreate.value[0];
            if (firstRelated.type === 'userstory') {
              initBuilder('userstory', { feature: featureId }, repoPath.value);
            } else if (firstRelated.type === 'task') {
              initBuilder('task', { relatedFeature: featureId }, repoPath.value);
            }
            relatedEntitiesToCreate.value = relatedEntitiesToCreate.value.slice(1);
          }, 300);
          
          return result;
        }
        
        closeBuilder();
        return result;
      } else {
        validationState.value = {
          valid: false,
          errors: [result.error || 'Failed to save entity']
        };
        return result;
      }
    } catch (error) {
      const errorMsg = (error as Error).message || 'Failed to save entity';
      validationState.value = {
        valid: false,
        errors: [errorMsg]
      };
      return { ok: false, error: errorMsg };
    } finally {
      isGenerating.value = false;
    }
  }

  return {
    // State
    isOpen,
    currentStep,
    entityType,
    partialEntity,
    validationState,
    isGenerating,
    repoPath,
    suggestions,
    idConflict,
    availableTemplates,
    selectedTemplate,
    autoCommit,
    createBranch,
    errorMessage,
    isLoadingSuggestions,
    isLoadingTemplates,
    createRelatedEntities,
    relatedEntitiesToCreate,
    loadingState,
    loadingMessage,
    // Computed
    totalSteps,
    canProceed,
    yamlPreview,
    isBusy,
    busyMessage,
    // Actions
    initBuilder,
    closeBuilder,
    nextStep,
    prevStep,
    updateField,
    updateEntity,
    generateNextId,
    validateCurrent,
    saveEntity,
    getSuggestions,
    checkIdConflict,
    loadTemplates,
    prepareForOpen,
    applyTemplate,
    clearTemplate
  };
});
