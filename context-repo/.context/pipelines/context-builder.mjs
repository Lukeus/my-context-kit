#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

// Load all entities
function loadAllEntities() {
  const entityDirs = {
    feature: 'features',
    userstory: 'userstories',
    spec: 'specs',
    task: 'tasks',
    service: 'services',
    package: 'packages'
  };

  const entities = [];

  for (const [entityType, dirName] of Object.entries(entityDirs)) {
    const entityDir = join(REPO_ROOT, 'contexts', dirName);
    try {
      const files = readdirSync(entityDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      
      for (const file of files) {
        try {
          const content = readFileSync(join(entityDir, file), 'utf8');
          const data = parseYAML(content);
          entities.push({ ...data, _type: entityType });
        } catch (e) {
          // Skip invalid files
        }
      }
    } catch (e) {
      // Directory doesn't exist or can't be read - skip it
    }
  }

  return entities;
}

// Suggest domains based on existing entities and keywords
function suggestDomains(entities, title = '', currentEntityType = '') {
  // Extract all unique domains from existing entities
  const domainCounts = {};
  const domainsByType = {};

  entities.forEach(entity => {
    if (entity.domain) {
      domainCounts[entity.domain] = (domainCounts[entity.domain] || 0) + 1;
      
      if (!domainsByType[entity._type]) {
        domainsByType[entity._type] = {};
      }
      domainsByType[entity._type][entity.domain] = (domainsByType[entity._type][entity.domain] || 0) + 1;
    }
  });

  // Keyword to domain mapping
  const keywordToDomain = {
    'auth': 'auth',
    'login': 'auth',
    'signup': 'auth',
    'user': 'auth',
    'permission': 'auth',
    'ui': 'ui',
    'component': 'ui',
    'button': 'ui',
    'form': 'ui',
    'display': 'ui',
    'data': 'data',
    'database': 'data',
    'storage': 'data',
    'model': 'data',
    'api': 'api',
    'endpoint': 'api',
    'rest': 'api',
    'graphql': 'api',
    'service': 'api'
  };

  const suggestions = [];

  // Suggest based on title keywords
  if (title) {
    const titleLower = title.toLowerCase();
    for (const [keyword, domain] of Object.entries(keywordToDomain)) {
      if (titleLower.includes(keyword)) {
        const confidence = domainCounts[domain] ? 'high' : 'medium';
        suggestions.push({
          domain,
          reason: `Title contains "${keyword}"`,
          confidence
        });
      }
    }
  }

  // Suggest popular domains for this entity type
  if (currentEntityType && domainsByType[currentEntityType]) {
    const typeDomains = Object.entries(domainsByType[currentEntityType])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    typeDomains.forEach(([domain, count]) => {
      if (!suggestions.find(s => s.domain === domain)) {
        suggestions.push({
          domain,
          reason: `Common for ${currentEntityType} (${count} existing)`,
          confidence: 'medium'
        });
      }
    });
  }

  // Add all existing domains as low-confidence suggestions
  Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      if (!suggestions.find(s => s.domain === domain)) {
        suggestions.push({
          domain,
          reason: `Used in ${count} entities`,
          confidence: 'low'
        });
      }
    });

  return suggestions;
}

