import { ref, type Ref, type Component } from 'vue';

/**
 * Route metadata for access control and display
 */
export interface RouteMeta {
  title?: string;
  icon?: string;
  requiresRepo?: boolean;
  requiresEntity?: boolean;
  requiresAuth?: boolean;
  permissions?: string[];
}

/**
 * Navigation parameters for dynamic routes
 */
export interface RouteParams {
  [key: string]: string | number | undefined;
}

/**
 * Route guard function signature
 */
export type RouteGuard = (
  to: Route,
  from: Route | null,
  params?: RouteParams
) => boolean | Promise<boolean>;

/**
 * Route definition for the application
 */
export interface Route {
  id: string;
  path: string;
  component?: Component;
  meta?: RouteMeta;
  beforeEnter?: RouteGuard;
  children?: Route[];
}

/**
 * Navigation entry for history tracking
 */
export interface NavigationEntry {
  route: Route;
  params?: RouteParams;
  timestamp: number;
}

/**
 * Navigation result
 */
export interface NavigationResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Enterprise Router Service
 * Provides centralized routing with guards, history, and analytics
 */
export class RouterService {
  private routes: Map<string, Route> = new Map();
  private currentRoute: Ref<Route | null> = ref(null);
  private currentParams: Ref<RouteParams> = ref({});
  private history: NavigationEntry[] = [];
  private historyIndex = -1;
  private maxHistorySize = 50;
  private navigationCallbacks: Set<(to: Route, from: Route | null) => void> = new Set();

  /**
   * Register a route
   */
  register(route: Route): void {
    this.routes.set(route.id, route);
    
    // Register children
    if (route.children) {
      route.children.forEach(child => {
        this.routes.set(child.id, child);
      });
    }
  }

  /**
   * Register multiple routes
   */
  registerAll(routes: Route[]): void {
    routes.forEach(route => this.register(route));
  }

  /**
   * Navigate to a route by ID
   */
  async navigate(routeId: string, params?: RouteParams): Promise<NavigationResult> {
    const route = this.routes.get(routeId);
    
    if (!route) {
      return {
        success: false,
        error: `Route "${routeId}" not found`
      };
    }

    // Check if navigation is allowed
    const canActivate = await this.canActivate(route, params);
    
    if (!canActivate.success) {
      return canActivate;
    }

    // Store previous route
    const from = this.currentRoute.value;

    // Update current route
    this.currentRoute.value = route;
    this.currentParams.value = params || {};

    // Add to history (truncate forward history if navigating from middle)
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({
      route,
      params,
      timestamp: Date.now()
    });

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    // Notify listeners
    this.notifyNavigationCallbacks(route, from);

    return { success: true };
  }

  /**
   * Navigate back in history
   */
  async back(): Promise<NavigationResult> {
    if (!this.canGoBack()) {
      return {
        success: false,
        error: 'No previous route in history'
      };
    }

    this.historyIndex--;
    const entry = this.history[this.historyIndex];

    this.currentRoute.value = entry.route;
    this.currentParams.value = entry.params || {};

    this.notifyNavigationCallbacks(entry.route, this.currentRoute.value);

    return { success: true };
  }

  /**
   * Navigate forward in history
   */
  async forward(): Promise<NavigationResult> {
    if (!this.canGoForward()) {
      return {
        success: false,
        error: 'No forward route in history'
      };
    }

    this.historyIndex++;
    const entry = this.history[this.historyIndex];

    this.currentRoute.value = entry.route;
    this.currentParams.value = entry.params || {};

    this.notifyNavigationCallbacks(entry.route, this.currentRoute.value);

    return { success: true };
  }

  /**
   * Check if route can be activated
   */
  private async canActivate(route: Route, params?: RouteParams): Promise<NavigationResult> {
    // Run route guard if present
    if (route.beforeEnter) {
      try {
        const result = await route.beforeEnter(route, this.currentRoute.value, params);
        
        if (!result) {
          return {
            success: false,
            error: 'Route guard rejected navigation'
          };
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Route guard failed'
        };
      }
    }

    return { success: true };
  }

