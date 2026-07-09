# Floor Whisper Modernization — Architecture Plan

Date: 2026-07-09 08:14 · Author: Claude Fable (orchestrator) · Repo: `Residale/floor-whisper` @ `2d4fd97`

## 1. Decision: modify in place, do not rewrite

**Route chosen: keep and refactor the current app.** No rewrite, no framework migration.

Evidence gathered from the codebase:

- The app is a compact, well-factored floor-plan editor: ~6.6k lines of app code split into a pure model layer (`src/lib/editor/` — types, geometry, wall geometry, sections, rooms, opening defaults, zustand store) and a view layer (`src/components/editor/` — Konva 2D canvas, three.js 3D view, panels).
- `npm run build` passes cleanly today (verified locally, exit 0). The Dockerfile + nitro `node-server` preset already deploys on Coolify at `config.residale.com`.
- Domain logic quality is genuinely good: openings already model French/European kinds (`door_simple/door_double/door_slide/door_pocket/entrance/window_1/window_2/window_oscillo/bay/bay_slide/fixed`) with per-kind width/height/sill defaults; `computeSection` already computes both cut sections *and* facade (elevation) projections with openings — exactly what the AURA sheet needs.
- A jsPDF export (`pdf-export.ts`, 3-page landscape dossier) already exists and works as a foundation.

A rewrite would re-earn all of this at high risk for zero user-visible gain.

## 2. Framework: keep Vite + TanStack Start, do not move to Next.js

- The product is a **client-heavy canvas editor** (Konva + three.js, zustand, everything client-side; state persisted in localStorage). SSR/RSC — Next.js's differentiators — are irrelevant to this workload; the editor components are inherently client-only.
- TanStack Start on nitro `node-server` already produces a small Node server that Coolify runs happily. Migrating to Next.js means redoing routing, config, Dockerfile, and deploy verification to end up in the same place.
- Team ownership concern ("Lovable config magic") is solved by de-Lovable-ing the config (below), not by changing framework.
- Revisit trigger: if Floor Whisper later needs auth, DB-backed projects, or multi-page marketing/SEO surface, reassess — TanStack Start server routes can carry that too, so Next.js still wouldn't be automatic.

## 3. Lovable removal strategy (make it ours)

Footprint audited via grep; it is small and fully removable:

