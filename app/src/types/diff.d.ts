/**
 * Local minimal declarations for the 'diff' package used in writeContextPatch.ts.
 * This prevents TypeScript from suggesting installing @types/diff while providing
 * the small surface area we use (diffLines and Change).
 */
declare module 'diff' {
  export interface Change {
    value: string;
    added?: boolean;
    removed?: boolean;
  }

  export function diffLines(oldStr: string, newStr: string, options?: { newlineIsToken?: boolean }): Change[];
}

export {};
