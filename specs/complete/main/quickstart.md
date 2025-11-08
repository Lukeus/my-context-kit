# Quickstart: Spec Kit Context Generator

## Prerequisites
- Node.js 22 LTS with pnpm (Corepack enabled)
- Context repository checked out at `context-repo/`
- Network access to `https://github.com/github/spec-kit`
- Git credentials configured for cloning public repositories

## 1. Fetch Spec Kit assets
```bash
cd context-repo
pnpm exec node .context/pipelines/speckit-fetch.mjs --repoPath %CD%
```
- Uses the latest Spec Kit release by default.
- To pin a specific tag:
  ```bash
  pnpm exec node .context/pipelines/speckit-fetch.mjs --repoPath %CD% --releaseTag v0.0.79
  ```
- Results are cached under `.context/speckit-cache/<tag>` and summarised in `.context/state/speckit-fetch.json`.

## 2. Launch Context-Sync and open Speckit Workflow
1. Start the desktop app: `cd app && pnpm start`.
2. From the command palette, choose **Speckit Workflow** or press the UI button.
3. Confirm the repository path matches your `context-repo` clone.

## 3. Generate entities from fetched content
1. In Step 0 (new), click **Fetch Spec Kit** to trigger the pipeline via UI.
2. Once complete, browse the cached docs/templates and choose the specification to import.
3. Continue with **Create Specification**, **Generate Plan**, and **Generate Tasks** steps.
4. Enable "Generate YAML Entities" to write features/stories into `contexts/`.

## 4. Validate pipelines
After entity creation run:
```bash
cd context-repo
pnpm validate
pnpm build-graph
pnpm impact
pnpm generate
```
Each command should exit `0` and produce updated artifacts.

## 5. Update C4 diagram
- Edit `context-repo/c4/context-sync-mvp.md` to reflect the new fetch pipeline and external dependency.
- Commit diagram changes alongside entity updates.

## 6. Commit workflow outputs
1. Stage modified files in `context-repo` (YAML entities, generated prompts, cache state, C4 diagram).
2. Stage complementary UI changes in `app/` if any.
3. Run tests from `app`:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm test:e2e -- --grep "Speckit"
   ```
4. Prepare PR referencing this plan.
