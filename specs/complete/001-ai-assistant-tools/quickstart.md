# Quickstart: AI Assistant Safe Tooling Upgrade

## 1. Install dependencies

```bash
cd app
pnpm install
```

## 2. Configure providers and context paths

- Copy `app/.env.example` to `.env` and fill in:
  - `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
  - Optional `AZURE_OPENAI_API_VERSION`, temperature, and logprob flags
  - `OLLAMA_URL` (defaults to `http://localhost:11434`)
  - `CONTEXT_REPO_PATH` pointing to the checked-out `context-repo`
- Keep secrets out of source control; restart the app after changes.

## 3. Launch the desktop app

```bash
pnpm start
```

- Open the Assistant sidebar and create a session (Azure or Ollama).
- Ensure the session banner shows as active before running tools.

## 4. Run a safe pipeline via the Tool Panel

1. Open **Assistant ▸ Tool Panel**.
2. Select the pipeline:
   - `validate`
   - `build-graph`
   - `impact` (requires comma-separated `changedIds`)
   - `generate` (requires comma-separated `ids`)
3. Confirm the resolved repository path matches your `CONTEXT_REPO_PATH`.
4. Provide IDs when prompted and click **Run pipeline**.
5. Watch the inline feedback banner for success or error results.

## 5. Verify telemetry logging

- Use the **Refresh** button in the Tool Panel to load the latest entries.
- Telemetry is written to the Electron `userData` directory under
  `logs/assistant-tools/<session-id>.json`.
- Each record includes parameters, pipeline status, timestamps, and `repoPath`.

## 6. Execute automated tests

```bash
pnpm test assistant
pnpm e2e --filter assistant
```

- Confirm pipeline specs assert telemetry metadata.
- Validate unauthorized tool calls are rejected.

## 7. Run deterministic context pipelines (optional verification)

```bash
cd ../context-repo
pnpm validate
pnpm impact
```

- Use these commands to cross-check assistant output with direct runs.

## 8. Next steps for change proposal flows

- For write or PR tooling, trigger a diff preview, approve the action,
  and ensure telemetry captures the approval state (see upcoming US3 tasks).

## 9. Documentation touchpoints

- Sync architecture updates in `context-repo/c4/*.md`.
- Capture any new operational notes in `docs/ai-enhancements-implementation-plan.md`.
