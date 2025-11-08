# Contracts (Placeholder)

This feature introduces no external API endpoints. Internal scripts & adapters follow in-repo conventions:

## Internal Script Interfaces
- `scan-duplicate-time-helpers.ts` → STDOUT JSON: `{ duplicates: Array<{file:string,line:number}> , count:number }`
- `verify-design-tokens.ts` → STDOUT JSON matching `DesignTokenViolationReport`

## Adapter Interface
- `errorNormalizationAdapter(error: unknown): NormalizedError`

No IPC or HTTP contracts added; any future externalization will define Zod schemas here.
