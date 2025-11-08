# Quickstart Guide

## Prerequisites
- Current branch: `001-langchain-backend-integration`
- Install dependencies with `pnpm install` in `app/` and `context-kit-service/`
- Ensure LangChain orchestration service is running locally via `pnpm dev` in `context-kit-service`

## Implementation Steps
1. **Path Resolution Integration**
   - Extend main process IPC handlers to expose repository root, feature branch, and spec path discovery (mirroring `common.ps1` logic).
   - Update `assistantBridge` to include resolved paths in session bootstrap and context-reading calls.
2. **Session Bootstrap Integration**
   - Update `assistantBridge` to call `/assistant/sessions` with resolved paths and cache `sessionId`, capability profile, and telemetry context.
   - Wire the response into `assistantStore` initialization.
3. **Streaming Pipeline**
   - Adapt renderer streaming utilities to consume `text/event-stream` from `/tasks/{taskId}/stream` and push chunks to conversation state.
   - Add guards for partial streams so UX marks interrupted responses.
4. **Health Monitoring**
   - Introduce periodic `/assistant/health` polling within preload and expose status via store state.
   - Display outages and fallbacks in assistant UI with telemetry logging.
5. **Capability Toggles**
   - Bind capability map from session bootstrap to UI feature availability and disable unsupported actions.
   - Log configuration refresh timestamps to satisfy observability requirements.
6. **Fallback Path**
   - When capabilities are disabled or tasks fail with unsupported status, trigger documented legacy fallback flows and record events.

## Validation Checklist
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` inside `app/`.
- Execute `pnpm validate`, `pnpm build-graph`, and `pnpm impact` in `context-repo/` after updating capability metadata.
- Capture telemetry samples confirming LangChain identifiers, durations, and fallback events.
- Verify path resolution: confirm IPC handlers return correct `REPO_ROOT`, `CURRENT_BRANCH`, and spec file paths matching PowerShell script behavior.

