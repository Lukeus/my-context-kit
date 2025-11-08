/**
 * Design Token Validation Types
 * Purpose: Support semantic token verification and violation reporting
 */

import { z } from 'zod';

/**
 * Schema for design token violation reports
 * Used by scripts/verify-design-tokens.ts
 */
export const DesignTokenViolationReportSchema = z.object({
  id: z.string().uuid(),
  generatedAt: z.string().datetime(),
  violations: z.array(
    z.object({
      filePath: z.string(),
      line: z.number().int().positive(),
      rawClass: z.string(),
      suggestedToken: z.string().optional(),
    })
  ),
  total: z.number().int().nonnegative(),
  allowedExceptions: z.array(z.string()),
}).refine(
  (data) => data.total === data.violations.length,
  {
    message: 'total must equal violations.length',
  }
).refine(
  (data) => {
    const violationClasses = new Set(data.violations.map(v => v.rawClass));
    return data.allowedExceptions.every(exc => !violationClasses.has(exc));
  },
  {
    message: 'allowedExceptions entries must not appear in violations.rawClass',
  }
);

export type DesignTokenViolationReport = z.infer<typeof DesignTokenViolationReportSchema>;
