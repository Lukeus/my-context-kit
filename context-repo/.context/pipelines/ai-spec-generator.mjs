#!/usr/bin/env node

/**
 * AI-Powered Spec Generator
 * 
 * Generates high-quality feature specifications from natural language descriptions
 * Includes constitutional compliance checks and [NEEDS CLARIFICATION] markers
 */

import { callProvider } from './ai-common.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { withErrorHandling, ErrorCodes } from './lib/error-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * System prompt for spec generation
 */
const SPEC_GENERATION_PROMPT = `You are an expert technical specification writer following Specification-Driven Development (SDD) principles.

Your task is to generate a feature specification from the user's description. The specification should:

1. **Focus on WHAT, not HOW**: Describe what the feature does and why it's needed, NOT implementation details
2. **Be clear and unambiguous**: Avoid vague language
3. **Use [NEEDS CLARIFICATION]**: Mark any areas that need more information
4. **Include constitutional considerations**: Consider the 9 articles of the development constitution

Output your response as a JSON object with this structure:
{
  "title": "Clear, concise feature title",
  "overview": "High-level overview of the feature (2-3 sentences)",
  "userStories": [
    {
      "asA": "user role",
      "iWant": "capability",
      "soThat": "benefit"
    }
  ],
  "acceptanceCriteria": [
    "Measurable criterion 1",
    "Measurable criterion 2"
  ],
  "nonFunctionalRequirements": {
    "performance": "Performance requirement or [NEEDS CLARIFICATION]",
    "security": "Security requirement or [NEEDS CLARIFICATION]",
    "accessibility": "Accessibility requirement or [NEEDS CLARIFICATION]"
  },
  "constraints": [
    "Known constraint 1",
    "Known constraint 2"
  ],
  "outOfScope": [
    "What this feature will NOT include"
  ],
  "constitutionalConsiderations": {
    "simplicity": "Does this use ≤3 projects? Any concerns?",
    "antiAbstraction": "Are we using frameworks directly?",
    "integrationFirst": "Are contracts needed?"
  },
  "clarificationQuestions": [
    "Question 1 about ambiguous requirements",
    "Question 2 about edge cases"
  ]
}

Be thorough but concise. Use [NEEDS CLARIFICATION] for anything uncertain.`;

/**
 * Generate a specification from natural language description
 * 
 * @param {string} description - User's feature description
 * @param {object} options - { provider, endpoint, model, apiKey }
 * @returns {object} - Structured specification data
 */
