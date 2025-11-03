// Large Output Summarizer (T026)
// -----------------------------------------------------------------------------
// Provides intelligent truncation and summarization of large tool outputs.
// Prevents UI performance degradation from massive JSON/text responses.
// TODO(T026-UI): Add "Show Full Output" expansion control in ToolResult.vue.
// TODO(T026-ML): Consider LLM-based summarization for complex outputs.

export interface SummarizationOptions {
  maxChars?: number;
  maxLines?: number;
  maxArrayItems?: number;
  maxObjectDepth?: number;
  preserveStructure?: boolean;
}

export interface SummarizedOutput {
  summary: string;
  truncated: boolean;
  originalSize: number;
  summarySize: number;
  format: 'json' | 'text' | 'unknown';
  stats?: {
    linesRemoved?: number;
    objectsFlattened?: number;
    arraysShortened?: number;
  };
}

const DEFAULT_MAX_CHARS = 5000;
const DEFAULT_MAX_LINES = 100;
const DEFAULT_MAX_ARRAY_ITEMS = 10;
const DEFAULT_MAX_OBJECT_DEPTH = 3;

/**
 * Summarize large output for display.
 */
export function summarizeOutput(
  output: unknown,
  options: SummarizationOptions = {}
): SummarizedOutput {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  
  // Detect format
  const format = detectFormat(output);
  const originalText = format === 'json' 
    ? JSON.stringify(output, null, 2)
    : String(output);
  
  const originalSize = originalText.length;
  
  // Check if summarization needed
  if (originalSize <= maxChars && countLines(originalText) <= maxLines) {
    return {
      summary: originalText,
      truncated: false,
      originalSize,
      summarySize: originalSize,
      format
    };
  }
  
  // Perform summarization based on format
  let summary: string;
  let stats: SummarizedOutput['stats'];
  
  if (format === 'json') {
    const result = summarizeJSON(output, options);
    summary = result.summary;
    stats = result.stats;
  } else {
    const result = summarizeText(originalText, options);
    summary = result.summary;
    stats = result.stats;
  }
  
  return {
    summary,
    truncated: true,
    originalSize,
    summarySize: summary.length,
    format,
    stats
  };
}

/**
 * Detect output format.
 */
function detectFormat(output: unknown): 'json' | 'text' | 'unknown' {
  if (output === null || output === undefined) return 'text';
  if (typeof output === 'object') return 'json';
  if (typeof output === 'string') {
    try {
      JSON.parse(output);
      return 'json';
    } catch {
      return 'text';
    }
  }
  return 'text';
}

/**
 * Summarize JSON output.
 */
function summarizeJSON(
  data: unknown,
  options: SummarizationOptions
): { summary: string; stats: SummarizedOutput['stats'] } {
  const maxDepth = options.maxObjectDepth ?? DEFAULT_MAX_OBJECT_DEPTH;
  const maxArrayItems = options.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS;
  
  let arraysShortened = 0;
  let objectsFlattened = 0;
  
  function truncate(obj: unknown, depth: number): unknown {
    if (depth >= maxDepth) {
      if (typeof obj === 'object' && obj !== null) {
        objectsFlattened++;
        return Array.isArray(obj) ? '[...]' : '{...}';
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      if (obj.length > maxArrayItems) {
        arraysShortened++;
        return [
          ...obj.slice(0, maxArrayItems).map(item => truncate(item, depth + 1)),
          `... ${obj.length - maxArrayItems} more items`
        ];
      }
      return obj.map(item => truncate(item, depth + 1));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj);
      const result: Record<string, unknown> = {};
      
      for (const [key, value] of entries) {
        result[key] = truncate(value, depth + 1);
      }
      
      return result;
    }
    
    return obj;
  }
  
  const truncated = truncate(data, 0);
  const summary = JSON.stringify(truncated, null, 2);
  
  return {
    summary,
    stats: { arraysShortened, objectsFlattened }
  };
}

/**
 * Summarize text output.
 */
function summarizeText(
  text: string,
  options: SummarizationOptions
): { summary: string; stats: SummarizedOutput['stats'] } {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  
  const lines = text.split('\n');
  let linesRemoved = 0;
  
  // Truncate by lines first
  let result = lines;
  if (lines.length > maxLines) {
    linesRemoved = lines.length - maxLines;
    result = lines.slice(0, maxLines);
    result.push(`\n... ${linesRemoved} more lines`);
  }
  
  let summary = result.join('\n');
  
  // Truncate by characters if still too long
  if (summary.length > maxChars) {
    summary = summary.substring(0, maxChars) + '\n... truncated';
  }
  
  return {
    summary,
    stats: { linesRemoved }
  };
}

/**
 * Count lines in text.
 */
function countLines(text: string): number {
  return text.split('\n').length;
}

/**
 * Check if output needs summarization.
 */
export function needsSummarization(output: unknown, options: SummarizationOptions = {}): boolean {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  
  return text.length > maxChars || countLines(text) > maxLines;
}

/**
 * Format size for display.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get summarization statistics message.
 */
export function getSummaryMessage(result: SummarizedOutput): string {
  if (!result.truncated) {
    return 'Full output';
  }
  
  const saved = result.originalSize - result.summarySize;
  const percentage = Math.round((saved / result.originalSize) * 100);
  
  const parts: string[] = [
    `Summarized (${percentage}% reduction)`
  ];
  
  if (result.stats?.linesRemoved) {
    parts.push(`${result.stats.linesRemoved} lines hidden`);
  }
  
  if (result.stats?.arraysShortened) {
    parts.push(`${result.stats.arraysShortened} arrays shortened`);
  }
  
  if (result.stats?.objectsFlattened) {
    parts.push(`${result.stats.objectsFlattened} objects flattened`);
  }
  
  return parts.join(', ');
}

// Example usage:
// const result = summarizeOutput(largeJsonData, { maxChars: 2000, maxArrayItems: 5 });
// if (result.truncated) {
//   console.log(getSummaryMessage(result));
// }
// console.log(result.summary);