  /**
   * Check if can navigate back
   */
  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Check if can navigate forward
   */
  canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Get current route (reactive)
   */
  get current(): Ref<Route | null> {
    return this.currentRoute;
  }

  /**
   * Get current route parameters (reactive)
   */
  get params(): Ref<RouteParams> {
    return this.currentParams;
  }

  /**
   * Get current route (deprecated - use .current instead)
   */
  getCurrentRoute(): Ref<Route | null> {
    return this.current;
  }

  /**
   * Get current route parameters (deprecated - use .params instead)
   */
  getCurrentParams(): Ref<RouteParams> {
    return this.params;
  }

  /**
   * Get navigation history
   */
  getHistory(): NavigationEntry[] {
    return [...this.history];
  }

  /**
   * Get route by ID
   */
  getRoute(routeId: string): Route | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Check if route exists
   */
  hasRoute(routeId: string): boolean {
    return this.routes.has(routeId);
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear navigation history
   */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
  }

  /**
   * Subscribe to navigation changes
   */
  onNavigate(callback: (to: Route, from: Route | null) => void): () => void {
    this.navigationCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.navigationCallbacks.delete(callback);
    };
  }

  /**
   * Notify navigation callbacks
   */
  private notifyNavigationCallbacks(to: Route, from: Route | null): void {
    this.navigationCallbacks.forEach(callback => {
      try {
        callback(to, from);
      } catch (error) {
        console.error('Navigation callback error:', error);
      }
    });
  }

  /**
   * Check if a route exists
   */
  hasRoute(routeId: string): boolean {
    return this.routes.has(routeId);
  }

  /**
   * Get breadcrumb trail for current route
   */
  getBreadcrumbs(): Array<{ route: Route; params?: RouteParams }> {
    const breadcrumbs: Array<{ route: Route; params?: RouteParams }> = [];
    
    if (!this.currentRoute.value) {
      return breadcrumbs;
    }

    // For now, just return current route
    // In full implementation, this would traverse parent routes
    breadcrumbs.push({
      route: this.currentRoute.value,
      params: this.currentParams.value
    });

    return breadcrumbs;
  }

  /**
   * Export navigation state for persistence
   */
  exportState(): {
    currentRouteId: string | null;
    currentParams: RouteParams;
    history: Array<{ routeId: string; params?: RouteParams; timestamp: number }>;
    historyIndex: number;
  } {
    return {
      currentRouteId: this.currentRoute.value?.id || null,
      currentParams: this.currentParams.value,
      history: this.history.map(entry => ({
        routeId: entry.route.id,
        params: entry.params,
        timestamp: entry.timestamp
      })),
      historyIndex: this.historyIndex
    };
  }

  /**
   * Restore navigation state from persistence
   */
  async restoreState(state: {
    currentRouteId: string | null;
    currentParams: RouteParams;
    history: Array<{ routeId: string; params?: RouteParams; timestamp: number }>;
    historyIndex: number;
  }): Promise<void> {
    // Restore history
    this.history = state.history
      .map(entry => {
        const route = this.routes.get(entry.routeId);
        if (!route) return null;
        
        return {
          route,
          params: entry.params,
          timestamp: entry.timestamp
        };
      })
      .filter(entry => entry !== null) as NavigationEntry[];

    this.historyIndex = Math.min(state.historyIndex, this.history.length - 1);

    // Restore current route
    if (state.currentRouteId) {
      await this.navigate(state.currentRouteId, state.currentParams);
    }
  }
}

/**
 * Create a singleton router instance
 */
let routerInstance: RouterService | null = null;

export function createRouter(): RouterService {
  if (!routerInstance) {
    routerInstance = new RouterService();
  }
  return routerInstance;
}

export function useRouter(): RouterService {
  if (!routerInstance) {
    throw new Error('Router not initialized. Call createRouter() first.');
  }
  return routerInstance;
}