async function generateSpec(description, options = {}) {
  try {
    const {
      provider = 'ollama',
      endpoint = 'http://localhost:11434',
      model = 'qwen2.5-coder:7b',
      apiKey = ''
    } = options;

    // Load AI config if options not provided
    let finalProvider = provider;
    let finalEndpoint = endpoint;
    let finalModel = model;
    let finalApiKey = apiKey;

    if (!apiKey) {
      try {
        const configPath = path.join(REPO_ROOT, '.context', 'ai-config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        
        if (config.provider) {
          finalProvider = config.provider;
          finalEndpoint = config.endpoint || endpoint;
          finalModel = config.model || model;
        }
      } catch {
        // Use defaults if config not found
      }
    }

    // Call AI to generate spec
    const result = await callProvider({
      provider: finalProvider,
      endpoint: finalEndpoint,
      model: finalModel,
      apiKey: finalApiKey,
      systemPrompt: SPEC_GENERATION_PROMPT,
      userPrompt: `Generate a feature specification for:\n\n${description}\n\nProvide JSON output:`,
      responseFormat: 'json',
      temperature: 0.7,
      maxTokens: 3000,
    });

    if (!result.ok) {
      return result;
    }

    // Parse JSON response
    let content = result.content.trim();
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }

    const specData = JSON.parse(content);

    // Validate required fields
    if (!specData.title) {
      return {
        ok: false,
        error: 'AI response missing required field: title',
        rawContent: result.content,
      };
    }

    return {
      ok: true,
      spec: specData,
      usage: result.usage,
    };

  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Refine an existing specification with AI suggestions
 * 
 * @param {string} currentSpec - Current spec markdown content
 * @param {string} userFeedback - User's feedback or questions
 * @param {object} options - { provider, endpoint, model, apiKey }
 * @returns {object} - Refined specification data
 */
async function refineSpec(currentSpec, userFeedback, options = {}) {
  try {
    const {
      provider = 'ollama',
      endpoint = 'http://localhost:11434',
      model = 'qwen2.5-coder:7b',
      apiKey = ''
    } = options;

    const refinementPrompt = `You are refining a feature specification based on user feedback.

Current specification:
${currentSpec}

User feedback:
${userFeedback}

Provide an updated specification that addresses the feedback. Output JSON with the same structure as before.

Focus on:
1. Addressing the user's concerns or questions
2. Adding missing details
3. Clarifying ambiguous sections
4. Removing or updating [NEEDS CLARIFICATION] markers where appropriate

Output JSON:`;

    const result = await callProvider({
      provider,
      endpoint,
      model,
      apiKey,
      systemPrompt: SPEC_GENERATION_PROMPT,
      userPrompt: refinementPrompt,
      responseFormat: 'json',
      temperature: 0.7,
      maxTokens: 3000,
    });

    if (!result.ok) {
      return result;
    }

    // Parse JSON response
    let content = result.content.trim();
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }

    const specData = JSON.parse(content);

    return {
      ok: true,
      spec: specData,
      usage: result.usage,
    };

  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Convert structured spec data to markdown format
 * 
 * @param {object} specData - Structured specification data
 * @param {string} specNumber - Spec number (e.g., "001")
 * @param {string} branchName - Branch name
 * @returns {string} - Markdown formatted specification
 */
function specToMarkdown(specData, specNumber, branchName) {
  const date = new Date().toISOString().split('T')[0];

  let markdown = `# Feature Specification: ${specData.title}\n\n`;
  markdown += `**Spec Number**: ${specNumber}  \n`;
  markdown += `**Branch**: \`${branchName}\`  \n`;
  markdown += `**Date**: ${date}  \n`;
  markdown += `**Status**: Draft\n\n`;

  markdown += `## Overview\n\n`;
  markdown += `${specData.overview || '[NEEDS CLARIFICATION: Provide a high-level overview]'}\n\n`;

  markdown += `## What (Not How)\n\n`;
  markdown += `- ✅ Focus on WHAT users need and WHY\n`;
  markdown += `- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)\n\n`;

  markdown += `## User Stories\n\n`;
  if (specData.userStories && specData.userStories.length > 0) {
    specData.userStories.forEach(story => {
      markdown += `- As a ${story.asA}, I want ${story.iWant}, so that ${story.soThat}\n`;
    });
  } else {
    markdown += `[NEEDS CLARIFICATION: Add user stories]\n`;
  }
  markdown += `\n`;

  markdown += `## Acceptance Criteria\n\n`;
  if (specData.acceptanceCriteria && specData.acceptanceCriteria.length > 0) {
    specData.acceptanceCriteria.forEach(criterion => {
      markdown += `- ${criterion}\n`;
    });
  } else {
    markdown += `[NEEDS CLARIFICATION: Define measurable success criteria]\n`;
  }
  markdown += `\n`;

  markdown += `## Non-Functional Requirements\n\n`;
  if (specData.nonFunctionalRequirements) {
    markdown += `- **Performance**: ${specData.nonFunctionalRequirements.performance || '[NEEDS CLARIFICATION]'}\n`;
    markdown += `- **Security**: ${specData.nonFunctionalRequirements.security || '[NEEDS CLARIFICATION]'}\n`;
    markdown += `- **Accessibility**: ${specData.nonFunctionalRequirements.accessibility || '[NEEDS CLARIFICATION]'}\n`;
  } else {
    markdown += `- **Performance**: [NEEDS CLARIFICATION]\n`;
    markdown += `- **Security**: [NEEDS CLARIFICATION]\n`;
    markdown += `- **Accessibility**: [NEEDS CLARIFICATION]\n`;
  }
  markdown += `\n`;

  markdown += `## Constraints & Assumptions\n\n`;
  if (specData.constraints && specData.constraints.length > 0) {
    specData.constraints.forEach(constraint => {
      markdown += `- ${constraint}\n`;
    });
  } else {
    markdown += `[NEEDS CLARIFICATION: List any known constraints or assumptions]\n`;
  }
  markdown += `\n`;

  markdown += `## Out of Scope\n\n`;
  if (specData.outOfScope && specData.outOfScope.length > 0) {
    specData.outOfScope.forEach(item => {
      markdown += `- ${item}\n`;
    });
  } else {
    markdown += `[NEEDS CLARIFICATION: Explicitly state what this feature will NOT include]\n`;
  }
  markdown += `\n`;

  markdown += `## Constitutional Compliance Checklist\n\n`;
  markdown += `### Simplicity Gate (Article VII)\n`;
  markdown += `- [ ] Using ≤3 projects?\n`;
  markdown += `- [ ] No future-proofing?\n\n`;
  
  markdown += `### Anti-Abstraction Gate (Article VIII)\n`;
  markdown += `- [ ] Using framework directly?\n`;
  markdown += `- [ ] Single model representation?\n\n`;
  
  markdown += `### Integration-First Gate (Article IX)\n`;
  markdown += `- [ ] Contracts defined?\n`;
  markdown += `- [ ] Real environment testing planned?\n\n`;

  if (specData.constitutionalConsiderations) {
    markdown += `### Initial Assessment\n\n`;
    markdown += `- **Simplicity**: ${specData.constitutionalConsiderations.simplicity || 'TBD'}\n`;
    markdown += `- **Anti-Abstraction**: ${specData.constitutionalConsiderations.antiAbstraction || 'TBD'}\n`;
    markdown += `- **Integration-First**: ${specData.constitutionalConsiderations.integrationFirst || 'TBD'}\n\n`;
  }

  if (specData.clarificationQuestions && specData.clarificationQuestions.length > 0) {
    markdown += `## Clarification Questions\n\n`;
    specData.clarificationQuestions.forEach(question => {
      markdown += `- ${question}\n`;
    });
    markdown += `\n`;
  }

  markdown += `---\n\n`;
  markdown += `**Review Checklist:**\n`;
  markdown += `- [ ] No \`[NEEDS CLARIFICATION]\` markers remain\n`;
  markdown += `- [ ] Requirements are testable and unambiguous\n`;
  markdown += `- [ ] Success criteria are measurable\n`;
  markdown += `- [ ] Constitutional gates are addressed\n`;

  return markdown;
}

// ===== CLI Interface =====

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command) {
    console.error('Usage: node ai-spec-generator.mjs <command> [args]');
    console.error('Commands:');
    console.error('  generate <description>  - Generate spec from description');
    console.error('  refine <specPath> <feedback> - Refine existing spec');
    process.exit(1);
  }

  let result;

  switch (command) {
    case 'generate':
      result = await generateSpec(args.join(' '));
      break;
    case 'refine':
      const specPath = args[0];
      const feedback = args.slice(1).join(' ');
      const currentSpec = await fs.readFile(specPath, 'utf-8');
      result = await refineSpec(currentSpec, feedback);
      break;
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

export { generateSpec, refineSpec, specToMarkdown };
