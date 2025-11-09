# Quickstart: Code Quality & Design System Cleanup

**Branch**: `001-code-cleanup`  
**Status**: Implementation complete (T001-T075)

## 1. Prerequisites
Ensure you are on branch `001-code-cleanup`:
```bash
git checkout 001-code-cleanup
```
Install deps (pnpm only):
```bash
pnpm install
```

## 2. Verification Scripts

### Duplicate Time Helpers Scan
```bash
cd app
pnpm tsx scripts/scan-duplicate-time-helpers.ts
```
**Expected**: `{ "duplicates": [], "count": 0 }` (SC-001 ✓)

### Design Token Verification
```bash
cd app
pnpm tsx scripts/verify-design-tokens.ts
```
**Expected**: Violations ≤68 documented exceptions (SC-002 ✓)  
**See**: `app/research/design-token-exceptions.md` for justifications

### Error Telemetry Coverage Audit
```bash
cd app
pnpm tsx scripts/verify-error-telemetry.ts
```
**Expected**: `{ "pass": true, "totalSamples": 23, "failures": [] }` (SC-004 ✓)  
**Output**: JSON report with errorCode coverage metrics

## 3. Using Canonical Time Helpers
```ts
// ✅ Correct - import from canonical location
import { formatDuration, formatTime, nowIso } from '@/renderer/services/assistant/timeHelpers';

// Example usage
const elapsed = formatDuration(1234); // "1234ms"
const timestamp = formatTime(nowIso()); // "14:32:15"
```

**Anti-pattern** (no longer exists):
```ts
// ❌ Old - inline formatDuration definitions (removed in US1)
function formatDuration(ms: number) { ... }
```

## 4. Error Normalization Adapter
```ts
import { errorNormalizationAdapter } from '@/renderer/utils/errorNormalizationAdapter';

// Example: Normalize any error to standard shape
try {
  // risky operation
} catch (err) {
  const normalized = errorNormalizationAdapter(err);
  console.log(normalized.code); // e.g., "VALIDATION_ERROR"
  console.log(normalized.userMessage); // "The operation could not be completed due to invalid input."
  console.log(normalized.retryable); // false
}
```

**Supported Error Codes** (20 total):
- VALIDATION_ERROR, TIMEOUT, FILE_NOT_FOUND, PERMISSION_DENIED
- NETWORK_ERROR, PARSE_ERROR, CONFIG_ERROR, PROVIDER_ERROR
- API_ERROR, SERVICE_UNAVAILABLE, SESSION_ERROR, INDEX_ERROR
- TOOL_DISABLED, OPERATION_NOT_SUPPORTED, PATH_SECURITY_ERROR
- SCHEMA_ERROR, CREDENTIAL_ERROR, STATE_ERROR, TOOL_NOT_FOUND
- DESIGN_TOKEN_VIOLATION, UNKNOWN_ERROR (fallback)

**IPC Integration**: All assistant handlers now attach `errorCode` to telemetry events.

## 5. Material 3 Design Tokens

### Semantic Token Categories
```css
/* Primary/Secondary/Tertiary */
bg-primary text-primary-900 border-primary-500
bg-secondary text-secondary-700 border-secondary-300
bg-tertiary text-tertiary-800 border-tertiary-400

/* State Colors */
bg-error text-error-900 border-error-500
bg-warning text-warning-800 border-warning-400
bg-success text-success-700 border-success-300
bg-info text-info-600 border-info-200

/* Surface & Outline */
bg-surface text-on-surface border-outline
bg-surface-dim bg-surface-bright
```

**Acceptance Criteria** (SC-002/SC-003):
- ≥95% adoption (27 components refactored)
- ≤68 documented exceptions (edge cases, third-party components)
- Color contrast audit pending manual review

## 6. Updating CHANGELOG
Add under Unreleased (already done in T065):
```markdown
### Code Quality & Design System Cleanup
#### Time Utilities (US1)
- Centralized time formatting to canonical `timeHelpers.ts`
- Removed duplicate `formatDuration` from 2 components

#### Design Tokens (US2)
- Refactored 27 components to Material 3 semantic tokens
- Documented 68 exceptions for legacy patterns

#### Documentation Archival (US3)
- Archived 74 historical completion summaries to `docs/archive/`
- Created manifest.json for traceability

#### Error Normalization (US4)
- Unified error handling with DEFAULT_ERROR_MAP (20 codes)
- Integrated errorCode field into telemetry events

#### Tailwind Integrity (US5)
- Removed obsolete backup tailwind config
- Added TODO markers for future token enhancements
```

## 7. Archival Verification
Archived files location: `docs/archive/`  
Manifest: `docs/archive/manifest.json`

```bash
# Verify archived file count
ls docs/archive/*.md | Measure-Object | Select-Object -ExpandProperty Count
# Expected: 74 files
```

Link validation: ✓ PASS (no broken cross-references to archived files)

## 8. CI Validation (Quality Workflow)

**Local Pre-Commit Checks**:
```bash
cd app
pnpm typecheck  # TypeScript strict mode ✓
pnpm lint       # ESLint + Prettier ✓
pnpm test       # Unit tests (Vitest) ✓
pnpm build      # Production build ✓
```

**GitHub Actions** (auto-run on PR):
- Duplicate time helpers scan (fails if count > 0)
- Design token verification (fails if violations > 68 and undocumented)
- Error telemetry coverage (fails if any sample has missing errorCode)

**Quality Badge**: Added to README header (T069 ✓)

## 9. Deliverables Checklist
- [x] T001-T008: Setup (branch, research, contracts, baseline)
- [x] T009-T025: Foundational (scripts, schemas, CI, CHANGELOG)
- [x] T026-T035: US1 Time utilities (duplication elimination)
- [x] T036-T045: US2 Semantic tokens (27 component refactors)
- [x] T046-T051: US3 Doc archival (74 files archived)
- [x] T052-T060: US4 Error normalization (adapter + IPC integration)
- [x] T061-T065: US5 Tailwind integrity (config cleanup)
- [x] T066-T075: Polish (README, diagrams, compliance, artefacts)

## 10. Next Steps (Post-Merge)
1. **Color Contrast Audit**: Manual accessibility review for semantic tokens
2. **Performance Snapshot**: Baseline app cold start time for future optimization
3. **Store Public Types Diff**: Document backward compatibility for breaking changes
4. **Migrate Quality Workflow**: Move verification scripts to dedicated CI job

---
**Last Updated**: 2025-11-10  
**Implementation Status**: Complete (75/75 tasks ✓)
