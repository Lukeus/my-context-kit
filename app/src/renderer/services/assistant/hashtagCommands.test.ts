import { describe, it, expect } from 'vitest';
import {
  parseHashtagCommands,
  getHashtagSuggestions,
  getCurrentHashtag,
  HASHTAG_COMMANDS,
} from './hashtagCommands';

describe('parseHashtagCommands', () => {
  it('should parse single hashtag command', () => {
    const result = parseHashtagCommands('#validate');

    expect(result.hasCommands).toBe(true);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].hashtag).toBe('#validate');
    expect(result.commands[0].tool).toBe('pipeline.validate');
  });

  it('should parse hashtag with arguments', () => {
    const result = parseHashtagCommands('#search authentication');

    expect(result.hasCommands).toBe(true);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].tool).toBe('context.search');
    expect(result.commands[0].parameters.query).toBe('authentication');
  });

  it('should parse multiple hashtag commands', () => {
    const result = parseHashtagCommands('#validate and #graph');

    expect(result.hasCommands).toBe(true);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].tool).toBe('pipeline.validate');
    expect(result.commands[1].tool).toBe('pipeline.build-graph');
  });

  it('should remove hashtag commands from cleaned message', () => {
    const result = parseHashtagCommands('Please #validate the repository');

    expect(result.cleanedMessage).toBe('Please the repository');
    expect(result.hasCommands).toBe(true);
  });

  it('should handle message with only hashtag commands', () => {
    const result = parseHashtagCommands('#validate #graph');

    expect(result.cleanedMessage).toBe('#validate #graph'); // Falls back to original if empty
    expect(result.hasCommands).toBe(true);
    expect(result.commands).toHaveLength(2);
  });

  it('should parse #impact with entity ID', () => {
    const result = parseHashtagCommands('#impact feat-001');

    expect(result.commands[0].tool).toBe('pipeline.impact');
    expect(result.commands[0].parameters.entityId).toBe('feat-001');
  });

  it('should parse #read with file path', () => {
    const result = parseHashtagCommands('#read contexts/features/auth.yaml');

    expect(result.commands[0].tool).toBe('context.read');
    expect(result.commands[0].parameters.path).toBe('contexts/features/auth.yaml');
  });

  it('should parse #generate with template name', () => {
    const result = parseHashtagCommands('#generate spec-template');

    expect(result.commands[0].tool).toBe('pipeline.generate');
    expect(result.commands[0].parameters.template).toBe('spec-template');
  });

  it('should handle mixed text and commands', () => {
    const result = parseHashtagCommands('Can you #validate and then #search login features?');

    expect(result.cleanedMessage).toContain('Can you');
    expect(result.cleanedMessage).toContain('features?');
    expect(result.commands).toHaveLength(2);
  });

  it('should ignore invalid hashtags', () => {
    const result = parseHashtagCommands('#invalid #validate');

    expect(result.hasCommands).toBe(true);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].hashtag).toBe('#validate');
  });

  it('should be case-insensitive for hashtag matching', () => {
    const result = parseHashtagCommands('#VALIDATE');

    expect(result.hasCommands).toBe(true);
    expect(result.commands[0].tool).toBe('pipeline.validate');
  });

  it('should handle hashtags at the beginning of message', () => {
    const result = parseHashtagCommands('#validate this repository');

    expect(result.commands[0].tool).toBe('pipeline.validate');
    expect(result.cleanedMessage).toBe('this repository');
  });

  it('should handle hashtags at the end of message', () => {
    const result = parseHashtagCommands('Please #validate');

    expect(result.commands[0].tool).toBe('pipeline.validate');
    expect(result.cleanedMessage).toBe('Please');
  });

  it('should return original message if no commands found', () => {
    const result = parseHashtagCommands('Just a regular message');

    expect(result.hasCommands).toBe(false);
    expect(result.commands).toHaveLength(0);
    expect(result.cleanedMessage).toBe('Just a regular message');
  });

  it('should clean up multiple spaces', () => {
    const result = parseHashtagCommands('Please   #validate   the   repository');

    expect(result.cleanedMessage).toBe('Please the repository');
  });
});

