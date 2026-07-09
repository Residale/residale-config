# Floor Whisper Implementation Report

## Summary

Fable was launched as the normal `hermes` user from `/home/hermes/workspace/residale/floor-whisper` using Fable as orchestrator with Agent Teams allowed up to 2 helpers. It completed the architecture plan and began implementation, then hit the Fable 5 usage limit. Hermes/controller completed the safe remaining implementation and verification.

## Architecture decision

Decision artifact: `_resources/PLANNING/2026-07-09-08-14 Floor Whisper modernization plan.md`.

Decision: keep and refactor the current app. Do not rewrite and do not migrate to Next.js now.

Reason: the existing app already has useful floor-plan domain code, geometry, sections/elevations, jsPDF dependencies, and a working Coolify/Vite/TanStack deployment. The risk is Lovable ownership/config magic, not the framework itself.

## Backup/archive

Created before modernization work:

- Git branch: `floor-whisper-backup`
- Git tag: `v0-lovable-baseline`

Both point at the pre-modernization baseline commit after the input artifacts were added.

## What changed

### De-Lovable

- Removed `.lovable/` files.
- Removed `@lovable.dev/vite-tanstack-config` dependency.
- Replaced the wrapper config with an explicit owned `vite.config.ts` using TanStack Start, React, Tailwind, tsconfig paths, and Nitro `node-server` for Coolify.
- Removed Lovable error reporting file and usage.
- Removed Bun lock/config; this project now uses `npm ci` with `package-lock.json` in Docker/Coolify.
- Renamed package to `floor-whisper`.
- Rebranded visible metadata and top bar from Plana Studio to Floor Whisper.

### AURA-style architectural sheet export

New file: `src/lib/editor/sheet-export.ts`.

It adds a vector jsPDF export for one architectural sheet inspired by the attached AURA 48 PDF:

- portrait A4/A3 page
- page border
- bottom title block with company, project name, version, and scale
- true-scale plan fitting with standard scale fallback
- wall/opening/furniture vector drawing
- overall dimensions in meters (`8.000` style)
- facade/elevation callouts around plan
- four simple facade elevations with openings and dimensions

UI entry point:

- top bar button: `Plan architecte`
- prompts for company, project name, version, scale, and paper format

### Wall/window/door presets

New file: `src/lib/editor/presets.ts`.

Built-in favorites/spec presets now include:

- wall presets: exterior RE2020, timber-frame exterior, interior bearing wall, 10 cm partition, 7 cm partition
- doors: interior 73/83/93, exterior full, exterior glass, pocket/sliding
- windows: 1 casement, 2 casement, oscillo-battant, fixed
- terrace/large openings: door-window 1/2 leaf, sliding bay 240, large bay 300

The left panel exposes wall favorites and opening presets for drag/drop.

### Assistant plan

Future app-side Hermes assistant plan artifact:

- `_resources/REVIEW/2026-07-09-08-28 Hermes assistant slider plan.md`

It recommends the safe scoped pattern: browser -> app API -> private shim -> API-only project Hermes profile, not raw browser-to-Hermes/tool access.

## Verification run locally

- `npm run build` passed after changes.
- Local production server started from `.output/server/index.mjs` on port `4312`.
- Browser smoke loaded `http://127.0.0.1:4312/` successfully.
- Browser title verified: `Floor Whisper — Residale`.
- UI verified visible:
  - `Plan architecte` export button
  - wall favorite buttons
  - expanded opening preset list with doors/windows/terrace/large bay presets
- Plan architecte export click was exercised with stubbed prompts; browser reported no JS errors.

## Known limits / follow-ups

- The architectural sheet is a first production-grade slice, not yet a perfect Archicad clone. Elevations are simplified vector facades derived from wall/opening geometry.
- The export config currently uses browser prompts. A nicer modal/sidebar config should replace this when the product UI is polished.
- User-defined custom favorites are not yet a full CRUD library; this slice provides built-in Residale presets and applies them in the editor. Add save/edit/delete favorites next.
- Existing generated code still has Prettier lint debt. Build passes; avoid a mass reformat until we choose to review the diff separately.
- Hermes assistant profile was planned, not created, because that touches service/profile/secrets and should be done as a separate infrastructure slice.
