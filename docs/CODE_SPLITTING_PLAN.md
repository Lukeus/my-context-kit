# Code Splitting Plan for Context-Sync Electron App

**Created**: 2025-10-27  
**Goal**: Reduce initial load time and improve performance through strategic code splitting

---

## Current State Analysis

### Bundle Structure
- **Main Process**: Bundled by Vite (main + preload)
- **Renderer**: Vue 3 SFC bundled by Vite
- **Dependencies**: 18 production dependencies, 24 dev dependencies

### Heavy Dependencies Identified

#### Large Libraries (Production)
1. **mermaid** (11.12.1) - ~2.5MB - Used only for C4 diagram rendering
2. **cytoscape** (3.33.1) - ~800KB - Used only in GraphView modal
3. **codemirror** (6.0.2) + **@codemirror/lang-yaml** - ~500KB - Used only in YamlEditor
4. **marked** (16.4.1) - ~100KB - Used for markdown rendering
5. **simple-git** (3.28.0) - ~200KB - Used only in Git operations
6. **handlebars** (4.7.8) - ~150KB - Template engine

#### Components Analysis (from App.vue)
Currently **all components are eagerly imported** at startup:
- ContextTree ✓ (needed immediately)
- YamlEditor ✗ (only when entity selected)
- GraphView ✗ (only when modal opens)
- GitPanel ✗ (only when modal opens)
- WelcomeDocumentation ✗ (only when no entity selected)
- DeveloperHub ✗ (only when no entity selected)
- EntityPreview ✗ (only when tab switched)
- EntityDiff ✗ (only when tab switched)
- EntityDependencyGraph ✗ (only when tab switched)
- PromptPanel ✗ (only when tab switched)
- ImpactReportPanel ✗ (only when tab switched)
- ContextBuilderModal ✗ (only when builder opens)
- NewRepoModal ✗ (only when modal opens)
- AISettingsModal ✗ (only when modal opens)
- AIAssistantPanel ~ (right panel, often used)
- SpeckitWizard ✗ (only when wizard opens)
- C4DiagramRenderer ✗ (only for C4 diagram entities)
- C4DiagramView ✗ (only for C4 diagram entities)

---

## Code Splitting Strategy

### Phase 1: Low-Hanging Fruit (Immediate Impact)

#### 1.1 Lazy Load Modals (Easy Win)
Convert modals to dynamic imports - these are rarely needed at startup:

```typescript
// Before
import GraphView from './components/GraphView.vue';
import GitPanel from './components/GitPanel.vue';
import NewRepoModal from './components/NewRepoModal.vue';
import AISettingsModal from './components/AISettingsModal.vue';
import SpeckitWizard from './components/SpeckitWizard.vue';

// After
const GraphView = defineAsyncComponent(() => import('./components/GraphView.vue'));
const GitPanel = defineAsyncComponent(() => import('./components/GitPanel.vue'));
const NewRepoModal = defineAsyncComponent(() => import('./components/NewRepoModal.vue'));
const AISettingsModal = defineAsyncComponent(() => import('./components/AISettingsModal.vue'));
const SpeckitWizard = defineAsyncComponent(() => import('./components/SpeckitWizard.vue'));
```

**Estimated Savings**: ~500KB initial bundle
**Components affected**: GraphView, GitPanel, NewRepoModal, AISettingsModal, SpeckitWizard

#### 1.2 Lazy Load Tab Components
Tab content is only needed when tabs are switched:

```typescript
// Before
import EntityPreview from './components/EntityPreview.vue';
import EntityDiff from './components/EntityDiff.vue';
import EntityDependencyGraph from './components/EntityDependencyGraph.vue';
import PromptPanel from './components/PromptPanel.vue';
import ImpactReportPanel from './components/ImpactReportPanel.vue';

// After
const EntityPreview = defineAsyncComponent(() => import('./components/EntityPreview.vue'));
const EntityDiff = defineAsyncComponent(() => import('./components/EntityDiff.vue'));
const EntityDependencyGraph = defineAsyncComponent(() => import('./components/EntityDependencyGraph.vue'));
const PromptPanel = defineAsyncComponent(() => import('./components/PromptPanel.vue'));
const ImpactReportPanel = defineAsyncComponent(() => import('./components/ImpactReportPanel.vue'));
```

