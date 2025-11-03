# Quickstart: Unified Assistant & Sidecar Integration

## Goal
Use the unified assistant to run AI tooling sessions entirely through the Python sidecar, with streaming, migration, and approvals enabled.

## Prerequisites
- Node.js 20 LTS + pnpm
- Python 3.11 environment for `context-kit-service`
- Azure OpenAI and/or Ollama credentials configured via env vars (never committed)

## Setup
1. Install dependencies:
   - JS: `pnpm install` at repo root & `app/`
   - Python sidecar: create virtual env, `pip install -e ./context-kit-service` or `pip install -r requirements.txt`
2. Start sidecar service (example): `uvicorn context_kit_service.main:app --port 8088`
3. Start Electron app: in `app/` run `pnpm start`.

## Using the Assistant
1. Open the Assistant panel (unified component).
2. Send a message; streaming renders incrementally (<300ms initial target).
3. Invoke a tool (Validate, Build Graph, Impact, Generate) from tool palette; observe inline status.
4. For edit suggestions, click Apply → review full file diff → approve to apply.
5. Approve or deny risky operations in the approval dialog (telemetry logged).

## Migration
- On first launch post-upgrade, legacy conversation auto-migrates; view migration summary in transcript.
- If failure occurs, use manual import button in assistant settings.

## Capability Manifest
- Auto refresh every 15 min while assistant open.
- Manual refresh via “Refresh Capabilities” action.

## Fallback Behavior
- If sidecar unreachable: banner appears; tooling disabled; conversation still functional.

## Troubleshooting
| Issue | Resolution |
|-------|------------|
| No streaming | Verify provider supports streaming in manifest. |
| Tool timeout | Retry with reduced scope; check sidecar logs. |
| Migration partial | Review migration record; manually re-run import. |
| Missing provider features | Ensure embeddings/tool capabilities present; else provider in limited mode. |

## Next Steps
Consult `data-model.md` and contracts for deeper integration; implement tests per thresholds and decisions.
