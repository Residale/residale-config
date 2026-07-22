# Fable Launch Prompt — Residale Config Modernization

Launch identity: normal `hermes` Linux user, not root.
Workspace: `/home/hermes/workspace/residale/residale-config`.
SOP: `/home/hermes/prompts/_CLAUDE-PROMPT.md`.

Use exactly one Fable orchestrator/captain. You may use Agent Teams, maximum 2 helper agents. Keep context carefully managed: focused agents, concise artifact handoffs, no giant context dumps. Use latest Sonnet for routine implementation/QA; use Opus only if genuinely needed for architecture/review.

## User request

This is Residale Config under Residale. A teammate made a first version in Lovable; we need to make it ours.

Current live deployment is already on Coolify at `https://config.residale.com`, repo `Residale/residale-config`, branch `main`. Coolify auto-deploy is enabled on merge to main. The app currently uses Vite/TanStack/Lovable config, with a Dockerfile added for Coolify.

The user asks:

1. Decide whether it is better to modify the current app or redo it by copying working parts.
2. Remove Lovable-specific stuff if sensible; evaluate whether to keep Vite/TanStack or move to Next.js.
3. You may archive the current version locally/GitHub under `residale-config-backup` depending on your decision. Do not do destructive cleanup or force-push. If archiving is needed, prefer a safe branch/tag or copied backup with clear artifact notes.
4. Make the app able to produce an attached architectural PDF output similar to the provided reference PDF, with project name setup and configurable layout.
5. Add favorite/spec presets for walls, windows, and doors:
   - Favorite wall specs.
   - Windows: main 2–3 European window types.
   - Doors: interior doors, full exterior doors, exterior glass doors, terrace door-windows, large windows/sliding bays.
6. Work slowly and end-to-end: plan, implement, test, use Playwright if appropriate, commit, push, deploy, live verify.
7. Always write markdown artifacts at repo root under:
   - `_resources/PLANNING/`
   - `_resources/REVIEW/`
   - `_resources/IMPLEMENTATION/`
   Filenames must be `YYYY-MM-DD-HH-mm <title>.md`.
8. At the end, think through adding a Hermes profile on the Residale VPS for an integrated right-side assistant slider. Do not rotate credentials or expose a tool-capable raw Hermes agent to users. If implementation is too much for this phase, write a clear plan/artifact for it.

## Reference PDF

Original uploaded PDF path available to Hermes/root:
`/root/.hermes/cache/documents/doc_688e21e9d242_AURA_48_PMR_Habitat.pdf`

Copied/rendered inputs inside the repo:
- `_resources/INPUTS/AURA_48_PMR_Habitat-page-1.png`
- `_resources/INPUTS/AURA_48_PMR_Habitat-extracted-text.txt`

Visual summary of reference PDF:
- Single portrait architectural sheet with thin page border and title block at bottom.
- Title block columns: left `RESIDALE SAS`, center project `AURA 48`, right version `V1`, scale label `Echelle`, scale `1:100`.
- Main top area: centered 2D floor plan, roughly 8.000m x 6.000m, with dimension lines around the plan.
- Elevation callouts around plan: `North Elevation` above, `South Elevation` below, `West Elevation` vertically left, `East Elevation` vertically right, each with triangular marker.
- Plan contains exterior/interior walls, bedroom/bathroom/kitchen-like fixtures, openings, doors with swing arcs, furniture, and windows.
- Lower sheet area: four elevation drawings on grey facade rectangles, each dimensioned. Visible labels/dimensions include 8.000, 6.000, 2.500, 2.145, 0.355.
- Output needs a PDF layout engine: paper size/margins/title block, scale conversion, floor-plan viewport fitting, dimension annotations, elevation preview generation, symbols for doors/windows/walls/furniture, project metadata/version/scale.

## Current repo facts to verify yourself

- Path: `/home/hermes/workspace/residale/residale-config`
- Current branch should start from `main` at merged deploy config commit.
- Existing app can build with `npm run build`.
- Existing Dockerfile runs Node server on port 3000.
- Existing lint currently has many Prettier/style issues from Lovable-generated code; do not blindly reformat everything unless that is part of the migration strategy and you can review the diff.

## Required delivery

Produce:
1. A planning artifact deciding the architecture route: keep/refactor vs rewrite/copy; Lovable removal strategy; framework recommendation.
2. Implementation artifacts and code changes for the chosen first production-grade slice.
3. A PDF export feature approximating the reference sheet with configurable project name/version/scale/layout enough to demonstrate AURA-style output.
4. Door/window/wall favorite spec presets in the UI/model.
5. Tests/build verification. Use Playwright/browser checks where useful.
6. Commit(s), push, PR/merge if safe, Coolify deployment, live verification at `https://config.residale.com`.
7. Final implementation report under `_resources/IMPLEMENTATION/` covering changed files, gates run, deployment/live verification, and remaining risks.
8. A review/plan artifact for the future in-app Hermes assistant slider/profile integration, following the safe pattern: app-owned scoped context -> private project Hermes profile/shim -> no raw user tool/VPS access.

## Guardrails

Allowed: code/config edits, adding tests, local builds, Playwright, commits, pushes, PRs, merges, Coolify deploy verification, live route verification.

Pause/ask before: force-pushes, deleting production data, credential rotation, billing changes, irreversible DB migrations, destructive cleanup, or exposing Hermes/tool access publicly.

Do not claim deployed until live route is verified. Separate code pushed / PR merged / Coolify deployed / live browser verified.

When done, print a concise final summary and exact artifact paths. Also include actual spawned helper count/roles/models if available.
