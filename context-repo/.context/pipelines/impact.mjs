#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';
import { execSync } from 'node:child_process';

// Helper function to get git diff for a file
function getFileDiff(filePath) {
  try {
    // Get the diff against HEAD
    const diff = execSync(`git diff HEAD "${filePath}"`, { 
      cwd: REPO_ROOT, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return diff;
  } catch (error) {
    // If no diff or file not in git, try against staged changes
    try {
      const stagedDiff = execSync(`git diff --staged "${filePath}"`, { 
        cwd: REPO_ROOT, 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      return stagedDiff;
    } catch {
      return null;
    }
  }
}

// Helper function to parse YAML diff and detect field changes
function detectFieldChanges(filePath, currentEntity) {
  const diff = getFileDiff(filePath);
  if (!diff || diff.trim() === '') {
    return { hasChanges: false, changedFields: [], changes: [], noDiff: true };
  }
  
  const changes = [];
  const lines = diff.split('\n');
  
  let currentField = null;
  let oldValue = null;
  let newValue = null;
  
  for (const line of lines) {
    // Detect field changes in YAML diff
    if (line.startsWith('-') && !line.startsWith('---')) {
      const match = line.match(/^-\s*(\w+):\s*(.*)/);
      if (match) {
        currentField = match[1];
        oldValue = match[2].trim();
      }
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      const match = line.match(/^\+\s*(\w+):\s*(.*)/);
      if (match) {
        const field = match[1];
        newValue = match[2].trim();
        
        // If we have a matching field change
        if (field === currentField || !currentField) {
          changes.push({
            field: field,
            oldValue: oldValue || '(not set)',
            newValue: newValue,
            valueType: Array.isArray(currentEntity[field]) ? 'array' : typeof currentEntity[field]
          });
          currentField = null;
          oldValue = null;
          newValue = null;
        }
      }
    }
  }
  
  return { 
    hasChanges: changes.length > 0, 
    changedFields: changes.map(c => c.field),
    changes,
    noDiff: false
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

// Get changed entity IDs from command line arguments
const changedIds = process.argv.slice(2);

if (changedIds.length === 0) {
  console.error(JSON.stringify({ 
    error: 'No entity IDs provided. Usage: node impact.mjs <entity-id1> [entity-id2] ...' 
  }));
  process.exit(1);
}

// Entity type to directory mapping
const entityDirs = {
  governance: 'governance',
  feature: 'features',
  userstory: 'userstories',
  spec: 'specs',
  task: 'tasks',
  service: 'services',
  package: 'packages'
};

// Helper function to get all YAML files
function getAllYamlFiles(dir) {
  const files = [];
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getAllYamlFiles(fullPath));
      } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist - skip it
  }
  return files;
}

// Load consistency rules
let consistencyRules = [];
try {
  const rulesPath = join(REPO_ROOT, '.context', 'rules', 'consistency.rules.yaml');
  if (existsSync(rulesPath)) {
    const rulesContent = readFileSync(rulesPath, 'utf8');
    const rulesData = parseYAML(rulesContent);
    consistencyRules = rulesData.rules || [];
  }
} catch (error) {
  // Rules file doesn't exist or can't be parsed - continue without rules
  console.error(JSON.stringify({ warning: `Could not load consistency rules: ${error.message}` }));
}

// Load all entities and build graph
const entities = {};
const edges = [];

try {
  // Load all entities
  for (const [entityType, dirName] of Object.entries(entityDirs)) {
    const entityDir = join(REPO_ROOT, 'contexts', dirName);
    const files = getAllYamlFiles(entityDir);
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const data = parseYAML(content);
        
        if (data && data.id) {
          entities[data.id] = { ...data, _type: entityType, _file: file };
        }
      } catch (error) {
        // Skip invalid files
      }
    }
  }
  
  // Build edges for impact analysis
  for (const [id, entity] of Object.entries(entities)) {
    // Feature relationships
    if (entity._type === 'feature') {
      if (entity.userStories) {
        entity.userStories.forEach(storyId => {
          edges.push({ from: id, to: storyId, rel: 'has-story' });
        });
      }
      if (entity.specs) {
        entity.specs.forEach(specId => {
          edges.push({ from: id, to: specId, rel: 'has-spec' });
        });
      }
      if (entity.tasks) {
        entity.tasks.forEach(taskId => {
          edges.push({ from: id, to: taskId, rel: 'has-task' });
        });
      }
      if (entity.requires) {
        entity.requires.forEach(depId => {
          edges.push({ from: id, to: depId, rel: 'requires' });
        });
      }
      if (entity.produces) {
        entity.produces.forEach(prodId => {
          edges.push({ from: id, to: prodId, rel: 'produces' });
        });
      }
    }
    
    // User story relationships
    if (entity._type === 'userstory') {
      if (entity.feature) {
        edges.push({ from: entity.feature, to: id, rel: 'has-story' });
      }
      if (entity.impacts?.services) {
        entity.impacts.services.forEach(svcId => {
          edges.push({ from: id, to: svcId, rel: 'impacts' });
        });
      }
      if (entity.impacts?.packages) {
        entity.impacts.packages.forEach(pkgId => {
          edges.push({ from: id, to: pkgId, rel: 'impacts' });
        });
      }
    }
    
    // Spec relationships
    if (entity._type === 'spec' && entity.related) {
      if (entity.related.features) {
        entity.related.features.forEach(featId => {
          edges.push({ from: featId, to: id, rel: 'has-spec' });
        });
      }
      if (entity.related.services) {
        entity.related.services.forEach(svcId => {
          edges.push({ from: id, to: svcId, rel: 'relates-to' });
        });
      }
      if (entity.related.packages) {
        entity.related.packages.forEach(pkgId => {
          edges.push({ from: id, to: pkgId, rel: 'relates-to' });
        });
      }
    }
    
    // Task relationships
    if (entity._type === 'task' && entity.related) {
      if (entity.related.feature) {
        edges.push({ from: entity.related.feature, to: id, rel: 'has-task' });
      }
      if (entity.related.spec) {
        edges.push({ from: entity.related.spec, to: id, rel: 'implements' });
      }
      if (entity.related.service) {
        edges.push({ from: id, to: entity.related.service, rel: 'modifies' });
      }
    }
    
    // Service relationships
    if (entity._type === 'service') {
      if (entity.dependencies) {
        entity.dependencies.forEach(dep => {
          const depId = dep.split('@')[0];
          edges.push({ from: id, to: depId, rel: 'depends-on' });
        });
      }
      if (entity.consumers) {
        entity.consumers.forEach(consumerId => {
          edges.push({ from: consumerId, to: id, rel: 'uses' });
        });
      }
    }
    
    // Package relationships
    if (entity._type === 'package' && entity.uses?.services) {
      entity.uses.services.forEach(svcId => {
        edges.push({ from: id, to: svcId, rel: 'uses' });
      });
    }
  }
  
  // Helper function to apply consistency rules
  function applyConsistencyRules(changedId, changedEntity, neighbors, fieldChanges) {
    const ruleIssues = [];
    
    for (const rule of consistencyRules) {
      // Check if rule applies to this entity type
      if (rule.when?.entity !== changedEntity._type) {
        continue;
      }
      
      // Check if any of the rule's fieldChanged match the actual changes
      let ruleApplies = false;
      const matchedFields = [];
      
      if (rule.when?.fieldChanged) {
        const ruleFields = Array.isArray(rule.when.fieldChanged) 
          ? rule.when.fieldChanged 
          : [rule.when.fieldChanged];
        
        // If we have field changes detected, check against them
        if (fieldChanges.hasChanges) {
          ruleApplies = ruleFields.some(field => {
            const matched = fieldChanges.changedFields.includes(field);
            if (matched) matchedFields.push(field);
            return matched;
          });
        } else {
          // If no field changes detected (new file, etc), apply rule conservatively
          ruleApplies = true;
        }
      } else {
        // Rule has no field specification - applies to any change
        ruleApplies = true;
      }
      
      if (!ruleApplies) continue;
      
      // Apply the rule
      if (rule.then?.markRelated) {
        const { types, rel, reason, status } = rule.then.markRelated;
        
        neighbors.forEach(neighborId => {
          const neighbor = entities[neighborId];
          if (!neighbor) return;
          
          // Check if neighbor type matches rule types
          if (types && !types.includes(neighbor._type)) {
            return;
          }
          
          // Check if relationship matches rule rel (if specified)
          if (rel) {
            const hasRelationship = edges.some(e => 
              (e.from === changedId && e.to === neighborId && e.rel === rel) ||
              (e.from === neighborId && e.to === changedId && e.rel === rel)
            );
            if (!hasRelationship) return;
          }
          
          // Build detailed message
          let detailedMessage = `${changedEntity._type} ${changedId} changed`;
          let detailedReason = reason || rule.description;
          let suggestedAction = '';
          const severity = rule.severity || 'warning';
          let changesSummary = null;
          
          if (matchedFields.length > 0 && fieldChanges.hasChanges) {
            const fieldNames = matchedFields.join(', ');
            detailedMessage = `${changedEntity._type} ${changedId}: ${fieldNames} changed`;
            
            // Get actual change details if available
            const relevantChanges = fieldChanges.changes?.filter(c => 
              matchedFields.includes(c.field)
            ) || [];
            
            if (relevantChanges.length > 0) {
              changesSummary = relevantChanges;
              const changeDetails = relevantChanges.map(c => {
                if (c.valueType === 'array' || c.oldValue.includes('[')) {
                  return `${c.field} modified`;
                }
                return `${c.field}: "${c.oldValue}" → "${c.newValue}"`;
              }).join('; ');
              detailedMessage = `${changedEntity._type} ${changedId}: ${changeDetails}`;
            }
          }
          
          // Generate suggested actions based on rule type
          if (rule.id === 'feature-change-impacts-all') {
            suggestedAction = 'Review and update implementation to align with feature changes';
            if (matchedFields.includes('requires')) {
              suggestedAction = 'Verify dependencies are satisfied and update task requirements';
            } else if (matchedFields.includes('prompts')) {
              suggestedAction = 'Review implementation approach against updated feature prompts';
            }
          } else if (rule.id === 'US-acceptance-change-flags-tasks') {
            suggestedAction = 'Update task implementation and test cases to match new acceptance criteria';
          } else if (rule.id === 'service-version-bump-needs-consumer-review') {
            suggestedAction = 'Review API contract changes and update client integration code';
          } else if (rule.id === 'spec-change-impacts-implementations') {
            suggestedAction = 'Review implementation against updated technical specifications';
          } else if (rule.id === 'task-status-blocked-flags-feature') {
            suggestedAction = 'Address blocking issues or adjust feature timeline';
          } else if (rule.id === 'package-dependency-change-impacts-consumers') {
            suggestedAction = 'Review transitive dependencies and update version constraints';
          }
          
          // Add issue with source entity context
          // Only include changes if they were actually detected
          const issueData = {
            id: neighborId,
            type: status || 'needs-review',
            message: detailedMessage,
            reason: detailedReason,
            suggestedAction,
            severity,
            ruleId: rule.id,
            sourceEntity: {
              id: changedId,
              type: changedEntity._type,
              title: changedEntity.title || changedEntity.name || changedId
            },
            hasGitDiff: !fieldChanges.noDiff
          };
          
          // Only add changes array if we actually detected specific changes
          if (changesSummary && changesSummary.length > 0) {
            issueData.changes = changesSummary;
          }
          
          ruleIssues.push(issueData);
        });
      }
    }
    
    return ruleIssues;
  }
  
  // Find all neighbors of changed entities
  const impactedIds = new Set();
  const issues = [];
  const staleIds = new Set();
  
  // Lightweight insights for entities to add useful guidance even when there are no diffs
  function computeInsights(entity) {
    const out = [];
    if (!entity) return out;

    if (entity._type === 'feature') {
      if (!Array.isArray(entity.userStories) || entity.userStories.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Feature has no linked user stories',
          suggestedAction: 'Link user stories that describe the outcomes for this feature'
        });
      }
      if (!Array.isArray(entity.specs) || entity.specs.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Feature has no linked specs',
          suggestedAction: 'Link specifications that define how to implement this feature'
        });
      }
      if (!Array.isArray(entity.tasks) || entity.tasks.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Feature has no linked tasks',
          suggestedAction: 'Create tasks to plan the implementation for this feature'
        });
      }
    }

    if (entity._type === 'userstory') {
      const ac = Array.isArray(entity.acceptanceCriteria) ? entity.acceptanceCriteria : [];
      if (ac.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'User story has no acceptance criteria',
          suggestedAction: 'Add 2–5 acceptance criteria to make the story testable'
        });
      }
      if (!entity.feature) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'User story is not linked to a feature',
          suggestedAction: 'Link this story to its parent feature'
        });
      }
    }

    if (entity._type === 'spec') {
      const relatedFeatures = Array.isArray(entity.related?.features) ? entity.related.features : [];
      if (relatedFeatures.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Spec is not linked to any feature',
          suggestedAction: 'Link this spec to one or more features it supports'
        });
      }
    }

    if (entity._type === 'service') {
      if (!entity.api || !entity.api.version) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Service is missing API version metadata',
          suggestedAction: 'Add api.version to document the current contract version'
        });
      }
      if (!Array.isArray(entity.consumers) || entity.consumers.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Service has no declared consumers',
          suggestedAction: 'Link packages or services that consume this service to improve visibility'
        });
      }
    }

    if (entity._type === 'package') {
      const usesServices = Array.isArray(entity.uses?.services) ? entity.uses.services : [];
      if (usesServices.length === 0) {
        out.push({
          id: entity.id,
          type: 'insight',
          severity: 'info',
          message: 'Package has no linked services',
          suggestedAction: 'Link services this package depends on for clarity'
        });
      }
    }

    return out;
  }

  for (const changedId of changedIds) {
    if (!entities[changedId]) {
      issues.push({
        id: changedId,
        type: 'not-found',
        message: `Entity ${changedId} does not exist`,
        severity: 'error'
      });
      continue;
    }
    
    // Detect what actually changed in this entity
    const changedEntity = entities[changedId];
    const fieldChanges = detectFieldChanges(changedEntity._file, changedEntity);
    
    // Find all neighbors (incoming and outgoing edges)
    const neighbors = edges
      .filter(e => e.from === changedId || e.to === changedId)
      .map(e => e.from === changedId ? e.to : e.from)
      .filter(id => id !== changedId);
    
    neighbors.forEach(id => {
      impactedIds.add(id);
      staleIds.add(id);
    });
    
    // Apply consistency rules with field change detection
    const ruleIssues = applyConsistencyRules(changedId, changedEntity, neighbors, fieldChanges);
    issues.push(...ruleIssues);
    
    // Add helpful insights for the changed entity and its direct neighbors
    issues.push(...computeInsights(changedEntity));
    neighbors.forEach(id => issues.push(...computeInsights(entities[id])));

    // Mark entities with issues as stale
    ruleIssues.forEach(issue => staleIds.add(issue.id));
  }
  
  // Build impact report
  const report = {
    changedIds,
    impactedIds: Array.from(impactedIds),
    staleIds: Array.from(staleIds),
    issues,
    stats: {
      totalChanged: changedIds.length,
      totalImpacted: impactedIds.size,
      totalStale: staleIds.size,
      totalIssues: issues.length,
      issuesByType: issues.reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      }, {})
    },
    impactedEntities: Array.from(impactedIds).map(id => ({
      id,
      type: entities[id]?._type,
      title: entities[id]?.title || entities[id]?.name,
      status: entities[id]?.status,
      isStale: staleIds.has(id)
    }))
  };
  
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
  
} catch (error) {
  console.error(JSON.stringify({ 
    error: `Failed to analyze impact: ${error.message}`,
    stack: error.stack
  }));
  process.exit(1);
}
