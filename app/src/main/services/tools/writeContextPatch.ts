// Small, local diff implementation (LCS-based) to avoid pulling in the
// 'diff' package or its ambient typings. It returns an array of Change
// objects compatible with the minimal shape we need.
interface Change {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function diffLines(oldStr: string, newStr: string, options?: { newlineIsToken?: boolean }): Change[] {
  const newlineIsToken = Boolean(options?.newlineIsToken);
  const oldLines = oldStr.split(/\r?\n/);
  const newLines = newStr.split(/\r?\n/);

  // Compute LCS table
  const n = oldLines.length;
  const m = newLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; --i) {
    for (let j = m - 1; j >= 0; --j) {
      if (oldLines[i] === newLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Reconstruct diff from LCS
  const changes: Change[] = [];
  let i = 0;
  let j = 0;
  const suffix = newlineIsToken ? '' : '\n';
  const joinLines = (lines: string[]) => lines.join('\n') + suffix;

  const pushEqual = (lines: string[]) => {
    if (lines.length === 0) return;
    changes.push({ value: joinLines(lines) });
  };
  const pushRemoved = (lines: string[]) => {
    if (lines.length === 0) return;
    changes.push({ value: joinLines(lines), removed: true });
  };
  const pushAdded = (lines: string[]) => {
    if (lines.length === 0) return;
    changes.push({ value: joinLines(lines), added: true });
  };

  const equalBuf: string[] = [];
  const removedBuf: string[] = [];
  const addedBuf: string[] = [];

  while (i < n || j < m) {
    if (i < n && j < m && oldLines[i] === newLines[j]) {
      // flush any pending add/remove
      if (removedBuf.length) { pushRemoved(removedBuf.splice(0)); }
      if (addedBuf.length) { pushAdded(addedBuf.splice(0)); }
      equalBuf.push(oldLines[i]);
      i++; j++;
    } else if (j < m && (i === n || dp[i][j + 1] >= (i < n ? dp[i + 1][j] : -1))) {
      // new line added
      if (equalBuf.length) { pushEqual(equalBuf.splice(0)); }
      addedBuf.push(newLines[j]);
      j++;
    } else if (i < n) {
      if (equalBuf.length) { pushEqual(equalBuf.splice(0)); }
      removedBuf.push(oldLines[i]);
      i++;
    } else {
      // fallback
      if (equalBuf.length) { pushEqual(equalBuf.splice(0)); }
      if (removedBuf.length) { pushRemoved(removedBuf.splice(0)); }
      if (addedBuf.length) { pushAdded(addedBuf.splice(0)); }
    }
  }

  // flush any remaining buffers
  if (removedBuf.length) pushRemoved(removedBuf);
  if (addedBuf.length) pushAdded(addedBuf);
  if (equalBuf.length) pushEqual(equalBuf);

  return changes;
}

export interface FilePatch {
  path: string;
  original: string; // original file content (may be empty string if new)
  updated: string; // updated file content
}

export interface PatchResult {
  path: string;
  diff: string; // unified diff-style patch
}

/**
 * Generates a simple unified-style diff for each provided file patch.
 * This is intentionally lightweight and intended for preview in the approval UI.
 */
export function generatePatches(patches: FilePatch[]): PatchResult[] {
  return patches.map(p => ({
    path: p.path,
    diff: renderUnifiedDiff(p.path, p.original, p.updated)
  }));
}

  // Note: Hunk headers (e.g. @@ -a,b +c,d @@) omitted for simplified diff preview.
  // Can be enhanced in future if richer diff view is required for approval UI.

function renderUnifiedDiff(path: string, original: string, updated: string): string {
  const changes: Change[] = diffLines(original, updated,  { newlineIsToken: true });

  const header = `--- a/${path}\n+++ b/${path}\n`;
  const bodyParts: string[] = [];

  for (const change of changes) {
    const lines = change.value.split(/\n/);
    // Remove trailing empty line created by split for trailing newline
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (change.added) {
      for (const line of lines) {
        bodyParts.push(`+${line}`);
      }
    } else if (change.removed) {
      for (const line of lines) {
        bodyParts.push(`-${line}`);
      }
    } else {
      for (const line of lines) {
        bodyParts.push(` ${line}`);
      }
    }
  }

  return header + bodyParts.join('\n') + '\n';
}
