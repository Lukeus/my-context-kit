#!/usr/bin/env node

/**
 * PR Template Generator
 * 
 * Generates PR descriptions with spec impact analysis and constitutional compliance
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * Get changed spec files in current branch
 */
async function getChangedSpecs(baseBranch = 'main') {
  try {
    const git = simpleGit(REPO_ROOT);
    
    // Get diff between base branch and current
    const diff = await git.diff([`${baseBranch}...HEAD`, '--name-only']);
    
    // Filter for spec files
    const changedSpecs = diff
      .split('\n')
      .filter(file => file.trim())
      .filter(file => file.includes('specs/') && file.endsWith('spec.md'));
    
    return changedSpecs;
  } catch (error) {
    return [];
  }
}

/**
 * Parse spec file for key information
 */
async function parseSpec(specPath) {
  try {
    const fullPath = path.join(REPO_ROOT, specPath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Extract spec number
    const numberMatch = content.match(/\*\*Spec Number\*\*:\s*(\d{3})/);
    const specNumber = numberMatch ? numberMatch[1] : '???';
    
    // Extract title
    const titleMatch = content.match(/^#\s+(?:Feature Specification:\s*)?(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    
    // Extract user stories count
    const userStoriesSection = content.match(/##\s+User Stories\s*\n([\s\S]*?)(?=\n##|$)/);
    const userStoriesCount = userStoriesSection 
      ? (userStoriesSection[1].match(/^-/gm) || []).length
      : 0;
    
    // Extract acceptance criteria count
    const acceptanceSection = content.match(/##\s+Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|$)/);
    const acceptanceCriteriaCount = acceptanceSection
      ? (acceptanceSection[1].match(/^-/gm) || []).length
      : 0;
    
    // Check constitutional gates
    const hasSimplicityGate = content.includes('Simplicity Gate');
    const hasAntiAbstractionGate = content.includes('Anti-Abstraction Gate');
    const hasIntegrationGate = content.includes('Integration-First Gate');
    
    // Check for clarification markers
    const clarificationCount = (content.match(/\[NEEDS CLARIFICATION\]/g) || []).length;
    
    return {
      specNumber,
      title,
      userStoriesCount,
      acceptanceCriteriaCount,
      hasConstitutionalGates: hasSimplicityGate && hasAntiAbstractionGate && hasIntegrationGate,
      clarificationCount,
      path: specPath,
    };
  } catch (error) {
    return {
      error: error.message,
      path: specPath,
    };
  }
}

/**
 * Get related YAML entities for specs
 */
async function getRelatedEntities(specNumbers) {
  const entities = {
    features: [],
    userStories: [],
    tasks: [],
  };
  
  for (const specNumber of specNumbers) {
    // Check for feature
    const featurePath = path.join(REPO_ROOT, 'contexts', 'features', `FEAT-${specNumber}.yaml`);
    try {
      await fs.access(featurePath);
      entities.features.push(`FEAT-${specNumber}`);
    } catch {}
    
    // Check for user stories (try common patterns)
    for (let i = 1; i <= 10; i++) {
      const storyId = `US-${specNumber}${String(i).padStart(2, '0')}`;
      const storyPath = path.join(REPO_ROOT, 'contexts', 'userstories', `${storyId}.yaml`);
      try {
        await fs.access(storyPath);
        entities.userStories.push(storyId);
      } catch {
        break; // Stop at first missing story
      }
    }
  }
  
  return entities;
}

/**
 * Generate PR template
 */
async function generatePRTemplate(baseBranch = 'main', options = {}) {
  try {
    const git = simpleGit(REPO_ROOT);
    
    // Get current branch
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    
    // Get changed specs
    const changedSpecs = await getChangedSpecs(baseBranch);
    
    if (changedSpecs.length === 0) {
      return {
        ok: true,
        template: generateBasicTemplate(currentBranch),
        hasSpecs: false,
        message: 'No spec files changed',
      };
    }
    
    // Parse all changed specs
    const specInfos = await Promise.all(changedSpecs.map(parseSpec));
    
    // Get related entities
    const specNumbers = specInfos
      .filter(s => !s.error)
      .map(s => s.specNumber);
    const relatedEntities = await getRelatedEntities(specNumbers);
    
    // Generate template
    let template = `# ${generateTitle(specInfos, currentBranch)}\n\n`;
    
    // Add summary
    template += `## Summary\n\n`;
    template += generateSummary(specInfos) + '\n\n';
    
    // Add specifications section
    template += `## Specifications\n\n`;
    for (const spec of specInfos) {
      if (!spec.error) {
        template += `### SPEC-${spec.specNumber}: ${spec.title}\n\n`;
        template += `- **User Stories**: ${spec.userStoriesCount}\n`;
        template += `- **Acceptance Criteria**: ${spec.acceptanceCriteriaCount}\n`;
        template += `- **Constitutional Gates**: ${spec.hasConstitutionalGates ? '✅ Present' : '⚠️ Missing'}\n`;
        
        if (spec.clarificationCount > 0) {
          template += `- **Clarifications Needed**: ${spec.clarificationCount} markers\n`;
        }
        
        template += `\n`;
      }
    }
    
    // Add related entities section
    if (relatedEntities.features.length > 0 || relatedEntities.userStories.length > 0) {
      template += `## Related Entities\n\n`;
      
      if (relatedEntities.features.length > 0) {
        template += `**Features**: ${relatedEntities.features.join(', ')}\n\n`;
      }
      
      if (relatedEntities.userStories.length > 0) {
        template += `**User Stories**: ${relatedEntities.userStories.join(', ')}\n\n`;
      }
    }
    
    // Add impact section
    template += `## Impact\n\n`;
    template += generateImpactSection(specInfos, relatedEntities) + '\n\n';
    
    // Add checklist
    template += `## Review Checklist\n\n`;
    template += `- [ ] Specifications are complete (no \`[NEEDS CLARIFICATION]\` markers)\n`;
    template += `- [ ] Constitutional gates are addressed\n`;
    template += `- [ ] User stories are clear and testable\n`;
    template += `- [ ] Acceptance criteria are measurable\n`;
    template += `- [ ] Related YAML entities are created/updated\n`;
    template += `- [ ] Tests are written (if applicable)\n`;
    template += `- [ ] Documentation is updated\n\n`;
    
    // Add footer
    template += `---\n\n`;
    template += `*This PR description was generated by the SDD workflow.*\n`;
    
    return {
      ok: true,
      template,
      hasSpecs: true,
      specsChanged: changedSpecs.length,
      relatedEntities,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

function generateTitle(specInfos, branchName) {
  if (specInfos.length === 1 && !specInfos[0].error) {
    return `[SPEC-${specInfos[0].specNumber}] ${specInfos[0].title}`;
  } else if (specInfos.length > 1) {
    return `[SDD] Multiple Specifications (${specInfos.length} specs)`;
  } else {
    return `[SDD] ${branchName}`;
  }
}

function generateSummary(specInfos) {
  const validSpecs = specInfos.filter(s => !s.error);
  
  if (validSpecs.length === 0) {
    return 'This PR updates specification files.';
  }
  
  if (validSpecs.length === 1) {
    const spec = validSpecs[0];
    return `This PR introduces **${spec.title}** (SPEC-${spec.specNumber}) with ${spec.userStoriesCount} user stories and ${spec.acceptanceCriteriaCount} acceptance criteria.`;
  }
  
  return `This PR updates ${validSpecs.length} specifications:\n\n${validSpecs.map(s => `- **SPEC-${s.specNumber}**: ${s.title}`).join('\n')}`;
}

function generateImpactSection(specInfos, relatedEntities) {
  const totalFeatures = relatedEntities.features.length;
  const totalStories = relatedEntities.userStories.length;
  
  let impact = '';
  
  if (totalFeatures > 0) {
    impact += `- **${totalFeatures} Feature(s)** may need review\n`;
  }
  
  if (totalStories > 0) {
    impact += `- **${totalStories} User Story(ies)** may need review\n`;
  }
  
  const clarificationTotal = specInfos.reduce((sum, s) => sum + (s.clarificationCount || 0), 0);
  if (clarificationTotal > 0) {
    impact += `- **${clarificationTotal} Clarification(s)** needed before implementation\n`;
  }
  
  if (!impact) {
    impact = 'No impact detected on existing entities.';
  }
  
  return impact;
}

function generateBasicTemplate(branchName) {
  return `# ${branchName}\n\n## Summary\n\n[Describe your changes]\n\n## Changes\n\n- [ ] Change 1\n- [ ] Change 2\n\n## Review Checklist\n\n- [ ] Tests pass\n- [ ] Documentation updated\n- [ ] Code reviewed\n`;
}

// ===== CLI Interface =====

async function main() {
  const [, , command, ...args] = process.argv;
  
  if (!command) {
    console.error('Usage: node pr-template.mjs <command> [args]');
    console.error('Commands:');
    console.error('  generate [baseBranch]  - Generate PR template (default: main)');
    process.exit(1);
  }
  
  let result;
  
  switch (command) {
    case 'generate':
      result = await generatePRTemplate(args[0] || 'main');
      
      if (result.ok) {
        console.log(result.template);
      } else {
        console.error(JSON.stringify(result, null, 2));
      }
      
      process.exit(result.ok ? 0 : 1);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { generatePRTemplate, getChangedSpecs, parseSpec };
