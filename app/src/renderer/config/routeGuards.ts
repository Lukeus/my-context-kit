import type { Route, RouteParams, RouteGuard } from '../services/RouterService';
import { useContextStore } from '../stores/contextStore';

/**
 * Guard that requires a repository to be configured
 */
export const requiresRepo: RouteGuard = async () => {
  const contextStore = useContextStore();
  
  if (!contextStore.repoPath || contextStore.repoPath.trim().length === 0) {
    return false;
  }
  
  return true;
};

/**
 * Guard that requires an active entity to be selected
 */
export const requiresEntity: RouteGuard = async () => {
  const contextStore = useContextStore();
  
  if (!contextStore.activeEntity) {
    return false;
  }
  
  return true;
};

/**
 * Guard that checks if user has specific permissions
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const requiresPermissions = (_permissions: string[]): RouteGuard => {
  return async () => {
    // TODO: Implement permission checking against CONST-CTX-SYNC
    // For now, always allow
    return true;
  };
};

/**
 * Guard that validates route parameters
 */
export const validateParams = (validator: (params: RouteParams) => boolean): RouteGuard => {
  return async (to: Route, from: Route | null, params?: RouteParams) => {
    if (!params || !validator(params)) {
      return false;
    }
    return true;
  };
};

/**
 * Combine multiple guards
 */
export function combineGuards(...guards: RouteGuard[]): RouteGuard {
  return async (to: Route, from: Route | null, params?: RouteParams) => {
    for (const guard of guards) {
      const result = await guard(to, from, params);
      if (!result) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Guard that logs navigation for analytics
 */
export const trackNavigation: RouteGuard = async () => {
  // TODO: Send to analytics service
  // analytics.track('route_change', { from: from?.id, to: to.id });
  
  return true;
};

/**
 * Guard that checks feature flags
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const requiresFeatureFlag = (flagName: string): RouteGuard => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async (to: Route) => {
    // TODO: Implement feature flag checking
    // const flags = await featureFlagService.get(flagName);
    // if (!flags[flagName]) {
    //   console.warn(`Route "${to.id}" requires feature flag "${flagName}"`);
    //   return false;
    // }
    return true;
  };
};

/**
 * Guard that ensures entities are loaded
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ensureEntitiesLoaded: RouteGuard = async (to: Route) => {
  const contextStore = useContextStore();
  
  if (contextStore.entityCount === 0 && contextStore.repoPath) {
    // Trigger entity loading
    await contextStore.loadGraph();
  }
  
  return true;
};

/**
 * Guard that prevents navigation during loading states
 */
export const preventDuringLoading: RouteGuard = async () => {
  const contextStore = useContextStore();
  
  if (contextStore.isLoading) {
    return false;
  }
  
  return true;
};