| Item | Action |
|---|---|
| `@lovable.dev/vite-tanstack-config` (devDep, wraps all vite plugins) | Replace `vite.config.ts` with an explicit config: `@tanstack/react-start` plugin, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths`, nitro `node-server`, server entry `src/server.ts`. Remove the dep. |
| `src/lib/lovable-error-reporting.ts` + import in `src/routes/__root.tsx` | Delete file, remove import/usage. Keep the generic `src/lib/error-capture.ts` SSR error wrapper if it has no Lovable endpoint (assess; strip any phone-home). |
| Lovable-hosted OG/twitter image URLs in `__root.tsx` | Replace with local `/og.png` or drop. |
| `.lovable/` (plan.md, project.json) | Delete. |
| `AGENTS.md` Lovable block | Replace with a short real project note. |
| `bun.lock`, `bunfig.toml` | Delete — Docker/Coolify build uses `npm ci` + `package-lock.json`; two lockfiles is a trap. |
| Lovable "componentTagger" and sandbox detection (came from the wrapper) | Disappear automatically with the wrapper. |
| `package.json` name `tanstack_start_ts` | Rename to `floor-whisper`. |
| Prettier/style debt from generated code | **Not** mass-reformatted this phase (per instruction); lint config untouched. |

Gate: `npm run build` must pass and the built server must serve the editor before this lands.

## 4. Archival

Before any modernization commit:
- Branch `floor-whisper-backup` created at `2d4fd97` and pushed to origin (safe, non-destructive).
- Tag `v0-lovable-baseline` at the same commit, pushed.
No force-pushes, no history rewrites (also required while Lovable sync may still be connected).

## 5. Feature slice this phase

### 5.1 AURA-style architectural sheet PDF (core deliverable)
New module `src/lib/editor/sheet-export.ts` drawing **vector** output with jsPDF (crisper than PNG capture, true-to-scale):
- Portrait sheet (A4/A3 selectable), thin page border, bottom title block: `RESIDALE SAS` | project name | `V1` + `Echelle` + `1:100` — all configurable (company, project, version, scale, paper).
- Plan viewport at true scale (1:100 → 1 cm real = 0.1 mm paper); auto-fallback to nearest standard scale (1:50/75/100/125/150/200) if the plan doesn't fit, with the effective scale printed in the title block.
- Walls as outlined/filled rects from the model; openings as gaps with door-swing arcs and window double-lines; optional furniture outlines; overall dimension lines (meters, `8.000` style) top/left.
- Elevation callouts `North/South/East/West Elevation` with triangle markers around the plan.
- Four facade elevations in the lower sheet area (grey facade rectangles + openings + height/width dims), computed via `computeSection` with projection lines placed outside the building bbox.
- UI: "Plan architecte (PDF)" action in TopBar opening a small config dialog (project/version/scale/paper/options); sheet settings persisted.
- Existing 3-page dossier export stays as-is.

### 5.2 Favorite/spec presets for walls, windows, doors
New `src/lib/editor/presets.ts` + store slice + UI:
- **Built-in door presets**: porte intérieure 73/83/93, porte coulissante/à galandage, porte d'entrée pleine 90×215, porte d'entrée vitrée, porte-fenêtre 1/2 vantaux, baie vitrée coulissante 240/300.
- **Built-in window presets**: fenêtre 1 vantail 60×95, fenêtre 2 vantaux 120×125 (+135), oscillo-battant 100×115 — the 2–3 main European types, with sill heights.
- **Built-in wall presets**: mur extérieur RT2012/RE2020 (e.g. 30 cm), mur porteur intérieur 20 cm, cloison 7/10 cm — thickness/height/type.
- **User favorites**: save current wall/opening spec as a named favorite (persisted via zustand persist); apply on selection or as default for the draw tools.

### 5.3 Out of scope this phase
Multi-floor, auth/projects backend, DXF export, full furniture elevations, Hermes assistant slider (plan-only artifact, see §8 of the final report).

## 6. Verification plan
- `npm run build` after each slice; typecheck via build.
- Playwright (chromium) against the production build served locally: app loads, editor canvas renders, presets apply, sheet PDF export produces a download; plus a live smoke against `https://config.residale.com` after deploy.
- Manual visual check of one exported sheet vs the AURA reference PNG.

## 7. Delivery & deployment
- Commits in small logical units on `main` (Coolify auto-deploys on push to main): backup/artifacts → de-Lovable → sheet export → presets → tests/report.
- Direct push to `main` (repo is pre-1.0 internal; PR overhead not required; no force-push). Live verification at `https://config.residale.com` before claiming deployed.

## 8. Team shape (context discipline)
- 1 orchestrator (Fable, this session): planning, sheet-export implementation, reviews, deploy, artifacts.
- Helper 1 (Sonnet): de-Lovable migration slice (§3), build-verified.
- Helper 2 (Sonnet): presets slice (§5.2), owning `store.ts`/panels to avoid file conflicts with orchestrator's sheet work.
- Sequencing: backup → helper 1 → (orchestrator sheet ∥ helper 2 presets, disjoint file ownership) → tests → deploy.

## 9. Risks
- Explicit vite config drifting from the Lovable wrapper's behavior → mitigated by build + Playwright smoke on the production build.
- jsPDF arc/vector fidelity for door swings → acceptable via bezier approximation; verified visually.
- Coolify build environment differences (npm ci with updated package-lock) → verify live after deploy; backup branch enables instant redeploy of the old image if needed.
- Lovable may still be connected to the repo; pushing to main syncs back to Lovable — harmless, and history is never rewritten.
