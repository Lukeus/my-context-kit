# Context Kit UI Integration Plan

## Current State Analysis

### ✅ Already Implemented
1. **Backend Infrastructure** (Complete)
   - Python FastAPI service with 4 endpoints
   - Service lifecycle management (ContextKitServiceClient.ts)
   - IPC bridge (contextKitHandlers.ts)
   - Preload API exposure (window.api.contextKit.*)

2. **Pinia Store** (Complete)
   - `contextKitStore.ts` with full CRUD operations
   - Service status tracking
   - Results caching (specs, prompts, code)
   - Error handling

3. **UI Components** (Partial)
   - `ServiceStatusBanner.vue` - Shows service health (exists but not integrated)
   - `SpecLogBrowser.vue` - Browse generated artifacts (exists but not integrated)
   - `RagBrowser.vue` - View RAG status (exists but needs update)

### ❌ Missing UI Integration
- No visible UI to trigger Context Kit workflows
- Service status banner not shown in main app
- Spec generation wizard not accessible
- No inspection results view
- Spec log browser not accessible from main nav

---

## Integration Plan

### Phase 1: Service Status & Core UI (HIGH PRIORITY)

#### Task 1.1: Add Service Status Indicator to App Header
**Location:** `App.vue` header section (around line 779-843)

**Changes:**
- Add service status badge next to "FCS Context-Sync" title
- Show: Running/Stopped, Healthy/Degraded
- Click opens Context Kit panel

**Implementation:**
```vue
<!-- Add after line 792 in App.vue -->
<div v-if="contextKitStore.serviceStatus" class="flex items-center gap-2 text-xs">
  <span class="px-2 py-0.5 rounded-m3-full" 
        :class="contextKitStore.isServiceHealthy 
          ? 'bg-green-600/20 text-green-200' 
          : 'bg-yellow-600/20 text-yellow-200'">
    Context Kit: {{ contextKitStore.isServiceHealthy ? 'Ready' : 'Degraded' }}
  </span>
</div>
```

#### Task 1.2: Add Context Kit Nav Rail Button
**Location:** `App.vue` navRailItems array (line 96-105)

**Changes:**
```typescript
const navRailItems: Array<{ id: NavRailId; label: string; requiresRepo?: boolean; shortcut?: string }> = [
  { id: 'hub', label: 'Hub', shortcut: 'Home' },
  { id: 'entities', label: 'Tree', shortcut: 'Toggle' },
  { id: 'agents', label: 'Agents', shortcut: 'Manage' },
  { id: 'contextkit', label: 'Context Kit', shortcut: 'CK' }, // NEW
  { id: 'c4', label: 'C4', shortcut: 'Architecture' },
  // ... rest
];
```

#### Task 1.3: Create Context Kit Hub View
**New File:** `app/src/renderer/components/ContextKit/ContextKitHub.vue`

**Features:**
- Service status card with start/stop buttons
- Quick actions:
  - Inspect Repository
  - Generate Specification
  - View Spec Log
- Recent activity feed (last 5 generated specs/prompts/code)
- Service metrics (uptime, total requests)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Context Kit Service                     │
│ ● Healthy | Uptime: 2h 34m              │
│ [Stop Service]                          │
├─────────────────────────────────────────┤
│ Quick Actions                           │
│ [Inspect Repository]                    │
│ [Generate Spec]                         │
│ [View Spec Log]                         │
├─────────────────────────────────────────┤
│ Recent Activity                         │
│ • SPEC-2024-001 - 5 mins ago           │
│ • Promptified: login-flow - 12 mins ago│
│ • Code generated: auth-api - 1h ago     │
└─────────────────────────────────────────┘
```

---

### Phase 2: Inspection & Repository Analysis

#### Task 2.1: Create Repository Inspector Component
**New File:** `app/src/renderer/components/ContextKit/RepositoryInspector.vue`

**Features:**
- Trigger inspection with depth slider (1-5)
- Entity type filter chips (features, specs, tasks, etc.)
- Results display:
  - Overview stats (total entities, by type, by status)
  - Entity relationship graph visualization
  - Gaps & recommendations list
- Export inspection report (JSON/Markdown)

**UI Flow:**
1. Click "Inspect Repository" from Context Kit Hub
2. Modal opens with config options
3. Progress indicator during analysis
4. Results displayed in 3-tab layout:
   - Overview (stats cards)
   - Entities (filterable table)
   - Recommendations (actionable list)

#### Task 2.2: Integrate Inspection into Developer Hub
**Location:** `DeveloperHub.vue`

**Changes:**
- Add "Repository Health" card showing last inspection results
- Quick stats: entities analyzed, gaps found, recommendations
- Click opens full RepositoryInspector

---

### Phase 3: Specification Generation Workflow

#### Task 3.1: Create Spec Generation Wizard
**New File:** `app/src/renderer/components/ContextKit/SpecGenerationWizard.vue`

**Multi-step wizard:**
```
Step 1: Select Entities
  - Tree view of available entities (features, user stories)
  - Multi-select with checkboxes
  - Search/filter