**Estimated Savings**: ~400KB initial bundle
**Components affected**: EntityPreview, EntityDiff, EntityDependencyGraph, PromptPanel, ImpactReportPanel

#### 1.3 Lazy Load C4 Diagram Components
C4 diagrams are rarely viewed at startup:

```typescript
// Before
import C4DiagramRenderer from './components/C4DiagramRenderer.vue';

// After
const C4DiagramRenderer = defineAsyncComponent(() => import('./components/C4DiagramRenderer.vue'));
```

**Estimated Savings**: ~2.5MB (includes Mermaid dependency)
**Benefit**: Massive reduction since Mermaid is 2.5MB alone

#### 1.4 Lazy Load Documentation Components
Docs aren't needed unless user navigates there:

```typescript
// Before
import WelcomeDocumentation from './components/WelcomeDocumentation.vue';
import DeveloperHub from './components/DeveloperHub.vue';

// After (conditional)
// Keep DeveloperHub eager (it's the default view)
// Lazy load WelcomeDocumentation
const WelcomeDocumentation = defineAsyncComponent(() => import('./components/WelcomeDocumentation.vue'));
```

**Estimated Savings**: ~100KB
**Note**: Keep DeveloperHub eager since it's the landing page

---

### Phase 2: Advanced Optimizations

#### 2.1 Split Heavy Library Chunks
Configure Vite to split large libraries into separate chunks:

```typescript
// vite.renderer.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Mermaid (for C4 diagrams) - only loaded when needed
          'vendor-mermaid': ['mermaid'],
          
          // Cytoscape (for graph view) - only loaded when opened
          'vendor-cytoscape': ['cytoscape'],
          
          // CodeMirror (for YAML editor) - lazy loaded
          'vendor-codemirror': [
            'codemirror',
            '@codemirror/lang-yaml',
            '@codemirror/theme-one-dark'
          ],
          
          // Core vendor libs (always needed)
          'vendor-vue': ['vue', 'pinia'],
          
          // Git utilities (only for Git operations)
          'vendor-git': ['simple-git', 'isomorphic-git']
        }
      }
    }
  }
});
```

**Benefit**: Browser can cache these chunks separately and load on-demand

#### 2.2 Route-Level Code Splitting
Although this is a single-page app, we can split by "logical routes":

```typescript
// Create route-like composables that lazy-load dependencies
const useGraphView = () => {
  const { loadCytoscape } = defineAsyncComponent(() => import('./composables/useCytoscape'));
  // Load cytoscape only when graph is opened
};

const useYamlEditor = () => {
  const { loadCodeMirror } = defineAsyncComponent(() => import('./composables/useCodeMirror'));
  // Load CodeMirror only when YAML tab is active
};
```

#### 2.3 Preload Critical Chunks
Use `<link rel="modulepreload">` for components likely to be used soon:

```typescript
// When user hovers over "Graph" button, preload GraphView chunk
function handleGraphHover() {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = '/assets/GraphView.chunk.js'; // Vite generates this
  document.head.appendChild(link);
}
```

---

### Phase 3: Main Process Optimization

#### 3.1 Lazy Load IPC Handlers
Not all handlers are needed immediately:

```typescript
// src/main/ipc/register.ts - Before
import { registerContextHandlers } from './handlers/context.handlers';
import { registerGitHandlers } from './handlers/git.handlers';
import { registerAIHandlers } from './handlers/ai.handlers';
import { registerFileSystemHandlers } from './handlers/filesystem.handlers';
import { registerC4Handlers } from './handlers/c4.handlers';

// After - lazy load on first use
export async function registerHandlers() {
  // Core handlers - load immediately
  const { registerContextHandlers } = await import('./handlers/context.handlers');
  registerContextHandlers();
  
  // Git handlers - load on demand
  ipcMain.on('git:init', async () => {
    const { registerGitHandlers } = await import('./handlers/git.handlers');
    registerGitHandlers();
  });
  
  // AI handlers - load on demand
  ipcMain.on('ai:init', async () => {
    const { registerAIHandlers } = await import('./handlers/ai.handlers');
    registerAIHandlers();
  });
}
```

