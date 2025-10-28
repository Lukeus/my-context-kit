# Enterprise Routing Architecture

## ✅ Fixed: Routing Bug
**Issue**: DeveloperHub was appearing below entity views due to catch-all `v-else`
**Solution**: Changed to explicit `v-else-if="activeNavId === 'hub'"` conditions

### Routing Flow (Now Fixed)
```
1. If activeEntity exists → Entity View (YAML/Preview/Graph/etc.)
2. Else if activeNavId === 'c4' → C4 Builder
3. Else if activeNavId === 'docs' → Documentation
4. Else if activeNavId === 'hub' → Developer Hub
5. (No catch-all fallback)
```

## Enterprise Routing Enhancements

### Phase 1: Router Service (Current Architecture → Enterprise)

#### 1.1 Create Dedicated Router Service
```typescript
// src/renderer/services/RouterService.ts
export interface Route {
  id: string;
  path: string;
  component: Component;
  meta?: {
    requiresAuth?: boolean;
    requiresRepo?: boolean;
    title?: string;
    icon?: string;
  };
  beforeEnter?: (to: Route, from: Route) => boolean | Promise<boolean>;
}

export class RouterService {
  private routes: Map<string, Route> = new Map();
  private currentRoute: Route | null = null;
  private history: Route[] = [];
  
  register(route: Route): void
  navigate(routeId: string, params?: any): Promise<boolean>
  back(): void
  forward(): void
  canActivate(route: Route): Promise<boolean>
  getHistory(): Route[]
}
```

#### 1.2 Route Guards
```typescript
// Route guard examples
const requiresRepo = async (to: Route) => {
  if (!contextStore.repoPath) {
    showSnackbar('Configure a repository first');
    return false;
  }
  return true;
};

const requiresEntity = async (to: Route) => {
  if (!contextStore.activeEntity) {
    return false;
  }
  return true;
};
```

#### 1.3 Centralized Route Configuration
```typescript
// src/renderer/config/routes.ts
export const routes: Route[] = [
  {
    id: 'hub',
    path: '/hub',
    component: DeveloperHub,
    meta: { title: 'Hub', icon: 'home' }
  },
  {
    id: 'entities',
    path: '/entities/:id?',
    component: EntityView,
    meta: { title: 'Entities', requiresRepo: true }
  },
  {
    id: 'c4',
    path: '/c4/:diagramId?',
    component: C4DiagramBuilder,
    meta: { title: 'C4 Architecture', icon: 'diagram' }
  },
  {
    id: 'docs',
    path: '/docs',
    component: WelcomeDocumentation,
    meta: { title: 'Documentation', icon: 'book' }
  }
];
```

### Phase 2: URL-Based Routing (Deep Linking)

#### 2.1 Enable Hash Router
```typescript
// Use hash-based routing for Electron compatibility
// URLs: #/hub, #/entities/FEAT-001, #/c4/system-context
import { createHashHistory } from 'vue-router';

const router = createRouter({
  history: createHashHistory(),
  routes: enterpriseRoutes
});
```

#### 2.2 Deep Link Support
```bash
# Users can bookmark and share specific views
context-sync://app#/entities/FEAT-001
context-sync://app#/c4/system-context
context-sync://app#/docs/getting-started
```

#### 2.3 IPC Protocol Handler
```typescript
// Register custom protocol in main process
app.setAsDefaultProtocolClient('context-sync');

app.on('open-url', (event, url) => {
  // Parse: context-sync://app#/entities/FEAT-001
  mainWindow.webContents.send('navigate', parseRoute(url));
});
```

### Phase 3: Navigation State Management

#### 3.1 Persistent Navigation State
```typescript
// Store navigation history in settings
interface NavigationState {
  currentRoute: string;
  params: Record<string, any>;
  history: string[];
  timestamp: number;
}

// Restore last view on app restart
await settings.get('lastNavigation');
router.navigate(lastNav.currentRoute, lastNav.params);
```

#### 3.2 Breadcrumb Navigation
```vue
<nav class="breadcrumbs">
  <span v-for="crumb in breadcrumbs" :key="crumb.id">
    <a @click="router.navigate(crumb.id)">{{ crumb.title }}</a>
  </span>
</nav>
```

### Phase 4: Multi-Window Support

#### 4.1 Window State Management
```typescript
// Open entity in new window
function openInNewWindow(entityId: string) {
  const window = new BrowserWindow({...});
  window.loadURL(`#/entities/${entityId}`);
}

// Sync state across windows
ipcMain.on('entity-updated', (event, entity) => {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('entity-changed', entity);
  });
});
```

#### 4.2 Tab-based Navigation (Future)
```vue
<!-- Multiple entities in tabs -->
<div class="tabs">
  <Tab v-for="entity in openEntities" 
       :key="entity.id"
       @close="closeTab(entity.id)">
    {{ entity.id }}
  </Tab>
