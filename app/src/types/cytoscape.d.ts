/**
 * Minimal local typings for cytoscape used in the app during development and tests.
 * This avoids pulling in the external @types/cytoscape package while keeping
 * enough shape information for our usage in GraphView/EntityDependencyGraph.
 * Expand as needed if you rely on more of the API.
 */
declare module 'cytoscape' {
  export type Collection = any;
  export type Core = any;
  export type NodeSingular = any;
  export type EdgeSingular = any;

  export default function cytoscape(options?: Record<string, unknown>): Core;
}

export {};
