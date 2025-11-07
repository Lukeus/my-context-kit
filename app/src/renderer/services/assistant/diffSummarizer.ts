// Diff Summarizer (T017)
// -----------------------------------------------------------------------------
// Provides diff truncation and summarization for context repository diffs to
// prevent telemetry payload bloat and improve UI responsiveness.
// Decision D-006: Prefer summarized diffs in telemetry; full diffs on-demand.
// TODO(T017-UI): Add expand/collapse toggle in DiffViewer component.
// TODO(T017-Stats): Include line addition/deletion counts in summary.

export interface DiffSummary {
  original: string;
  summary: string;
  truncated: boolean;
  stats: DiffStats;
}

export interface DiffStats {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  totalLines: number;
}

export interface DiffSummarizerOptions {
  maxLines?: number;
  maxBytes?: number;
  contextLines?: number;
  includeStats?: boolean;
}

const DEFAULT_MAX_LINES = 500;
const DEFAULT_MAX_BYTES = 100_000; // 100KB
const DEFAULT_CONTEXT_LINES = 3;

/**
 * Summarizes a unified diff by truncating to a size threshold.
 * Returns both original and summary (if truncated), plus metadata.
 */
export function summarizeDiff(diff: string, options: DiffSummarizerOptions = {}): DiffSummary {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const includeStats = options.includeStats ?? true;

  const stats = includeStats ? calculateDiffStats(diff) : {
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
    totalLines: 0
  };

  // Check byte size first
  const byteSize = new Blob([diff]).size;
  if (byteSize <= maxBytes && stats.totalLines <= maxLines) {
    return {
      original: diff,
      summary: diff,
      truncated: false,
      stats
    };
  }

  // Truncate diff
  const lines = diff.split('\n');
  if (lines.length <= maxLines) {
    // Within line limit but over byte limit - take first N bytes
    const truncated = diff.substring(0, maxBytes);
    return {
      original: diff,
      summary: truncated + '\n\n[...truncated for display]',
      truncated: true,
      stats
    };
  }

  // Truncate by lines
  const contextLines = options.contextLines ?? DEFAULT_CONTEXT_LINES;
  const summary = truncateDiffByLines(lines, maxLines, contextLines);
  
  return {
    original: diff,
    summary: summary + '\n\n[...truncated for display]',
    truncated: true,
    stats
  };
}

/**
 * Truncate diff by preserving file headers and context around changes.
 */
function truncateDiffByLines(lines: string[], maxLines: number, contextLines: number): string {
  const result: string[] = [];
  let linesUsed = 0;

  for (let i = 0; i < lines.length && linesUsed < maxLines; i++) {
    const line = lines[i];

    // Always include file headers
    if (line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++')) {
      result.push(line);
      linesUsed++;
      continue;
    }

    // Include hunk headers
    if (line.startsWith('@@')) {
      result.push(line);
      linesUsed++;
      continue;
    }

    // Include changes and limited context
    if (line.startsWith('+') || line.startsWith('-')) {
      // Include change line
      result.push(line);
      linesUsed++;

      // Include context around change
      const contextStart = Math.max(0, i - contextLines);
      const contextEnd = Math.min(lines.length - 1, i + contextLines);
      
      for (let j = contextStart; j < i && linesUsed < maxLines; j++) {
        if (!result.includes(lines[j])) {
          result.push(lines[j]);
          linesUsed++;
        }
      }
      
      for (let j = i + 1; j <= contextEnd && linesUsed < maxLines; j++) {
        if (!result.includes(lines[j])) {
          result.push(lines[j]);
          linesUsed++;
        }
      }
      
      continue;
    }

    // Skip unchanged context beyond our limit
    if (linesUsed >= maxLines - 10) {
      // Save some lines for summary footer
      break;
    }
  }

  return result.join('\n');
}

/**
 * Calculate diff statistics from unified diff format.
 */
export function calculateDiffStats(diff: string): DiffStats {
  const lines = diff.split('\n');
  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      filesChanged++;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      linesRemoved++;
    }
  }

  return {
    filesChanged,
    linesAdded,
    linesRemoved,
    totalLines: lines.length
  };
}

/**
 * Format diff stats as human-readable string.
 */
export function formatDiffStats(stats: DiffStats): string {
  const parts: string[] = [];
  
  if (stats.filesChanged === 1) {
    parts.push('1 file');
  } else if (stats.filesChanged > 1) {
    parts.push(`${stats.filesChanged} files`);
  }
  
  if (stats.linesAdded > 0) {
    parts.push(`+${stats.linesAdded}`);
  }
  
  if (stats.linesRemoved > 0) {
    parts.push(`-${stats.linesRemoved}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'no changes';
}

/**
 * Check if diff should be summarized based on size thresholds.
 */
export function shouldSummarizeDiff(diff: string, options: DiffSummarizerOptions = {}): boolean {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  
  const byteSize = new Blob([diff]).size;
  const lineCount = diff.split('\n').length;
  
  return byteSize > maxBytes || lineCount > maxLines;
}

// Example usage:
// const summary = summarizeDiff(largeDiff, { maxLines: 200, contextLines: 2 });
// if (summary.truncated) {
//   console.log('Showing summary:', summary.summary);
//   console.log('Stats:', formatDiffStats(summary.stats));
// }
