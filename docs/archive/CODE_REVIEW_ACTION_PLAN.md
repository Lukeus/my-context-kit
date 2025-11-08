# Code Review Action Plan - Context-Sync

**Review Date:** 2025-10-29  
**Overall Grade:** B+ (Good, with room for improvement)

## Executive Summary

This document outlines actionable items from the enterprise code review, prioritized by severity and impact on production readiness.

---

## 🔴 P0 - CRITICAL (Fix Before Deployment)

### ✅ 1. Fix TypeScript Compilation Errors
**Status:** ✅ COMPLETE  
**Completed:** 2025-10-29  
**Estimated Effort:** 30 minutes

**Issues:**
- Missing type declarations for 'openai' package (already bundled with openai@6.7.0)
- Missing '@vue/test-utils' package

**Resolution:**
```bash
cd app
pnpm add -D @vue/test-utils
pnpm typecheck  # ✅ Exits with code 0
```

**Files Affected:**
- `src/main/services/providers/azureClient.ts`
- `tests/components/ApprovalDialog.spec.ts`

**Success Criteria:** `pnpm typecheck` exits with code 0

---

### ⏳ 2. Replace Critical `any` Types
**Status:** TODO  
**Assigned:** Development Team  
**Estimated Effort:** 4-6 hours

**Current State:** 163 ESLint warnings for `@typescript-eslint/no-explicit-any`

**Priority Files (Fix First):**
1. `src/main/preload.ts` - IPC handler types
2. `src/renderer/stores/contextStore.ts` - Entity interfaces
3. `src/renderer/stores/aiStore.ts` - AI response types
4. `src/main/ipc/types.ts` - IPC payload types

**Action Items:**
- [ ] Create `src/shared/types/entities.ts` with proper Entity interfaces
- [ ] Create `src/shared/types/ipc.ts` with IPC payload types
- [ ] Replace `[key: string]: any` with proper index signatures
- [ ] Use `unknown` for truly unknown types, then narrow with type guards
- [ ] Update ESLint config to error (not warn) on `any` after fixes

**Example Fix:**
```typescript
// ❌ BEFORE
interface Entity {
  id: string;
  _type: string;
  [key: string]: any;  // Bad!
}

// ✅ AFTER
interface Entity {
  id: string;
  _type: EntityType;
  title?: string;
  name?: string;
  status?: EntityStatus;
  metadata?: Record<string, string | number | boolean>;
}
```

**Success Criteria:** 
- Zero `@typescript-eslint/no-explicit-any` errors
- `pnpm lint` exits with code 0

---

### ✅ 3. Fix CSP Policy for Production
**Status:** ✅ COMPLETE  
**Completed:** 2025-10-29  
**Estimated Effort:** 1 hour

**Resolution:**
- [x] Updated `src/main/index.ts` to use environment-specific CSP
- [x] Added inline documentation explaining why dev needs `unsafe-eval` (Vite HMR)
- [x] Production now uses strict CSP without `unsafe-eval`

**Implementation:**
```typescript
// src/main/index.ts
const csp = process.env.NODE_ENV === 'development'
  ? "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;";

mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [csp]
    }
  });
});
```

**Success Criteria:** 
- Dev mode works with HMR
- Production build has strict CSP (no `unsafe-eval`)

---

## 🟡 P1 - HIGH PRIORITY (Fix Within 1 Sprint)

### 4. Add Logging to Silent Catch Blocks
**Estimated Effort:** 2-3 hours

**Files to Update:**
- `src/renderer/stores/contextStore.ts` (lines 74-78, 102-104, 150-152)
- `src/main/services/ContextBuilderService.ts`
- `src/main/services/providerConfig.ts`

**Pattern:**
```typescript
// ❌ BEFORE
catch {
  // Ignore cleanup errors silently
}

// ✅ AFTER
catch (error) {
  logger.debug({ 
    service: 'ContextStore', 
    method: 'stopRepoWatch',
    error: error instanceof Error ? error.message : 'Unknown error'
  }, 'Failed to unwatch repo during cleanup');
}
```

---

### 5. Fix CI/CD to Use pnpm Consistently
**Estimated Effort:** 1 hour

**Files to Update:**
- `.github/workflows/context-validate.yml`
- `.github/workflows/impact-analysis.yml`

**Changes:**
```yaml
# ❌ BEFORE
- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    node-version: '22'
    cache: 'npm'  # Wrong!

# ✅ AFTER
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 10.19.0

- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    node-version: '22'
    cache: 'pnpm'

- name: Install dependencies
  run: |
    cd context-repo
    pnpm install  # Not npm install
```

---

### 6. Add Test Coverage Thresholds
**Estimated Effort:** 30 minutes

**File:** `app/vitest.config.ts`

**Changes:**
```typescript
coverage: {
  provider: 'v8',
  reportsDirectory: './coverage',
  reporter: ['text', 'lcov', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'e2e/**'],
  // Add thresholds
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 65,
    statements: 70
  }
}
```

---

### 7. Fix Indentation Issues
**Estimated Effort:** 30 minutes

**Files:**
- `src/renderer/stores/contextStore.ts` (lines 73-79)

**Action:** Run Prettier/ESLint fix, then manual review

---

### 8. Remove Deprecated `.eslintignore`
**Estimated Effort:** 15 minutes

