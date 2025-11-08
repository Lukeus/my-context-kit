/**
 * Hashtag Command Parser for AI Assistant
 * GitHub Copilot-style shortcuts for invoking tools
 */

export interface HashtagCommand {
  tool: string;
  parameters?: Record<string, unknown>;
  description: string;
}

// Map of hashtag shortcuts to tool IDs and their default parameters
export const HASHTAG_COMMANDS: Record<string, HashtagCommand> = {
  '#validate': {
    tool: 'pipeline.validate',
    description: 'Validate all YAML entities in the repository',
  },
  '#search': {
    tool: 'context.search',
    description: 'Search for entities by keyword, tag, or type',
  },
  '#graph': {
    tool: 'pipeline.build-graph',
    description: 'Build the complete dependency graph',
  },
  '#impact': {
    tool: 'pipeline.impact',
    description: 'Analyze impact of changes to entities',
  },
  '#generate': {
    tool: 'pipeline.generate',
    description: 'Generate documentation or artifacts',
  },
  '#embeddings': {
    tool: 'pipeline.build-embeddings',
    description: 'Build vector embeddings for semantic search',
  },
  '#read': {
    tool: 'context.read',
    description: 'Read a specific entity by path or ID',
  },
};

export interface ParsedMessage {
  originalMessage: string;
  cleanedMessage: string;
  commands: Array<{
    hashtag: string;
    tool: string;
    parameters: Record<string, unknown>;
  }>;
  hasCommands: boolean;
}

/**
 * Parse a message for hashtag commands
 * Examples:
 *   "#validate" -> Execute pipeline.validate
 *   "#search authentication" -> Execute context.search with query "authentication"
 *   "#impact feat-001" -> Execute pipeline.impact on entity feat-001
 *   "Can you #validate and #search login?" -> Execute both tools
 */
export function parseHashtagCommands(message: string): ParsedMessage {
  const commands: ParsedMessage['commands'] = [];
  let cleanedMessage = message;

  // Find all hashtag commands in the message
  const hashtagRegex = /#(\w+)(?:\s+([^\s#]+(?:\s+[^\s#]+)*))?/g;
  let match;

  while ((match = hashtagRegex.exec(message)) !== null) {
    const fullMatch = match[0]; // e.g., "#search authentication"
    const hashtag = `#${match[1]}`; // e.g., "#search"
    const args = match[2]?.trim(); // e.g., "authentication"

    const command = HASHTAG_COMMANDS[hashtag.toLowerCase()];
    
    if (command) {
      const parameters: Record<string, unknown> = { ...command.parameters };

      // Parse arguments based on tool type
      if (args) {
        switch (command.tool) {
          case 'context.search':
            parameters.query = args;
            break;
          case 'context.read':
            parameters.path = args;
            break;
          case 'pipeline.impact':
            parameters.entityId = args;
            break;
          case 'pipeline.generate':
            parameters.template = args;
            break;
          default:
            // For other tools, pass args as a generic parameter
            parameters.args = args;
        }
      }

      commands.push({
        hashtag,
        tool: command.tool,
        parameters,
      });

      // Remove the hashtag command from the message
      cleanedMessage = cleanedMessage.replace(fullMatch, '').trim();
    }
  }

  // Clean up multiple spaces
  cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();

  return {
    originalMessage: message,
    cleanedMessage: cleanedMessage || message, // If empty, use original
    commands,
    hasCommands: commands.length > 0,
  };
}

/**
 * Get autocomplete suggestions for hashtag commands
 */
export function getHashtagSuggestions(partialInput: string): Array<{
  hashtag: string;
  description: string;
  tool: string;
}> {
  const input = partialInput.toLowerCase();
  
  return Object.entries(HASHTAG_COMMANDS)
    .filter(([hashtag]) => hashtag.startsWith(input))
    .map(([hashtag, command]) => ({
      hashtag,
      description: command.description,
      tool: command.tool,
    }));
}

/**
 * Extract the current hashtag being typed from cursor position
 */
export function getCurrentHashtag(text: string, cursorPosition: number): string | null {
  // Look backwards from cursor to find the start of a hashtag
  let start = cursorPosition - 1;
  while (start >= 0 && text[start] !== ' ' && text[start] !== '\n') {
    start--;
  }
  start++; // Move to the first character after space/newline

  if (start < text.length && text[start] === '#') {
    const end = cursorPosition;
    return text.substring(start, end);
  }

  return null;
}
