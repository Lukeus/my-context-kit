# Sidecar Client (Renderer Layer)

> Status: INITIAL DRAFT (T004) – Subject to expansion during unified assistant integration.
>
> TODO(T004-Future): Add diagrams showing request lifecycle and capability manifest refresh.

The sidecar client layer in the renderer is responsible for **interacting with the LangChain / FastAPI sidecar** via IPC bridges exposed in `preload/`. It should provide a thin, typed abstraction for higher-level stores and components (e.g., `assistantStore`) without embedding tool orchestration or business rules.

## Goals
- Centralise sidecar invocation patterns (health, capabilities, pipelines, context reads).
- Enforce **read vs. write separation** and require approvals for risky operations.
- Maintain **request provenance** (session + telemetry correlation IDs).
- Support graceful degradation (fallback messaging when sidecar is unhealthy).

## Non-Goals
- Implement business logic (belongs in stores/services).
- Direct DOM manipulation or UI state management.
- Embedding model-specific prompt templates.

## Design Principles
1. **Idempotent Fetchers**: Pure read operations should avoid side effects.
2. **Explicit Capability Checks**: Invoke tools only if capability is enabled in the manifest.
3. **Structured Errors**: Return `{ ok: false, error, code }` envelopes – never throw raw errors unless fatal.
4. **Telemetry First**: Every invocation should include metadata for correlation.
5. **Thin Adaptation**: Never reimplement logic already handled by the main process.

## Suggested Directory Layout
```
services/sidecar/
  README.md                 # This file
  client.ts                 # High-level facade (TODO)
  health.ts                 # Health polling helpers (existing pattern: langchain/health)
  capabilities.ts           # Capability manifest cache (existing pattern: langchain/capabilities)
  pipelines.ts              # Pipeline execution wrappers (TODO)
  context.ts                # Context file read helpers (TODO)
```

## Typing Conventions
Use shared types from `@shared/assistant/types` and avoid duplicating request/response models. When the sidecar API adds new endpoints, generate/update OpenAPI-derived TypeScript types in `src/shared/`.

## Invocation Pattern
```
// Example (pseudo-code)
import { sidecarClient } from '@/services/sidecar/client';

const result = await sidecarClient.runPipeline({
  sessionId,
  repoPath,
  pipeline: 'validate'
});

if (!result.ok) {
  // Surface error to store
}
```

## Error Envelope
```
interface SidecarErrorEnvelope {
  ok: false;
  error: string;
  code?: string;            // machine readable (e.g. 'HEALTH_UNAVAILABLE')
  retryable?: boolean;
}

interface SidecarSuccessEnvelope<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>; // timing, trace ids
}
```

## Health Degradation Strategy
| State      | Behavior                                                    |
|------------|-------------------------------------------------------------|
| healthy    | All operations allowed                                      |
| degraded   | All read operations + non-destructive tools allowed         |
| unhealthy  | Read-only operations only (no pipelines, no write tools)    |
| unknown    | Treat as unhealthy until first poll                        |

## Capability Gate Example
```
if (!capabilities.has('pipeline.run')) {
  return { ok: false, error: 'Pipeline tool not enabled in capability profile.', code: 'CAPABILITY_DISABLED' };
}
```

## Telemetry Hooks (Planned)
TODO(T004-Telemetry): Add onBeforeInvoke / onAfterInvoke registration to allow stores to emit structured telemetry records.

## Future Enhancements
- Automatic backoff + retry for transient network errors.
- Circuit breaker around repeated failures.
- Unified diff summarisation helper for file-edit tools.
- Streaming support pass-through with incremental token events.

## Removal Criteria
This documentation should be updated and marked COMPLETE when:
- All sidecar interaction modules (`client.ts`, `pipelines.ts`, `context.ts`) are implemented.
- Telemetry hooks integrated.
- Capability gating enforced in all helpers.
- Unified assistant fully migrated off legacy `aiStore`.

---
Maintained as part of feature: 001-assistant-sidecar-unify
