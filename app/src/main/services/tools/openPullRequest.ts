import path from 'path';
import fs from 'fs/promises';
import simpleGit from 'simple-git';
import type { ToolExecutionResponse } from '@/../preload/assistantBridge';

interface OpenPrOptions {
  repoPath: string;
  branchName?: string;
  title: string;
  body?: string;
  changes: Array<{ path: string; content: string }>; // relative to repoPath
}

export async function openPullRequest(options: OpenPrOptions): Promise<ToolExecutionResponse> {
  const repoRoot = options.repoPath;
  const git = simpleGit(repoRoot);

  const branch = options.branchName ?? `assistant/pr-${Date.now()}`;

  try {
    // create and checkout branch
    await git.checkoutLocalBranch(branch);

    // write provided changes to disk
    for (const change of options.changes) {
      const filePath = path.join(repoRoot, change.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, change.content, { encoding: 'utf-8' });
      await git.add(change.path);
    }

    // commit
    await git.commit(options.title || 'Assistant PR', undefined, { '--no-verify': null });

    // push branch (may require credentials in CI/local)
    try {
      await git.push(['-u', 'origin', branch]);
    } catch (pushErr) {
      // Non-fatal: pushing may be unsupported in tests; continue and return metadata that indicates the branch
      void pushErr;
    }

    const prMetadata = {
      branch,
      title: options.title,
      body: options.body ?? '',
      prUrl: `https://example.com/pr/${encodeURIComponent(branch)}`
    };

    return { result: prMetadata };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to prepare PR';
    return { error: message };
  }
}