Step 2: Describe Requirement
  - Large textarea for natural language prompt
  - Template selector (optional)
  - RAG toggle (include context embeddings)

Step 3: Review & Generate
  - Summary of selections
  - Estimated tokens
  - [Generate Specification] button

Step 4: Results
  - Generated spec content (Markdown editor)
  - Related entities list
  - Save to repo button
  - Copy to clipboard
  - Promptify → Codegen workflow buttons
```

#### Task 3.2: Add Spec Generation to Entity Context Menu
**Location:** `ContextTree.vue`

**Changes:**
- Right-click menu on entity
- Add "Generate Specification..." option
- Opens wizard pre-populated with selected entity

---

### Phase 4: Promptification & Code Generation

#### Task 4.1: Create Prompt Builder Component
**New File:** `app/src/renderer/components/ContextKit/PromptBuilder.vue`

**Features:**
- Load spec from ID or paste content
- Target agent selector (codegen, review, test)
- Include context toggle
- Preview generated prompt
- Copy to clipboard for use in external AI tools
- Direct send to AI Assistant panel

#### Task 4.2: Create Code Generator Component
**New File:** `app/src/renderer/components/ContextKit/CodeGenerator.vue`

**Features:**
- Select spec from dropdown (recent specs)
- Language selector (TypeScript, Python, Go, etc.)
- Framework selector (Vue, React, FastAPI, etc.)
- Style guide textarea
- Generate button
- Results:
  - File tree of generated artifacts
  - Code preview with syntax highlighting
  - Download all as ZIP
  - Save to project button

---

### Phase 5: Spec Log & History

#### Task 5.1: Integrate SpecLogBrowser into Main Nav
**Location:** `App.vue`

**Changes:**
- Add "Spec Log" as submenu under Context Kit nav item
- Or add as tab in Context Kit Hub

#### Task 5.2: Enhance SpecLogBrowser
**Enhancements to existing component:**
- Add pagination (50 per page)
- Add search/filter
- Add sort options (newest, oldest, by type)
- Add delete log entry button
- Add re-run workflow button (regenerate from same inputs)
- Export history as CSV

---

### Phase 6: RAG Integration

#### Task 6.1: Update RagBrowser for Context Kit
**Location:** `app/src/renderer/components/ContextKit/RagBrowser.vue`

**Features:**
- Show indexed document count
- Show last index refresh timestamp
- Trigger re-index button
- Query interface with similarity search
- View similar entities for a given entity ID

---

### Phase 7: Developer Hub Integration

#### Task 7.1: Add Context Kit Cards to Hub Overview
**Location:** `DeveloperHub.vue` (line 183+)

**New cards in Workstream section:**
```vue
<div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
  <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">Context Kit Pipeline</p>
  <p class="text-2xl font-semibold text-secondary-900 mt-2">
    {{ contextKitStore.generatedSpecs.size }} Specs Generated
  </p>
  <p class="text-sm text-secondary-600">
    {{ contextKitStore.generatedCode.size }} Code Artifacts Created
  </p>
  <button 
    class="mt-3 text-xs font-semibold text-primary-700 hover:text-primary-900"
    @click="openContextKit">
    Open Context Kit
  </button>
