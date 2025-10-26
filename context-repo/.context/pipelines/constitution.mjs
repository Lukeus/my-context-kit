#!/usr/bin/env node

/**
 * Constitution Pipeline - SDD Governance Engine
 * 
 * Parses and enforces constitutional articles from memory/constitution.md
 * Validates implementation plans against the 9 articles of development
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

// The 9 Articles of Development (from SDD spec.md)
const ARTICLES = {
  I: {
    title: 'Library-First Principle',
    description: 'Every feature must begin as a standalone library',
    gates: [
      { id: 'lib-first', check: 'Feature implemented as library?', critical: true },
      { id: 'no-inline', check: 'No direct implementation in app code?', critical: true },
    ],
  },
  II: {
    title: 'CLI Interface Mandate',
    description: 'Every library must expose functionality through CLI',
    gates: [
      { id: 'cli-exists', check: 'CLI interface exists?', critical: true },
      { id: 'text-io', check: 'Accepts text input / produces text output?', critical: true },
      { id: 'json-support', check: 'Supports JSON format?', critical: false },
    ],
  },
  III: {
    title: 'Test-First Imperative',
    description: 'No code before tests (TDD)',
    gates: [
      { id: 'tests-written', check: 'Unit tests written before implementation?', critical: true },
      { id: 'tests-approved', check: 'Tests validated and approved?', critical: true },
      { id: 'red-phase', check: 'Tests confirmed to FAIL (Red phase)?', critical: true },
    ],
  },
  IV: {
    title: 'Dependency Declarations',
    description: 'All dependencies explicitly declared',
    gates: [
      { id: 'deps-declared', check: 'All dependencies in package.json/requirements?', critical: true },
      { id: 'no-globals', check: 'No undeclared global dependencies?', critical: true },
    ],
  },
  V: {
    title: 'Interface Contracts',
    description: 'Explicit contracts for all interfaces',
    gates: [
      { id: 'contracts-defined', check: 'Interface contracts defined?', critical: true },
      { id: 'contract-tests', check: 'Contract tests exist?', critical: true },
    ],
  },
  VI: {
    title: 'Observability Requirements',
    description: 'All functionality must be observable',
    gates: [
      { id: 'logging', check: 'Structured logging implemented?', critical: false },
      { id: 'metrics', check: 'Key metrics exposed?', critical: false },
      { id: 'tracing', check: 'Trace IDs propagated?', critical: false },
    ],
  },
  VII: {
    title: 'Simplicity Gate',
    description: 'Minimize project structure and complexity',
    gates: [
      { id: 'max-projects', check: 'Using ≤3 projects?', critical: true },
      { id: 'no-future-proof', check: 'No future-proofing?', critical: true },
      { id: 'justified-complexity', check: 'Complexity documented if >3 projects?', critical: false },
    ],
  },
  VIII: {
    title: 'Anti-Abstraction Gate',
    description: 'Use frameworks directly, avoid unnecessary layers',
    gates: [
      { id: 'framework-direct', check: 'Using framework directly?', critical: true },
      { id: 'single-model', check: 'Single model representation?', critical: true },
      { id: 'no-wrappers', check: 'No unnecessary wrappers/adapters?', critical: false },
    ],
  },
  IX: {
    title: 'Integration-First Gate',
    description: 'Test in realistic environments',
    gates: [
      { id: 'real-db', check: 'Using real database (not mocks)?', critical: false },
      { id: 'real-services', check: 'Using actual service instances?', critical: false },
      { id: 'contract-tests-first', check: 'Contract tests mandatory before implementation?', critical: true },
    ],
  },
};

/**
 * Parse constitution from YAML file
 * @param {string} constitutionPath - Path to constitution.yaml
 * @returns {object} - Parsed constitution with principles
 */
