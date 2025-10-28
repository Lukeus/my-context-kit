import { readFile } from 'node:fs/promises';

/**
 * Metadata extracted from C4 diagram header
 */
export interface C4Metadata {
  system?: string;
  level?: 'C1' | 'C2' | 'C3' | 'C4';
  feature?: string;
  specs?: string[];
  stories?: string[];
}

/**
 * Node in a C4 diagram (System, Container, Component, etc.)
 */
export interface C4Node {
  id: string;
  name: string;
  kind: 'system' | 'container' | 'component' | 'datastore' | 'queue' | 'external' | 'person';
  tech?: string;
  description?: string;
}

/**
 * Relationship between C4 nodes
 */
export interface C4Relationship {
  source: string;
  target: string;
  description: string;
  restPath?: string;
  emit?: string[];
  consume?: string[];
}

/**
 * Complete analysis result of a C4 diagram
 */
export interface C4Analysis {
  metadata: C4Metadata;
  nodes: C4Node[];
  relationships: C4Relationship[];
  capabilities: string[];
  apiEndpoints: APIEndpoint[];
  events: Event[];
}

export interface APIEndpoint {
  path: string;
  description: string;
  source: string;
  target: string;
}

export interface Event {
  name: string;
  emitter: string;
  consumers: string[];
}

/**
 * Validation result for scaffolding suitability
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Service for analyzing C4 architecture diagrams
 * Parses Mermaid C4 syntax and extracts structured information
 */
export class C4AnalyzerService {
  /**
   * Analyze a C4 diagram file and return structured data
   */
  async analyze(diagramPath: string): Promise<C4Analysis> {
    const content = await readFile(diagramPath, 'utf-8');
    
    // Extract metadata from comment header
    const metadata = this.extractMetadata(content);
    
    // Parse Mermaid C4 syntax
    const nodes = this.extractNodes(content);
    const relationships = this.extractRelationships(content);
    
    // Infer higher-level information
    const capabilities = this.inferCapabilities(nodes, relationships);
    const apiEndpoints = this.extractApiEndpoints(relationships);
    const events = this.extractEvents(relationships);
    
    return {
      metadata,
      nodes,
      relationships,
      capabilities,
      apiEndpoints,
      events
    };
  }

  /**
   * Extract metadata from C4 header comment
   * Format: %%c4: system=MySystem level=C2 feature=FEAT-001
   */
  private extractMetadata(content: string): C4Metadata {
    const headerMatch = content.match(/%%\s*c4:\s*([^\n]+)/);
    if (!headerMatch) return {};
    
    const headerStr = headerMatch[1];
    const metadata: Record<string, any> = {};
    
    // Extract key=value pairs
    const attrRegex = /(\w+)=([^,\s]+|(?:\[[^\]]*\]))/g;
    let match;
    
    while ((match = attrRegex.exec(headerStr)) !== null) {
      const [, key, value] = match;
      
      // Handle arrays
      if (value.startsWith('[')) {
        metadata[key] = value.slice(1, -1).split(',').map((v: string) => v.trim());
      } else {
        metadata[key] = value;
      }
    }
    
