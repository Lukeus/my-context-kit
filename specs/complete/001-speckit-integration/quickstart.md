# Quickstart: Spec Kit Context Integration

## Prerequisites
- Node.js 22 LTS with pnpm (Corepack enabled)
- `github/spec-kit` accessible over HTTPS
- Context-Sync workspace cloned with `context-repo/` and `app/`
- Git configured for committing cache and entity updates

## 1. Fetch Spec Kit assets
```bash
cd context-repo
pnpm exec node .context/pipelines/speckit-fetch.mjs --repoPath %CD%
```
- Pin a release tag if desired:
  ```bash
  pnpm exec node .context/pipelines/speckit-fetch.mjs --repoPath %CD% --releaseTag v0.0.79
  ```
- Fetch results appear in `.context/state/speckit-fetch.json` and `.context/speckit-cache/<tag>/`.

## 2. Launch Context-Sync with new workflow
```bash
cd app
pnpm start
```
- Open **Speckit Workflow** from the command palette.
- Confirm the repository path matches your `context-repo` location.

## 3. Preview Spec Kit content
1. Click **Fetch Spec Kit** to hydrate the cache (skips if fresh).
2. Browse markdown files grouped by entity type.
3. Use search/filter to locate templates relevant to your feature.

## 4. Generate entities
1. Select templates to seed features/user stories/specs.
2. Confirm the preview matches expectations.
3. Generate entities; the app writes YAML into `contexts/` and records provenance.

## 5. Review automated pipeline results
- After generating entities in the Speckit Workflow, the application automatically runs `validate`, `build-graph`, `impact`, and `generate` in sequence.
- The pipeline status panel shows pass/fail states, generated file paths, and the Spec Kit previews used as sources. Use the copy controls to inspect files directly.
- If any stage fails, resolve the reported errors and rerun entity generation to trigger the pipeline chain again.

### Manual rerun (optional)
```bash
cd context-repo
pnpm validate
pnpm build-graph
pnpm impact
pnpm generate
```
- Manual commands are still available for local verification or when running pipelines outside the desktop app.

## 6. Update C4 diagrams
- Edit `context-repo/c4/context-sync-mvp.md` (and component diagram) to reflect the Spec Kit fetch boundary and pipeline flow.
- Commit diagram updates with the same change set.

## 7. Commit & tests
```bash
cd app
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e -- --grep "Spec Kit"
```
- Stage modifications in both `context-repo` and `app`.
- Include `.context/state/speckit-fetch.json` if updated.
- Prepare PR referencing this plan.
