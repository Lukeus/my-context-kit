import { computed } from 'vue';
import { RouterService, type RouteParams, type NavigationResult } from '../services/RouterService';
import type { RouteId } from '../config/routes';

// Singleton router service instance
let routerServiceInstance: RouterService | null = null;

function getRouterService(): RouterService {
  if (!routerServiceInstance) {
    routerServiceInstance = new RouterService();
  }
  return routerServiceInstance;
}

/**
 * Composable for routing operations
 * Provides a consistent API for navigation across the app
 * Integrates with RouterService for enterprise routing
 */
export function useRouting() {
  const router = getRouterService();

  /**
   * Current route information
   */
  const currentRoute = computed(() => router.current.value);
  const currentRouteName = computed(() => router.current.value?.id);
  const currentParams = computed(() => router.params.value);
  const currentPath = computed(() => router.current.value?.path || '/');

  /**
   * Navigation functions with RouterService
   */
  async function navigateTo(name: RouteId, params?: RouteParams): Promise<NavigationResult> {
    return await router.navigate(name, params);
  }

  async function goBack(): Promise<NavigationResult> {
    return await router.back();
  }

  async function goForward(): Promise<NavigationResult> {
    return await router.forward();
  }

  /**
   * Route checking functions
   */
  function isRoute(name: RouteId): boolean {
    return currentRouteName.value === name;
  }

  function hasRoute(name: RouteId): boolean {
    return router.hasRoute(name);
  }

  function isRouteActive(name: RouteId, exact = false): boolean {
    if (exact) {
      return currentRouteName.value === name;
    }
    // Check if current route starts with name (for nested routes)
    return String(currentRouteName.value).startsWith(name);
  }

  /**
   * History functions
   */
  const canGoBack = computed(() => router.canGoBack());
  const canGoForward = computed(() => router.canGoForward());

  /**
   * Deep linking helpers (placeholder for future URL-based routing)
   */
  function getDeepLink(name: RouteId, params?: RouteParams): string {
    const route = router.getRoute(name);
    if (!route) return window.location.origin;
    
    let path = route.path;
    if (params) {
      // Replace :param with actual values
      Object.keys(params).forEach(key => {
        path = path.replace(`:${key}`, String(params[key]));
      });
    }
    return `${window.location.origin}#${path}`;
  }

  function copyDeepLinkToClipboard(name: RouteId, params?: RouteParams): void {
    const link = getDeepLink(name, params);
    navigator.clipboard.writeText(link).catch(() => {
      // Silently ignore clipboard errors
    });
  }

  /**
   * Breadcrumb generation
   */
  const breadcrumbs = computed(() => {
    const crumbs: Array<{ name: string; path: string; params?: RouteParams }> = [];
    
    const current = currentRoute.value;
    if (!current) return crumbs;
    
    // Always include hub as root
    crumbs.push({ name: 'Hub', path: '/hub' });

    // Add current route if not hub
    if (current.id !== 'hub') {
      const meta = current.meta;
      crumbs.push({
        name: meta?.title || current.id,
        path: current.path,
        params: currentParams.value
      });
    }

    return crumbs;
  });

  /**
   * Route metadata helpers
   */
  const routeMeta = computed(() => currentRoute.value?.meta);
  const requiresRepo = computed(() => currentRoute.value?.meta?.requiresRepo === true);
  const requiresEntity = computed(() => currentRoute.value?.meta?.requiresEntity === true);
  const routeTitle = computed(() => currentRoute.value?.meta?.title);
  const routeIcon = computed(() => currentRoute.value?.meta?.icon);

  return {
    // Current route info
    currentRoute,
    currentRouteName,
    currentParams,
    currentPath,
    
    // Navigation
    navigateTo,
    goBack,
    goForward,
    
    // Route checking
    isRoute,
    hasRoute,
    isRouteActive,
    
    // History
    canGoBack,
    canGoForward,
    
    // Deep linking
    getDeepLink,
    copyDeepLinkToClipboard,
    
    // Breadcrumbs
    breadcrumbs,
    
    // Metadata
    routeMeta,
    requiresRepo,
    requiresEntity,
    routeTitle,
    routeIcon,
    
    // Router instance for advanced use
    router
  };
}

/**
 * Initialize router with routes
 * Should be called once at app startup
 */
export async function initializeRouter() {
  const router = getRouterService();
  const { routes } = await import('../config/routes');
  router.registerAll(routes);
  
  // Set initial route to hub
  router.navigate('hub');
}

/**
 * Export router service getter for direct access
 */
export { getRouterService };