    return metadata as C4Metadata;
  }

  /**
   * Extract nodes from C4 diagram
   * Supports: Person(), System(), Container(), Component(), ContainerDb(), ContainerQueue()
   */
  private extractNodes(content: string): C4Node[] {
    const nodes: C4Node[] = [];
    
    // Regex patterns for different C4 node types
    const patterns = [
      { regex: /Person\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?\)/g, kind: 'person' as const },
      { regex: /System(?:_Ext)?\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?\)/g, kind: 'system' as const },
      { regex: /Container\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/g, kind: 'container' as const },
      { regex: /Component\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/g, kind: 'component' as const },
      { regex: /ContainerDb\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/g, kind: 'datastore' as const },
      { regex: /ContainerQueue\((\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?(?:,\s*"([^"]+)")?\)/g, kind: 'queue' as const },
    ];
    
    for (const { regex, kind } of patterns) {
      let match;
      regex.lastIndex = 0; // Reset regex
      
      while ((match = regex.exec(content)) !== null) {
        const id = match[1];
        const name = match[2];
        const tech = match[3];
        const description = match[4] || match[3]; // Fallback if no tech specified
        
        nodes.push({
          id,
          name,
          kind,
          tech: kind === 'person' ? undefined : tech,
          description: kind === 'person' ? tech : description
        });
      }
    }
    
    return nodes;
  }

  /**
   * Extract relationships from C4 diagram
   * Format: Rel(source, target, "description", "technology/path")
   */
  private extractRelationships(content: string): C4Relationship[] {
    const relationships: C4Relationship[] = [];
    
    const relRegex = /Rel(?:_[A-Z])?\((\w+),\s*(\w+),\s*"([^"]+)"(?:,\s*"([^"]+)")?\)/g;
    let match;
    
    while ((match = relRegex.exec(content)) !== null) {
      const source = match[1];
      const target = match[2];
      const description = match[3];
      const tech = match[4];
      
      const relationship: C4Relationship = {
        source,
        target,
        description
      };
      
      // Extract REST path if present
      if (tech && tech.startsWith('/')) {
        relationship.restPath = tech;
      }
      
      // Extract events from description
      if (description.toLowerCase().includes('publish') || description.toLowerCase().includes('emit')) {
        const eventMatch = description.match(/(\w+\.\w+)/);
        if (eventMatch) {
          relationship.emit = [eventMatch[1]];
        }
      }
      
      if (description.toLowerCase().includes('consume') || description.toLowerCase().includes('subscribe')) {
        const eventMatch = description.match(/(\w+\.\w+)/);
        if (eventMatch) {
          relationship.consume = [eventMatch[1]];
        }
      }
      
      relationships.push(relationship);
    }
    
    return relationships;
  }

  /**
   * Infer system capabilities from nodes and relationships
   */
  private inferCapabilities(nodes: C4Node[], relationships: C4Relationship[]): string[] {
    const capabilities: Set<string> = new Set();
    
    // From node names
    for (const node of nodes) {
      if (node.kind === 'container' || node.kind === 'component') {
        capabilities.add(node.name);
      }
    }
    
    // From relationship descriptions
    for (const rel of relationships) {
      if (rel.description) {
        const verbs = ['create', 'read', 'update', 'delete', 'manage', 'process', 'send', 'receive'];
        for (const verb of verbs) {
          if (rel.description.toLowerCase().includes(verb)) {
            capabilities.add(`${verb} ${rel.target}`);
          }
        }
      }
    }
    
    return Array.from(capabilities);
  }

  /**
   * Extract API endpoints from relationships
   */
  private extractApiEndpoints(relationships: C4Relationship[]): APIEndpoint[] {
    return relationships
      .filter(rel => rel.restPath)
      .map(rel => ({
        path: rel.restPath!,
        description: rel.description,
        source: rel.source,
        target: rel.target
      }));
  }

  /**
   * Extract event flows from relationships
   */
  private extractEvents(relationships: C4Relationship[]): Event[] {
    const eventMap = new Map<string, Event>();
    
    for (const rel of relationships) {
      if (rel.emit) {
        for (const eventName of rel.emit) {
          if (!eventMap.has(eventName)) {
            eventMap.set(eventName, {
              name: eventName,
              emitter: rel.source,
              consumers: []
            });
          }
        }
      }
      
      if (rel.consume) {
        for (const eventName of rel.consume) {
          const event = eventMap.get(eventName);
          if (event) {
            event.consumers.push(rel.target);
          } else {
            eventMap.set(eventName, {
              name: eventName,
              emitter: '',
              consumers: [rel.target]
            });
          }
        }
      }
    }
    
    return Array.from(eventMap.values());
  }

  /**
   * Validate that diagram is suitable for scaffolding
   */
  async validateForScaffolding(analysis: C4Analysis): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for required metadata
    if (!analysis.metadata.system) {
      errors.push('System name required in c4 header comment');
    }
    
    if (!analysis.metadata.level) {
      warnings.push('C4 level not specified - will default to C2');
    }
    
    // Check for minimum nodes
    if (analysis.nodes.length < 2) {
      warnings.push('Diagram has very few nodes - consider adding more detail');
    }
    
    // Check for relationships
    if (analysis.relationships.length === 0) {
      warnings.push('No relationships found - user stories will be limited');
    }
    
    // Check for containers (needed for feature generation)
    const containers = analysis.nodes.filter(n => n.kind === 'container' || n.kind === 'component');
    if (containers.length === 0) {
      errors.push('No containers or components found - cannot generate features');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
