import { createRouter as createVueRouter, createWebHashHistory, type Router, type RouteRecordRaw } from 'vue-router';
import { routes } from '../config/routes';
import { useContextStore } from '../stores/contextStore';

// Lazy-loaded components
const DeveloperHub = () => import('../components/DeveloperHub.vue');
const C4DiagramBuilder = () => import('../components/C4DiagramBuilder.vue');
const WelcomeDocumentation = () => import('../components/WelcomeDocumentation.vue');
const GraphView = () => import('../components/GraphView.vue');
const GitPanel = () => import('../components/GitPanel.vue');

/**
 * Convert our enterprise routes to Vue Router format
 */
function convertToVueRoutes(): RouteRecordRaw[] {
  const componentMap: Record<string, any> = {
    'hub': DeveloperHub,
    'c4': C4DiagramBuilder,
    'c4-diagram': C4DiagramBuilder,
    'docs': WelcomeDocumentation,
    'graph': GraphView,
    'git': GitPanel
  };

  return routes.map(route => {
    const vueRoute: RouteRecordRaw = {
      path: route.path,
      name: route.id,
      component: componentMap[route.id] || DeveloperHub,
      meta: route.meta || {},
      beforeEnter: route.beforeEnter
        ? async (to, from, next) => {
            try {
              // Convert our guard to Vue Router format
              const result = await route.beforeEnter!(
                route,
                from.name ? routes.find(r => r.id === from.name) || null : null,
                to.params as any
              );
              
              if (result) {
                next();
              } else {
                // Guard rejected - stay on current route or go to hub
                next(false);
              }
            } catch {
              next(false);
            }
          }
        : undefined
    };

    return vueRoute;
  });
}

/**
 * Create and configure Vue Router
 */
export function createRouter(): Router {
  const router = createVueRouter({
    history: createWebHashHistory(),
    routes: [
      {
        path: '/',
        redirect: '/hub'
      },
      ...convertToVueRoutes(),
      {
        // Catch-all 404
        path: '/:pathMatch(.*)*',
        redirect: '/hub'
      }
    ]
  });

  // Global navigation guards
  router.beforeEach((to, from, next) => {
    // Check if route requires repo
    if (to.meta.requiresRepo) {
      const contextStore = useContextStore();
      if (!contextStore.repoPath || contextStore.repoPath.trim().length === 0) {
        // Show snackbar or notification
        next('/hub');
        return;
      }
    }

    next();
  });

  // Track route changes for analytics
  router.afterEach(() => {
    // TODO: Send to analytics service
    // analytics.track('route_change', {
    //   from: from.name,
    //   to: to.name,
    //   path: to.path
    // });
  });

  // Handle navigation errors
  router.onError(() => {
    // TODO: Show error to user
  });

  return router;
}

/**
 * Get router instance (must be called after app.use(router))
 */
export function useRouter(): Router {
  return createVueRouter({
    history: createWebHashHistory(),
    routes: []
  });
}

/**
 * Navigation helper functions
 */
export const navigation = {
  /**
   * Navigate to a route by name
   */
  async goto(name: string, params?: Record<string, any>): Promise<boolean> {
    const router = useRouter();
    try {
      await router.push({ name, params });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Navigate back
   */
  back(): void {
    const router = useRouter();
    router.back();
  },

  /**
   * Navigate forward
   */
  forward(): void {
    const router = useRouter();
    router.forward();
  },

  /**
   * Replace current route
   */
  async replace(name: string, params?: Record<string, any>): Promise<boolean> {
    const router = useRouter();
    try {
      await router.replace({ name, params });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Check if can go back
   */
  canGoBack(): boolean {
    // Check window.history
    return window.history.length > 1;
  },

  /**
   * Check if can go forward
   */
  canGoForward(): boolean {
    // This is tricky in browsers, not directly available
    // We'd need to track this ourselves
    return false;
  },

  /**
   * Get current route name
   */
  getCurrentRouteName(): string | undefined {
    const router = useRouter();
    return router.currentRoute.value.name as string | undefined;
  },

  /**
   * Get current route params
   */
  getCurrentParams(): Record<string, any> {
    const router = useRouter();
    return router.currentRoute.value.params;
  }
};