// Suggest related entities based on graph patterns
function suggestRelatedEntities(entityType, currentEntity, entities) {
  const suggestions = {
    features: [],
    services: [],
    packages: [],
    specs: [],
    tasks: []
  };

  const currentDomain = currentEntity.domain;
  const currentTitle = (currentEntity.title || '').toLowerCase();

  // For user stories, suggest features
  if (entityType === 'userstory') {
    entities
      .filter(e => e._type === 'feature')
      .forEach(feature => {
        let confidence = 'low';
        let reason = 'Available feature';

        // Higher confidence if domains match
        if (currentDomain && feature.domain === currentDomain) {
          confidence = 'high';
          reason = `Same domain: ${currentDomain}`;
        }

        // Check for keyword overlap in titles
        const featureTitle = (feature.title || '').toLowerCase();
        const commonWords = currentTitle.split(/\s+/).filter(word => 
          word.length > 3 && featureTitle.includes(word)
        );
        if (commonWords.length > 0) {
          confidence = confidence === 'high' ? 'high' : 'medium';
          reason = `Related keywords: ${commonWords.join(', ')}`;
        }

        // Prefer in-progress features
        if (feature.status === 'in-progress') {
          confidence = confidence === 'low' ? 'medium' : 'high';
          reason += ' (in-progress)';
        }

        suggestions.features.push({
          id: feature.id,
          title: feature.title,
          confidence,
          reason
        });
      });
  }

  // For tasks, suggest features and specs
  if (entityType === 'task') {
    entities
      .filter(e => e._type === 'feature' && e.status === 'in-progress')
      .forEach(feature => {
        suggestions.features.push({
          id: feature.id,
          title: feature.title,
          confidence: 'high',
          reason: 'Active feature'
        });
      });
  }

  // For features, suggest commonly used services
  if (entityType === 'feature') {
    // Analyze which services are commonly required together
    const servicePatterns = {};
    entities
      .filter(e => e._type === 'feature' && e.requires)
      .forEach(feature => {
        (feature.requires || []).forEach(serviceId => {
          servicePatterns[serviceId] = (servicePatterns[serviceId] || 0) + 1;
        });
      });

    entities
      .filter(e => e._type === 'service')
      .forEach(service => {
        const usageCount = servicePatterns[service.id] || 0;
        let confidence = 'low';
        let reason = 'Available service';

        if (usageCount > 2) {
          confidence = 'high';
          reason = `Commonly used (${usageCount} features)`;
        } else if (usageCount > 0) {
          confidence = 'medium';
          reason = `Used in ${usageCount} feature(s)`;
        }

        suggestions.services.push({
          id: service.id,
          name: service.name,
          confidence,
          reason
        });
      });
  }

  // Sort suggestions by confidence
  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  Object.keys(suggestions).forEach(key => {
    suggestions[key].sort((a, b) => 
      confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    );
  });

  return suggestions;
}

// Check if an ID already exists
function checkIdConflict(entities, id) {
  const exists = entities.some(e => e.id === id);
  return {
    conflict: exists,
    message: exists ? `ID "${id}" already exists` : null
  };
}

// Analyze domain clustering confidence
function analyzeDomainClustering(entities, domain) {
  if (!domain) return { confidence: 'unknown', entityCount: 0 };

  const entitiesInDomain = entities.filter(e => e.domain === domain);
  const count = entitiesInDomain.length;

  let confidence = 'low';
  if (count > 10) confidence = 'high';
  else if (count > 3) confidence = 'medium';

  return {
    confidence,
    entityCount: count,
    message: `${count} existing entities in "${domain}" domain`
  };
}

// Main handler for CLI invocation
if (process.argv[2]) {
  const command = process.argv[2];
  const entities = loadAllEntities();

  try {
    let result;

    switch (command) {
      case 'suggest-domains': {
        const title = process.argv[3] || '';
        const entityType = process.argv[4] || '';
        result = suggestDomains(entities, title, entityType);
        break;
      }
      
      case 'suggest-related': {
        const entityType = process.argv[3];
        // Support both argv and base64-encoded argv for Windows compatibility
        let currentEntity = {};
        if (process.argv[4]) {
          try {
            // Try Base64 decoding first (for Windows compatibility)
            const decoded = Buffer.from(process.argv[4], 'base64').toString('utf8');
            currentEntity = JSON.parse(decoded);
          } catch {
            // Fallback to direct JSON parse
            currentEntity = JSON.parse(process.argv[4]);
          }
        }
        result = suggestRelatedEntities(entityType, currentEntity, entities);
        break;
      }
      
      case 'check-id': {
        const id = process.argv[3];
        result = checkIdConflict(entities, id);
        break;
      }
      
      case 'analyze-domain': {
        const domain = process.argv[3];
        result = analyzeDomainClustering(entities, domain);
        break;
      }
      
      default:
        result = { error: `Unknown command: ${command}` };
    }

    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    console.log(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

export {
  loadAllEntities,
  suggestDomains,
  suggestRelatedEntities,
  checkIdConflict,
  analyzeDomainClustering
};
