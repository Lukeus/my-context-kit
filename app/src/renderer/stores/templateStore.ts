/**
 * Template Store
 * 
 * Manages specification templates for Context Kit.
 * Provides template CRUD operations, variable substitution, and template library.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type TemplateCategory = 'feature' | 'api' | 'component' | 'service' | 'custom';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface SpecTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  version: string;
  variables: TemplateVariable[];
  content: string;
  metadata: {
    author: string;
    created: string;
    modified?: string;
    tags: string[];
  };
}

export const useTemplateStore = defineStore('template', () => {
  // State
  const templates = ref<Map<string, SpecTemplate>>(new Map());
  const isLoading = ref(false);
  const lastError = ref<string | null>(null);

  // Computed
  const allTemplates = computed(() => Array.from(templates.value.values()));
  
  const templatesByCategory = computed(() => {
    const byCategory: Record<TemplateCategory, SpecTemplate[]> = {
      feature: [],
      api: [],
      component: [],
      service: [],
      custom: [],
    };
    
    allTemplates.value.forEach(template => {
      byCategory[template.category].push(template);
    });
    
    return byCategory;
  });

  // Actions
  function addTemplate(template: SpecTemplate): void {
    templates.value.set(template.id, template);
  }

  function updateTemplate(id: string, updates: Partial<SpecTemplate>): boolean {
    const existing = templates.value.get(id);
    if (!existing) {
      lastError.value = `Template ${id} not found`;
      return false;
    }

    const updated: SpecTemplate = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...(updates.metadata || {}),
        modified: new Date().toISOString(),
      },
    };

    templates.value.set(id, updated);
    return true;
  }

  function deleteTemplate(id: string): boolean {
    const result = templates.value.delete(id);
    if (!result) {
      lastError.value = `Template ${id} not found`;
    }
    return result;
  }

  function getTemplate(id: string): SpecTemplate | undefined {
    return templates.value.get(id);
  }

  function searchTemplates(query: string): SpecTemplate[] {
    const lowerQuery = query.toLowerCase();
    return allTemplates.value.filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Substitute template variables in content
   */
  function substituteVariables(
    content: string,
    variables: Record<string, any>
  ): string {
    let result = content;
    
    // Replace {{variable_name}} with actual values
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value));
    });
    
    return result;
  }

  /**
   * Validate variable values against template requirements
   */
  function validateVariables(
    template: SpecTemplate,
    variables: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    template.variables.forEach(varDef => {
      const value = variables[varDef.name];
      
      // Check required
      if (varDef.required && (value === undefined || value === null || value === '')) {
        errors.push(`Required variable '${varDef.name}' is missing`);
        return;
      }

      // Type checking
      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== varDef.type) {
          errors.push(`Variable '${varDef.name}' expected type ${varDef.type}, got ${actualType}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply a template with given variables
   */
  function applyTemplate(
    templateId: string,
    variables: Record<string, any>
  ): { success: boolean; content?: string; errors?: string[] } {
    const template = getTemplate(templateId);
    
    if (!template) {
      return {
        success: false,
        errors: [`Template ${templateId} not found`],
      };
    }

    const validation = validateVariables(template, variables);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    const content = substituteVariables(template.content, variables);
    
    return {
      success: true,
      content,
    };
  }

  /**
   * Export template as JSON
   */
  function exportTemplate(id: string): string | null {
    const template = getTemplate(id);
    if (!template) {
      lastError.value = `Template ${id} not found`;
      return null;
    }
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template from JSON
   */
  function importTemplate(json: string): boolean {
    try {
      const template = JSON.parse(json) as SpecTemplate;
      
      // Validate basic structure
      if (!template.id || !template.name || !template.content) {
        lastError.value = 'Invalid template format';
        return false;
      }
      
      addTemplate(template);
      return true;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : 'Failed to parse template JSON';
      return false;
    }
  }

  /**
   * Load default templates
   */
  function loadDefaultTemplates(): void {
    const defaults: SpecTemplate[] = [
      {
        id: 'feature-spec-v1',
        name: 'Feature Specification',
        description: 'Comprehensive specification for a new feature',
        category: 'feature',
        version: '1.0.0',
        variables: [
          {
            name: 'feature_name',
            type: 'string',
            description: 'Name of the feature',
            required: true,
          },
          {
            name: 'description',
            type: 'string',
            description: 'Brief description of the feature',
            required: true,
          },
          {
            name: 'requirements',
            type: 'array',
            description: 'List of requirements',
            required: false,
            default: [],
          },
        ],
        content: `# Feature: {{feature_name}}

## Overview
{{description}}

## Requirements
{{requirements}}

## Technical Design
[To be filled]

## API Endpoints
[To be filled]

## Data Models
[To be filled]

## Security Considerations
[To be filled]

## Testing Strategy
[To be filled]

## Implementation Plan
[To be filled]
`,
        metadata: {
          author: 'System',
          created: new Date().toISOString(),
          tags: ['feature', 'specification', 'default'],
        },
      },
      {
        id: 'api-spec-v1',
        name: 'API Specification',
        description: 'RESTful API endpoint specification',
        category: 'api',
        version: '1.0.0',
        variables: [
          {
            name: 'endpoint_name',
            type: 'string',
            description: 'Name of the API endpoint',
            required: true,
          },
          {
            name: 'http_method',
            type: 'string',
            description: 'HTTP method (GET, POST, PUT, DELETE)',
            required: true,
            default: 'GET',
          },
          {
            name: 'path',
            type: 'string',
            description: 'API path',
            required: true,
          },
        ],
        content: `# API: {{endpoint_name}}

## Endpoint Details
- **Method**: {{http_method}}
- **Path**: {{path}}
- **Authentication**: Required

## Request

### Headers
\`\`\`
Content-Type: application/json
Authorization: Bearer <token>
\`\`\`

### Body
\`\`\`json
{
  // Request body schema
}
\`\`\`

## Response

### Success (200)
\`\`\`json
{
  // Response body schema
}
\`\`\`

### Error Responses
- **400**: Bad Request
- **401**: Unauthorized
- **404**: Not Found
- **500**: Internal Server Error

## Rate Limiting
[To be filled]

## Examples
[To be filled]
`,
        metadata: {
          author: 'System',
          created: new Date().toISOString(),
          tags: ['api', 'endpoint', 'rest', 'default'],
        },
      },
      {
        id: 'component-spec-v1',
        name: 'Component Specification',
        description: 'UI component specification',
        category: 'component',
        version: '1.0.0',
        variables: [
          {
            name: 'component_name',
            type: 'string',
            description: 'Name of the component',
            required: true,
          },
          {
            name: 'framework',
            type: 'string',
            description: 'Framework (React, Vue, etc.)',
            required: true,
            default: 'React',
          },
        ],
        content: `# Component: {{component_name}}

## Overview
A {{framework}} component for [purpose].

## Props/Interface
\`\`\`typescript
interface {{component_name}}Props {
  // Props definition
}
\`\`\`

## State Management
[To be filled]

## Event Handlers
[To be filled]

## Styling
[To be filled]

## Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support

## Usage Example
\`\`\`{{framework}}
// Usage example
\`\`\`

## Testing
[To be filled]
`,
        metadata: {
          author: 'System',
          created: new Date().toISOString(),
          tags: ['component', 'ui', 'frontend', 'default'],
        },
      },
    ];

    defaults.forEach(template => addTemplate(template));
  }

  function clearError(): void {
    lastError.value = null;
  }

  // Initialize with default templates
  loadDefaultTemplates();

  return {
    // State
    templates,
    isLoading,
    lastError,
    
    // Computed
    allTemplates,
    templatesByCategory,
    
    // Actions
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    searchTemplates,
    applyTemplate,
    substituteVariables,
    validateVariables,
    exportTemplate,
    importTemplate,
    loadDefaultTemplates,
    clearError,
  };
});