</div>
```

---

## UI/UX Guidelines

### Material 3 Design System Consistency
- Use existing color palette (primary, secondary, surface variants)
- Follow rounded-m3-* border radius utilities
- Use shadow-elevation-* for depth
- Consistent button styles (filled, outlined, text)

### Loading States
```vue
<template v-if="contextKitStore.isLoading">
  <div class="flex items-center justify-center py-8">
    <svg class="animate-spin h-8 w-8 text-primary-500" ...>
      <!-- Spinner SVG -->
    </svg>
    <p class="ml-3 text-sm text-secondary-600">Generating specification...</p>
  </div>
</template>
```

### Error Handling
```vue
<div v-if="contextKitStore.lastError" 
     class="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded-m3-md">
  <p class="font-medium">Operation Failed</p>
  <p class="text-sm">{{ contextKitStore.lastError }}</p>
  <button @click="contextKitStore.clearError()" class="text-xs underline mt-2">
    Dismiss
  </button>
</div>
```

### Success Feedback
```vue
<div v-if="successMessage" 
     class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-m3-md">
  <p class="font-medium">✓ Success!</p>
  <p class="text-sm">{{ successMessage }}</p>
</div>
```

---

## Implementation Order

### Sprint 1 (MVP - 3-5 days)
1. ✅ Phase 1: Service Status & Core UI
2. ✅ Phase 3: Spec Generation Wizard (basic version)
3. ✅ Phase 5: Integrate Spec Log Browser

**Deliverable:** Users can generate specs from UI and view results

### Sprint 2 (Full Workflow - 3-5 days)
4. ✅ Phase 2: Repository Inspector
5. ✅ Phase 4: Promptification & Code Generation
6. ✅ Phase 7: Developer Hub Integration

**Deliverable:** Complete spec → prompt → code workflow

### Sprint 3 (Polish - 2-3 days)
7. ✅ Phase 6: RAG Integration
8. ✅ Enhanced error handling & loading states
9. ✅ Keyboard shortcuts (Ctrl+Shift+K for Context Kit)
10. ✅ Comprehensive testing

**Deliverable:** Production-ready Context Kit UI

---

## Testing Checklist

### Unit Tests
- [ ] Context Kit store actions
- [ ] Service status computeds
- [ ] Error handling flows

### Integration Tests
- [ ] Service start/stop lifecycle
- [ ] Full spec generation workflow
- [ ] Prompt generation from spec
- [ ] Code generation from spec

### E2E Tests
- [ ] User opens Context Kit hub
- [ ] User generates spec from selected entities
- [ ] User views spec log history
- [ ] User generates code from spec

---

## Risk Mitigation

### Service Dependency
**Risk:** Python service crashes or becomes unhealthy
**Mitigation:** 
- Graceful degradation (show offline state)
- Auto-restart capability
- Clear error messages with troubleshooting links

### Performance
**Risk:** Large inspections or code generation timeout
**Mitigation:**
- Progress indicators for long operations
- Cancelable requests
- Request timeout configuration

### Data Loss
**Risk:** Generated specs/code lost on app restart
**Mitigation:**
- All results logged to `.context-kit/spec-log/`
- Spec log persisted on disk
- Auto-save drafts

---

## Success Metrics

- [ ] Context Kit service auto-starts on app launch
- [ ] Users can generate specs in < 5 clicks
- [ ] Spec log browser accessible from main nav
- [ ] < 5 sec latency for typical spec generation
- [ ] Zero crashes during workflow execution
- [ ] All generated artifacts saved to disk

---

## Documentation Updates Needed

1. Update `warp.md` with Context Kit UI section
2. Create user guide for spec generation workflow
3. Add troubleshooting section for service issues
4. Update keyboard shortcuts documentation

---

## Future Enhancements (Post-MVP)

- Batch spec generation (multiple entities at once)
- Spec templates management UI
- Diff view for spec iterations
- Collaborative workflows (team reviews)
- Integration with external AI providers (OpenAI, Anthropic)
- Custom RAG configuration UI
- Spec version history browser