async function parseConstitution(constitutionPath) {
  try {
    const content = await fs.readFile(constitutionPath, 'utf-8');
    
    // Try parsing as YAML first
    try {
      const { parse: parseYAML } = await import('yaml');
      const constitution = parseYAML(content);
      
      if (constitution && constitution.principles) {
        // Map YAML principles to our gate structure
        const articles = {};
        
        constitution.principles.forEach((principle, index) => {
          const romanNum = toRoman(index + 1);
          articles[romanNum] = {
            number: romanNum,
            id: principle.id,
            title: principle.title,
            summary: principle.summary,
            body: principle.details || principle.summary,
            requirements: principle.requirements || [],
            appliesTo: principle.appliesTo || [],
            nonNegotiable: principle.nonNegotiable,
            gates: ARTICLES[romanNum]?.gates || [],
          };
        });
        
        return {
          ok: true,
          constitution,
          articles,
          totalArticles: Object.keys(articles).length,
        };
      }
    } catch (yamlError) {
      // Fall through to markdown parsing
    }
    
    // Fallback: Parse as markdown (for SDD constitution.md)
    const articles = {};
    const articlePattern = /##\s+Article\s+([IVXLCDM]+):\s+(.+)\n([\s\S]*?)(?=##\s+Article\s+|$)/gi;
    
    let match;
    while ((match = articlePattern.exec(content)) !== null) {
      const [, number, title, body] = match;
      
      // Extract key requirements from article body
      const requirements = extractRequirements(body);
      
      articles[number] = {
        number,
        title: title.trim(),
        body: body.trim(),
        requirements,
        gates: ARTICLES[number]?.gates || [],
      };
    }
    
    return {
      ok: true,
      articles,
      totalArticles: Object.keys(articles).length,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

/**
 * Convert number to Roman numerals
 */
function toRoman(num) {
  const lookup = {
    X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let roman = '';
  for (let key in lookup) {
    while (num >= lookup[key]) {
      roman += key;
      num -= lookup[key];
    }
  }
  return roman;
}

/**
 * Extract requirements from article body
 */
function extractRequirements(body) {
  const requirements = [];
  
  // Look for bullet points, numbered lists, and "MUST" statements
  const mustStatements = body.match(/(?:MUST|SHALL|REQUIRED)[\s\S]*?(?=\n\n|\n-|\n\d+\.|\n##|$)/gi);
  if (mustStatements) {
    requirements.push(...mustStatements.map(s => s.trim()));
  }
  
  // Look for explicit rules
  const rulePattern = /-\s+(.+?)(?:\n|$)/g;
  let ruleMatch;
  while ((ruleMatch = rulePattern.exec(body)) !== null) {
    const rule = ruleMatch[1].trim();
    if (rule.length > 10 && (rule.includes('must') || rule.includes('shall') || rule.includes('require'))) {
      requirements.push(rule);
    }
  }
  
  return requirements;
}

/**
 * Validate implementation plan against constitution
 * @param {string} planPath - Path to plan.md file
 * @param {object} constitution - Parsed constitution
 * @returns {object} - Validation results with gate status
 */
async function validatePlan(planPath, constitution) {
  try {
    const planContent = await fs.readFile(planPath, 'utf-8');
    
    const results = {
      passed: true,
      gates: {},
      violations: [],
      warnings: [],
    };
    
    // Check each article's gates
    for (const [articleNum, article] of Object.entries(constitution.articles)) {
      const gateResults = {
        article: articleNum,
        title: article.title,
        passed: true,
        checks: [],
      };
      
      for (const gate of article.gates) {
        const checkResult = performGateCheck(planContent, articleNum, gate);
        gateResults.checks.push(checkResult);
        
        if (!checkResult.passed && gate.critical) {
          gateResults.passed = false;
          results.passed = false;
          results.violations.push({
            article: articleNum,
            gate: gate.id,
            message: `Critical gate failed: ${gate.check}`,
          });
        } else if (!checkResult.passed && !gate.critical) {
          results.warnings.push({
            article: articleNum,
            gate: gate.id,
            message: `Warning: ${gate.check}`,
          });
        }
      }
      
      results.gates[articleNum] = gateResults;
    }
    
    return {
      ok: true,
      results,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

/**
 * Perform individual gate check
 */
function performGateCheck(planContent, articleNum, gate) {
  const result = {
    id: gate.id,
    check: gate.check,
    passed: false,
    evidence: null,
    critical: gate.critical,
  };
  
  // Article-specific checks
  switch (articleNum) {
    case 'III': // Test-First
      if (gate.id === 'tests-written') {
        result.passed = /test|spec|TDD/i.test(planContent);
        result.evidence = result.passed ? 'Tests mentioned in plan' : 'No test references found';
      } else if (gate.id === 'red-phase') {
        result.passed = /red.*phase|fail.*first|TDD/i.test(planContent);
        result.evidence = result.passed ? 'Red phase mentioned' : 'Red phase not confirmed';
      }
      break;
      
    case 'VII': // Simplicity
      if (gate.id === 'max-projects') {
        // Look for project count mentions
        const projectMatch = planContent.match(/(\d+)\s+projects?/i);
        if (projectMatch) {
          const count = parseInt(projectMatch[1], 10);
          result.passed = count <= 3;
          result.evidence = `${count} projects detected`;
        } else {
          result.passed = true; // Assume pass if not mentioned
          result.evidence = 'Project count not specified';
        }
      } else if (gate.id === 'no-future-proof') {
        result.passed = !/future[-\s]proof/i.test(planContent);
        result.evidence = result.passed ? 'No future-proofing detected' : 'Future-proofing found';
      }
      break;
      
    case 'VIII': // Anti-Abstraction
      if (gate.id === 'framework-direct') {
        result.passed = !/wrapper|adapter.*class|facade/i.test(planContent) || /justification/i.test(planContent);
        result.evidence = result.passed ? 'Using framework directly or justified' : 'Abstraction layers detected';
      }
      break;
      
    case 'IX': // Integration-First
      if (gate.id === 'contract-tests-first') {
        result.passed = /contract.*test|test.*contract/i.test(planContent);
        result.evidence = result.passed ? 'Contract tests mentioned' : 'No contract test references';
      }
      break;
      
    default:
      // Generic check: look for keywords in plan
      const keywords = gate.check.toLowerCase().split(' ').filter(w => w.length > 3);
      result.passed = keywords.some(kw => planContent.toLowerCase().includes(kw));
      result.evidence = result.passed ? 'Keywords found in plan' : 'Keywords not found';
  }
  
  return result;
}

/**
 * Generate compliance report
 */
function generateComplianceReport(validationResults) {
  const report = {
    summary: {
      totalArticles: Object.keys(validationResults.results.gates).length,
      passed: validationResults.results.passed,
      violations: validationResults.results.violations.length,
      warnings: validationResults.results.warnings.length,
    },
    gates: validationResults.results.gates,
    violations: validationResults.results.violations,
    warnings: validationResults.results.warnings,
  };
  
  return report;
}

/**
 * CLI interface
 */
async function main() {
  const [, , command, ...args] = process.argv;
  
  if (!command) {
    console.error('Usage: node constitution.mjs <command> [args]');
    console.error('Commands:');
    console.error('  parse <constitutionPath>     - Parse constitution file');
    console.error('  validate <planPath>          - Validate plan against constitution');
    console.error('  report <planPath>            - Generate compliance report');
    process.exit(1);
  }
  
  let result;
  
  switch (command) {
    case 'parse': {
      const constitutionPath = args[0] || path.join(REPO_ROOT, 'contexts', 'governance', 'constitution.yaml');
      result = await parseConstitution(constitutionPath);
      break;
    }
    
    case 'validate': {
      const planPath = path.join(REPO_ROOT, args[0]);
      const constitutionPath = args[1] || path.join(REPO_ROOT, 'contexts', 'governance', 'constitution.yaml');
      
      const constitution = await parseConstitution(constitutionPath);
      if (!constitution.ok) {
        result = constitution;
        break;
      }
      
      result = await validatePlan(planPath, constitution);
      break;
    }
    
    case 'report': {
      const planPath = path.join(REPO_ROOT, args[0]);
      const constitutionPath = args[1] || path.join(REPO_ROOT, 'contexts', 'governance', 'constitution.yaml');
      
      const constitution = await parseConstitution(constitutionPath);
      if (!constitution.ok) {
        result = constitution;
        break;
      }
      
      const validation = await validatePlan(planPath, constitution);
      if (!validation.ok) {
        result = validation;
        break;
      }
      
      result = {
        ok: true,
        report: generateComplianceReport(validation),
      };
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { parseConstitution, validatePlan, generateComplianceReport, ARTICLES };
