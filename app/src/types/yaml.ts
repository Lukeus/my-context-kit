/**
 * Common YAML entity types found in the context repository
 */
export type YAMLEntityType = 
  | 'feature'
  | 'userstory'
  | 'spec'
  | 'prompt'
  | 'parameter'
  | 'template'
  | 'rule'
  | 'governance';

/**
 * Base interface for all YAML entities
 */
export interface YAMLEntity {
  id: string;
  type: YAMLEntityType;
  name?: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  filePath?: string;
  
  // Feature-specific fields
  domain?: string;
  status?: string;
  objective?: string;
  acceptance?: string[];
  constraints?: string[];
  requires?: string[];
  produces?: string[];
  userStories?: string[];
  specs?: string[];
  tasks?: string[];
  
  // Prompt-specific fields
  content?: string;
  variables?: string[];
  examples?: string[];
  
  // Parameter-specific fields
  dataType?: string;
  defaultValue?: unknown;
  required?: boolean;
  
  // Template metadata
  _template?: {
    name?: string;
    description?: string;
    entityType?: string;
    icon?: string;
  };
  
  // Generic metadata
  [key: string]: unknown;
}