**Actions:**
- [ ] Delete `.eslintignore` file if it exists
- [ ] Verify all ignore patterns are in `eslint.config.js`
- [ ] Run `pnpm lint` to confirm no warnings

---

## 🟢 P2 - MEDIUM PRIORITY (Fix Within 2 Sprints)

### 9. Add JSDoc to Public Service Methods
**Estimated Effort:** 6-8 hours

**Pattern:**
```typescript
/**
 * Generate a context entity using AI based on user prompt
 * 
 * @param options - Configuration including entity type and user prompt
 * @returns Generated entity data
 * @throws {AIError} If AI service is disabled or connection fails
 * @throws {ValidationError} If generated entity fails schema validation
 * 
 * @example
 * ```typescript
 * const result = await aiService.generate({
 *   dir: '/path/to/repo',
 *   entityType: 'feature',
 *   userPrompt: 'Create OAuth login feature'
 * });
 * ```
 */
async generate(options: AIGenerateOptions): Promise<GeneratedEntity>
```

**Priority Services:**
- AIService
- ContextService
- GitService
- FileSystemService
- SpeckitService

---

### 10. Extract Magic Numbers
**Estimated Effort:** 2 hours

**Files:**
- `src/renderer/stores/contextStore.ts`

**Changes:**
```typescript
// ❌ BEFORE
fileChangeDebounce = setTimeout(async () => {
  await loadGraph();
}, 250);

// ✅ AFTER
const FILE_WATCH_DEBOUNCE_MS = 250; // Prevent excessive graph rebuilds

fileChangeDebounce = setTimeout(async () => {
  await loadGraph();
}, FILE_WATCH_DEBOUNCE_MS);
```

---

### 11. Implement Store Cleanup Lifecycle
**Estimated Effort:** 3-4 hours

**Files:**
- `src/renderer/stores/contextStore.ts`
- `src/renderer/stores/aiStore.ts`
- `src/renderer/stores/assistantStore.ts`

**Implementation:**
```typescript
import { onBeforeUnmount } from 'vue';

export const useContextStore = defineStore('context', () => {
  // ... existing code ...
  
  // Add cleanup
  onBeforeUnmount(() => {
    stopRepoWatch();
    if (fileChangeDebounce) {
      clearTimeout(fileChangeDebounce);
    }
  });
});
```

---

### 12. Add Memory Leak Prevention for Streams
**Estimated Effort:** 2-3 hours

**Files:**
- `src/main/services/AIService.ts`
- `src/main/services/assistantSessionManager.ts`

**Implementation:**
```typescript
const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async startStream(streamId: string) {
  // ... existing stream setup ...
  
  // Add timeout cleanup
  const timeoutId = setTimeout(() => {
    logger.warn({ service: 'AIService', streamId }, 'Stream timeout, cleaning up');
    this.cancelStream(streamId);
  }, STREAM_TIMEOUT_MS);
  
  this.streamTimeouts.set(streamId, timeoutId);
}
```

---

### 13. Create API Documentation
**Estimated Effort:** 8-10 hours

**Deliverables:**
- `docs/api/ipc-reference.md` - All IPC channels and payloads
- `docs/api/services.md` - Main process services
- `docs/api/stores.md` - Pinia stores
- `docs/architecture/diagrams.md` - C4 diagrams of the app itself!

---

## 🔵 P3 - LOW PRIORITY (Continuous Improvement)

### 14. Add Architecture Diagrams
Use your own tool to document itself!

### 15. Resolve TODO/FIXME Comments
16 TODO/FIXME comments found in codebase

### 16. Add Performance Monitoring
Integrate performance.mark/measure

### 17. Implement IPC Message Size Limits
Prevent memory issues from large payloads

---

## Progress Tracking

### Sprint 1 (Current)
- [x] P0.1: Fix TypeScript compilation ✅ DONE
- [ ] P0.2: Replace critical `any` types (DEFERRED - see note)
- [x] P0.3: Fix CSP policy ✅ DONE
- [ ] P1.4: Add logging to catch blocks (NEXT)
- [ ] P1.5: Fix CI/CD pnpm usage

**Note on P0.2:** Given 163 warnings, we'll address critical paths first and make this a gradual improvement over multiple sprints.

### Sprint 2
- [ ] P1.6: Add test coverage thresholds
- [ ] P1.7: Fix indentation
- [ ] P1.8: Remove .eslintignore
- [ ] P2.9: Start JSDoc documentation

### Sprint 3
- [ ] Complete P2 items
- [ ] Begin P3 items

---

## Success Metrics

**Before Review:**
- TypeScript Compilation: ❌ FAILED (3 errors)
- ESLint Warnings: ⚠️ 163 warnings
- Test Coverage: Unknown (no thresholds)
- Documentation: 6/10

**Target After P0 Completion:**
- TypeScript Compilation: ✅ PASSED
- ESLint Warnings: < 50 (focus on critical paths)
- Test Coverage: 70%+ with thresholds
- Documentation: 8/10

**Target After P1 Completion:**
- ESLint Warnings: 0
- CI/CD: 100% consistent with local dev
- Test Coverage: Enforced at 70%+

---

## Notes

- Never take shortcuts - quality over speed
- Run `pnpm lint` and `pnpm typecheck` after each change
- Never deploy without confirmation
- Always fix lint issues before deployment

---

**Last Updated:** 2025-10-29 16:26 UTC  
**Status:** ✅ P0 Critical Items Complete (2/3 - P0.2 deferred to gradual improvement)
