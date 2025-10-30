import type { Route } from '../services/RouterService';
import { requiresRepo, requiresEntity, combineGuards, trackNavigation } from './routeGuards';

/**
 * Application route configuration
 * Centralized definition of all routes with metadata and guards
 * 
 * Constitutional Compliance:
 * - Static, analyzable route definitions (Principle II: Deterministic)
 * - Observable navigation flow via trackNavigation guard
 * - Type-safe route IDs for compile-time verification
 */
export const routes: Route[] = [
  {
    id: 'hub',
    path: '/hub',
    meta: {
      title: 'Developer Hub',
      icon: 'home'
    },
    beforeEnter: trackNavigation
  },
  {
    id: 'entities',
    path: '/entities',
    meta: {
      title: 'Context Tree',
      icon: 'tree',
      requiresRepo: true
    },
    beforeEnter: combineGuards(trackNavigation, requiresRepo)
  },
  {
    id: 'entity',
    path: '/entities/:id',
    meta: {
      title: 'Entity View',
      requiresRepo: true,
      requiresEntity: true
    },
    beforeEnter: combineGuards(trackNavigation, requiresRepo, requiresEntity)
  },
  {
    id: 'c4',
    path: '/c4',
    meta: {
      title: 'C4 Architecture',
      icon: 'diagram'
    },
    beforeEnter: trackNavigation
  },
  {
    id: 'c4-diagram',
    path: '/c4/:diagramId',
    meta: {
      title: 'C4 Diagram',
      icon: 'diagram'
    },
    beforeEnter: trackNavigation
  },
  {
    id: 'graph',
    path: '/graph',
    meta: {
      title: 'Dependency Graph',
      icon: 'network',
      requiresRepo: true
    },
    beforeEnter: combineGuards(trackNavigation, requiresRepo)
  },
  {
    id: 'git',
    path: '/git',
    meta: {
      title: 'Git Workflow',
      icon: 'git',
      requiresRepo: true
    },
    beforeEnter: combineGuards(trackNavigation, requiresRepo)
  },
  {
    id: 'validate',
    path: '/validate',
    meta: {
      title: 'Schema Validation',
      icon: 'check',
      requiresRepo: true
    },
    beforeEnter: combineGuards(trackNavigation, requiresRepo)
  },
  {
    id: 'docs',
    path: '/docs',
    meta: {
      title: 'Documentation',
      icon: 'book'
    },
    beforeEnter: trackNavigation
  },
  {
    id: 'ai',
    path: '/ai',
    meta: {
      title: 'AI Assistant',
      icon: 'assistant'
    },
    beforeEnter: trackNavigation
  }
];

/**
 * Route ID type for type-safe navigation
 */
export type RouteId = typeof routes[number]['id'];

/**
 * Get route by ID with type safety
 */
export function getRouteById(id: RouteId): Route | undefined {
  return routes.find(route => route.id === id);
}

/**
 * Get all routes that don't require a repository
 */
export function getPublicRoutes(): Route[] {
  return routes.filter(route => !route.meta?.requiresRepo);
}

/**
 * Get all routes that require a repository
 */
export function getProtectedRoutes(): Route[] {
  return routes.filter(route => route.meta?.requiresRepo);
}

/**
 * Get navigation rail items (main navigation)
 */
export function getNavRailRoutes(): Route[] {
  return routes.filter(route => 
    ['hub', 'entities', 'c4', 'graph', 'git', 'validate', 'docs', 'ai'].includes(route.id)
  );
}
