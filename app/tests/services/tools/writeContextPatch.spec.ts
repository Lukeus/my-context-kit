import { describe, it, expect } from 'vitest';
import { generatePatches } from '~main/services/tools/writeContextPatch';

describe('writeContextPatch.generatePatches', () => {
  it('generates a unified diff for modified file', () => {
    const original = 'line1\nline2\nline3\n';
    const updated = 'line1\nLINE2-modified\nline3\n';

    const patches = generatePatches([{ path: 'docs/example.txt', original, updated }]);

    expect(patches).toHaveLength(1);
    const diff = patches[0].diff;
    expect(diff).toContain('--- a/docs/example.txt');
    expect(diff).toContain('+++ b/docs/example.txt');
    expect(diff).toContain('-line2');
    expect(diff).toContain('+LINE2-modified');
  });

  it('handles new file additions', () => {
    const original = '';
    const updated = 'new content\n';

    const patches = generatePatches([{ path: 'new.txt', original, updated }]);
    expect(patches[0].diff).toContain('+new content');
  });

  it('handles deletions', () => {
    const original = 'only line\n';
    const updated = '';

    const patches = generatePatches([{ path: 'old.txt', original, updated }]);
    expect(patches[0].diff).toContain('-only line');
  });
});