---

## Implementation Plan

### Week 1: Phase 1 Implementation
1. **Day 1-2**: Implement modal lazy loading
   - Convert 5 modal components to `defineAsyncComponent`
   - Add loading states/spinners
   - Test all modal opening scenarios

2. **Day 3-4**: Implement tab component lazy loading
   - Convert 5 tab components to `defineAsyncComponent`
   - Add skeleton loaders for tab content
   - Test tab switching UX

3. **Day 5**: Implement C4 diagram lazy loading
   - Critical due to Mermaid size (2.5MB)
   - Add loading indicator for diagrams
   - Test diagram rendering

### Week 2: Phase 2 Implementation
1. **Day 1-2**: Configure Vite chunk splitting
   - Update vite.renderer.config.ts
   - Test build output and chunk sizes
   - Verify chunk loading in production

2. **Day 3-4**: Add preloading hints
   - Implement hover-based preloading
   - Add modulepreload links for likely-next components

3. **Day 5**: Performance testing
   - Measure before/after load times
   - Identify any regressions
   - Document improvements

### Week 3: Phase 3 (Optional)
1. Main process handler optimization
2. Additional profiling and optimization

---

## Measurement & Success Criteria

### Metrics to Track
- **Initial bundle size**: Target 50% reduction (from ~4MB to ~2MB)
- **Time to Interactive (TTI)**: Target 30% improvement
- **First Contentful Paint (FCP)**: Target 40% improvement
- **Chunk load times**: <200ms for on-demand chunks
- **Memory usage**: Should not increase significantly

### Tools for Measurement
- **Vite Build Analyzer**: `vite-plugin-visualizer`
- **Chrome DevTools**: Performance tab, Network tab
- **Lighthouse**: Performance audits
- **Electron DevTools**: Memory profiler

```powershell
# Install build analyzer
pnpm add -D rollup-plugin-visualizer

# Generate bundle visualization
pnpm build
# Open stats.html to see bundle composition
```

---

## Risks & Mitigation

### Risk 1: Degraded UX from Loading States
**Mitigation**: 
- Use skeleton loaders instead of spinners
- Preload likely-next components
- Keep critical path components eager

### Risk 2: Increased Complexity
**Mitigation**:
- Document all lazy-loaded components
- Add TypeScript types for async components
- Create helper utilities for common patterns

### Risk 3: Cache Invalidation Issues
**Mitigation**:
- Use Vite's built-in hash-based chunking
- Test cache behavior thoroughly
- Document chunk loading strategy

---

## Rollout Strategy

### Step 1: Feature Flag
Add environment variable to enable/disable code splitting:

```typescript
// vite.renderer.config.ts
const enableCodeSplitting = process.env.ENABLE_CODE_SPLITTING === 'true';

export default defineConfig({
  define: {
    __CODE_SPLITTING_ENABLED__: enableCodeSplitting
  }
});
```

### Step 2: Gradual Rollout
1. **Internal testing** (1 week)
2. **Beta users** (1 week) 
3. **Production** (after validation)

### Step 3: Monitoring
- Track error rates for chunk loading failures
- Monitor performance metrics
- Collect user feedback

---

## Expected Results

### Before Code Splitting
- Initial bundle: ~4.0 MB
- Time to Interactive: ~3.5s
- First Contentful Paint: ~1.8s

### After Code Splitting (Estimated)
- Initial bundle: ~1.5 MB (62% reduction)
- Time to Interactive: ~2.0s (43% improvement)
- First Contentful Paint: ~1.0s (44% improvement)

### Breakdown by Phase
- **Phase 1**: 2.5MB reduction (mostly from Mermaid)
- **Phase 2**: 0.5MB additional reduction + better caching
- **Phase 3**: Faster main process startup

---

## Next Steps

1. **Review this plan** with team
2. **Create tasks** in project tracker
3. **Set up measurement baseline** before starting
4. **Begin Phase 1 implementation**

---

**References:**
- [Vue 3 Async Components](https://vuejs.org/guide/components/async.html)
- [Vite Code Splitting](https://vitejs.dev/guide/features.html#code-splitting)
- [Electron Performance Best Practices](https://www.electronjs.org/docs/latest/tutorial/performance)