</div>
```

### Phase 5: Analytics & Monitoring

#### 5.1 Route Analytics
```typescript
// Track navigation patterns
router.afterEach((to, from) => {
  analytics.track('route_change', {
    from: from.path,
    to: to.path,
    duration: Date.now() - navigationStart
  });
});
```

#### 5.2 Error Boundaries per Route
```vue
<RouterView v-slot="{ Component }">
  <Suspense>
    <ErrorBoundary :key="route.path">
      <component :is="Component" />
    </ErrorBoundary>
  </Suspense>
</RouterView>
```

## Enterprise Features Roadmap

### Security & Access Control
- [ ] Role-based route access (Admin, Developer, Viewer)
- [ ] Route-level permissions from CONST-CTX-SYNC
- [ ] Audit log for all navigation events
- [ ] Session timeout on sensitive routes

### Performance
- [ ] Route-based code splitting (already started)
- [ ] Prefetch next likely routes
- [ ] Cache route data with TTL
- [ ] Lazy load route components progressively

### User Experience
- [ ] Keyboard shortcuts per route (Ctrl+1-9 for quick access)
- [ ] Command palette integration (already exists)
- [ ] Recent routes list
- [ ] Favorite/pinned routes

### Developer Experience
- [ ] Route type safety with TypeScript
- [ ] Route testing utilities
- [ ] Route documentation generator
- [ ] Navigation debug panel

## Implementation Priority

### Immediate (Week 1)
1. ✅ Fix routing bug (DONE)
2. Create RouterService class
3. Add route guards
4. Centralize route configuration

### Short-term (Week 2-3)
5. Add URL-based routing
6. Implement deep linking
7. Add breadcrumb navigation
8. Persistent navigation state

### Medium-term (Month 2)
9. Multi-window support
10. Tab-based navigation
11. Route analytics
12. Error boundaries

### Long-term (Month 3+)
13. Role-based access control
14. Route prefetching
15. Advanced caching strategies
16. Full audit logging

## Migration Path

### Step 1: Create Router Service (Non-breaking)
```typescript
// Gradual migration, keep existing logic working
const router = new RouterService();
router.register({
  id: 'hub',
  handler: () => activeNavId.value = 'hub'
});
```

### Step 2: Add Vue Router (Parallel)
```bash
pnpm add vue-router@4
```

### Step 3: Migrate Components
```typescript
// Replace manual navigation with router
// Before: activeNavId.value = 'c4'
// After: router.push('/c4')
```

### Step 4: Remove Legacy Code
```typescript
// Remove showDocsCenter, manual activeNavId management
// Use router.currentRoute.value instead
```

## Testing Strategy

### Unit Tests
```typescript
describe('RouterService', () => {
  it('should navigate to valid route', async () => {
    await router.navigate('hub');
    expect(router.currentRoute.id).toBe('hub');
  });

  it('should block navigation without repo', async () => {
    const result = await router.navigate('entities');
    expect(result).toBe(false);
  });
});
```

### Integration Tests
```typescript
describe('Route Guards', () => {
  it('should redirect to hub when repo missing', async () => {
    await router.navigate('c4');
    expect(showSnackbar).toHaveBeenCalledWith('Configure a repository');
  });
});
```

### E2E Tests
```typescript
test('deep link navigation', async () => {
  await app.loadURL('context-sync://app#/entities/FEAT-001');
  expect(await app.title()).toBe('FEAT-001 - Context Sync');
});
```

## Configuration Example

```typescript
// vite.config.ts
export default defineConfig({
  define: {
    __ROUTER_BASE__: JSON.stringify(process.env.ROUTER_BASE || '/'),
    __ENABLE_DEEP_LINKS__: process.env.ENABLE_DEEP_LINKS === 'true'
  }
});
```

## Documentation

### For Developers
- Route registration guide
- Guard implementation examples
- Testing route components

### For Users
- Keyboard shortcuts reference
- URL scheme documentation
- Navigation tips & tricks

## Metrics to Track

1. **Navigation Performance**
   - Time to navigate (TTN)
   - Route component load time
   - Cache hit rate

2. **User Behavior**
   - Most visited routes
   - Navigation patterns
   - Dead-end routes

3. **Errors**
   - Failed navigations
   - Guard rejections
   - Component load failures

## Current Status

✅ **Routing bug fixed** - No more Hub appearing with entities
✅ **Build successful** - 0 lint errors
✅ **Ready for enhancement** - Clean routing foundation

**Next Step**: Implement RouterService class for enterprise-grade routing architecture