describe('getHashtagSuggestions', () => {
  it('should return all suggestions for # input', () => {
    const suggestions = getHashtagSuggestions('#');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.hashtag === '#validate')).toBe(true);
    expect(suggestions.some((s) => s.hashtag === '#search')).toBe(true);
  });

  it('should filter suggestions by partial match', () => {
    const suggestions = getHashtagSuggestions('#val');

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].hashtag).toBe('#validate');
  });

  it('should filter suggestions by prefix', () => {
    const suggestions = getHashtagSuggestions('#se');

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].hashtag).toBe('#search');
  });

  it('should return empty array for no matches', () => {
    const suggestions = getHashtagSuggestions('#xyz');

    expect(suggestions).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const suggestions = getHashtagSuggestions('#VAL');

    expect(suggestions.length).toBe(1);
    expect(suggestions[0].hashtag).toBe('#validate');
  });

  it('should include description and tool in suggestions', () => {
    const suggestions = getHashtagSuggestions('#graph');

    expect(suggestions[0].description).toBeDefined();
    expect(suggestions[0].tool).toBe('pipeline.build-graph');
  });

  it('should return multiple matches for partial input', () => {
    // Both #generate and #graph start with #g
    const suggestions = getHashtagSuggestions('#g');

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getCurrentHashtag', () => {
  it('should extract hashtag at cursor position', () => {
    const text = 'Hello #val';
    const cursorPos = text.length; // At the end

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBe('#val');
  });

  it('should extract hashtag in middle of text', () => {
    const text = 'Please #searc more text';
    const cursorPos = 13; // After 'searc'

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBe('#searc');
  });

  it('should return null when cursor not on hashtag', () => {
    const text = 'Hello world';
    const cursorPos = 5;

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBeNull();
  });

  it('should return null when cursor before hashtag', () => {
    const text = 'Hello #validate';
    const cursorPos = 3; // In 'Hello'

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBeNull();
  });

  it('should handle cursor at start of hashtag', () => {
    const text = '#validate';
    const cursorPos = 1; // Right after #

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBe('#');
  });

  it('should handle multiple hashtags', () => {
    const text = '#validate #search authentication';
    const cursorPos = 17; // In '#search'

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBe('#search');
  });

  it('should stop at newline', () => {
    const text = 'Line 1\n#val';
    const cursorPos = text.length;

    const hashtag = getCurrentHashtag(text, cursorPos);

    expect(hashtag).toBe('#val');
  });
});

describe('HASHTAG_COMMANDS', () => {
  it('should contain all expected commands', () => {
    const expectedCommands = [
      '#validate',
      '#search',
      '#graph',
      '#impact',
      '#generate',
      '#embeddings',
      '#read',
    ];

    for (const cmd of expectedCommands) {
      expect(HASHTAG_COMMANDS[cmd]).toBeDefined();
    }
  });

  it('should have tool mappings for all commands', () => {
    for (const cmd of Object.values(HASHTAG_COMMANDS)) {
      expect(cmd.tool).toBeDefined();
      expect(cmd.tool.length).toBeGreaterThan(0);
    }
  });

  it('should have descriptions for all commands', () => {
    for (const cmd of Object.values(HASHTAG_COMMANDS)) {
      expect(cmd.description).toBeDefined();
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });

  it('should map to correct tool IDs', () => {
    expect(HASHTAG_COMMANDS['#validate'].tool).toBe('pipeline.validate');
    expect(HASHTAG_COMMANDS['#search'].tool).toBe('context.search');
    expect(HASHTAG_COMMANDS['#graph'].tool).toBe('pipeline.build-graph');
    expect(HASHTAG_COMMANDS['#impact'].tool).toBe('pipeline.impact');
    expect(HASHTAG_COMMANDS['#generate'].tool).toBe('pipeline.generate');
    expect(HASHTAG_COMMANDS['#embeddings'].tool).toBe('pipeline.build-embeddings');
    expect(HASHTAG_COMMANDS['#read'].tool).toBe('context.read');
  });
});
