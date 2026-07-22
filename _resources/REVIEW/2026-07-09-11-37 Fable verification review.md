# Fable verification review — commit 08707f7 "Modernize Residale Config and add architect sheet export"

- **Date:** 2026-07-09 11:37 UTC
- **Orchestrator:** Claude Code Fable (claude-fable-5), acting as captain
- **Helpers:** exactly 5 Agent-tool subagents, run concurrently:
  1. Lovable removal + deploy config verification — Sonnet
  2. Architect sheet export deep functional review — **Opus** (hard architecture/product role)
  3. Presets drag/drop wiring verification — Sonnet
  4. Branding + `_resources` artifacts accuracy — Sonnet
  5. Build/lint/typecheck/smoke gates — Sonnet
- **Method:** each helper verified independently against the actual repo/git state; Fable
  (captain) read the core new files itself (`sheet-export.ts`, `presets.ts`, diff of the fix
  commit), adjudicated findings, applied fixes, and re-ran gates. Conclusions below are
  **Fable-reviewed** unless explicitly marked as a helper or Hermes assertion.

## Verdict

Hermes/controller's work is **substantially correct and was genuinely deployed**, but the
verification found **1 medium and several small real defects**, all fixed in the follow-up
commit (see companion implementation report `_resources/IMPLEMENTATION/2026-07-09-11-37
Fable verification fixes.md`).

## Scope results

### 1. Lovable removal — PASS (no fix needed)

- Repo-wide grep: the only remaining "lovable" string in code is an explanatory comment at
  `vite.config.ts:8` (benign, intentional).
- No imports of the deleted `src/lib/lovable-error-reporting.ts`; `__root.tsx`/`index.tsx`
  clean. Error capture replaced by owned `src/lib/error-capture.ts` wired in `src/server.ts`.
- `vite.config.ts` is a coherent standalone config: tailwind, tsconfig-paths, tanstackStart
  (with import protection + custom server entry), conditional `nitro({ preset: "node-server" })`
  on build, react. Correct for a Coolify long-running Node container.
- `package-lock.json` (lockfileVersion 3) exactly matches `package.json`; `npm ls
--package-lock-only` exits 0; no bun artifacts remain.
- Dockerfile: 3-stage node:22-alpine, `npm ci` → `npm run build` → runs
  `node .output/server/index.mjs`, `EXPOSE 3000`, env vars match Nitro's node-server runtime
  (verified against `node_modules/nitro/.../node-server.mjs`). `.dockerignore` coherent.
- Minor awareness note (no action): `.gitignore` retains a vestigial Wrangler/Cloudflare
  section; untracked local `.wrangler/` dir exists. Not part of this commit, harmless.

### 2. Branding — PASS after 3 fixes

- `__root.tsx` meta/title, `TopBar`, `AGENTS.md`, `package.json` name: all correctly
  "Residale Config — Residale", French copy. Confirmed.
- **FAIL found & fixed:** the "Dossier PDF" export footer still stamped **"Plana Studio"**
  (`src/lib/editor/pdf-export.ts:200` — a file the commit never touched, contradicting the
  implementation report's "rebranded visible metadata" claim). Now "Residale Config — Residale".
- **WARN found & fixed:** `<html lang="en">` on an all-French product → `lang="fr"`.

### 3. Architect sheet export — functional, PASS after 4 fixes (Opus deep review + reproduction)

Confirmed working, not just a button:

- Full UI chain `TopBar` button → `EditorShell.handleExportArchitectSheet` →
  `exportArchitectSheetPDF`; inputs collected via 5 sequential `window.prompt` calls
  (company/project/version/scale/paper).
- PDF generation reproduced in Node (esbuild-bundled harness): empty plan, populated plan
  (walls + door + window + bay + furniture + label), and A3 cases all yield structurally valid
  PDFs (`%PDF-1.3`, trailer/startxref/EOF, zero NaN). Parentheses in user strings escaped;
  accented French text correct via WinAnsiEncoding.
- Scale math **correct**: `s = 10/scale` mm-per-cm; 8.2 m bound at 1:50 measures exactly
  164 mm on paper. Auto-bumps along a normalized scale ladder when the plan doesn't fit, and
  honestly prints the effective scale + "Plan ajusté à 1:X" note.
- Empty plan double-guarded (toast at handler; "Plan vide" sheet in the generator). SSR-safe
  (no top-level window/document; verified jspdf module evaluation in Node).
- **Bugs found & fixed:** (1) _medium_ — elevations auto-scale to a different scale than the
  plan (e.g. plan 1:50, façades 1:125) with **no label anywhere**, so a reader would
  mis-measure façades → each façade cell now prints its scale, and the success toast reports
  both scales when they differ; (2) no date on the cartouche → added (defaults to fr-FR today,
  overridable via `SheetConfig.date`); (3) free-text company/project/version could overflow
  cartouche cells → auto-shrinking font fit; (4) filename stripped French accents
  ("Séjour" → "Sjour") → NFD-normalized transliteration with a "plan" fallback.
- **Known gaps left as-is (recorded, not hidden):** the 5-prompt input flow is crude UX and
  the four show* toggles are unreachable from the UI (already disclosed as a known gap in
  Hermes's implementation report — a proper dialog is future work); the unreachable
  empty-plan branch omits the scale value in the cartouche (dead path, cosmetic).

### 4. Presets — PASS after 1 fix

- Drag payload (`application/x-opening`, `{kind, subKind, label, width, height, sillHeight}`)
  **byte-for-byte matches** the `Canvas2D.tsx` drop handler's expectations; the field rename
  in the refactor was correctly remapped in `onDragStart`. No drag/drop regression.
- Wall preset click → `setCurrentWallType` + `setWallSettings` → consumed by the drawing tool
  and `addWall`: field names and cm units consistent end-to-end.
- Preset values architecturally sane (RE2020 30 cm exterior, P73/P83/PMR 93 doors, standard
  window/bay sizes, 250–270 cm heights).
- **Bug found & fixed:** `LeftPanel.tsx:182` compared `o.kind === "door"` where `o.kind` is
  now an `OpeningKind` (`"door_simple"`, …) — never `"door"` — so **all** preset thumbnails
  rendered the window glyph (also a `tsc` TS2367 error). Fixed to `o.type === "door"`.

### 5. `_resources` artifacts — accurate, PASS

Every factual claim in Hermes's implementation report was spot-checked against git/repo state
and held up (file lists, removals, backup branch `residale-config-backup` + tag
`v0-lovable-baseline` at the right baseline commit, build passing), **except** the
"rebranded visible metadata" claim, which was overstated (missed the Dossier PDF footer —
now true after the fix). Reports are concise and not padded; the assistant-slider plan is
correctly marked deferred/not implemented.

### 6. Deployment — LIVE, verified

- `https://config.residale.com` returned HTTP 200 with title "Residale Config — Residale";
  the served JS bundles were downloaded and contain "Plan architecte" — proof the deployed
  build is the new version of 08707f7, not a stale one (verified again after the fix commit;
  see implementation report for post-fix live verification).
- Local `main` == `origin/main` at time of review start.

## Verification gates (Fable-reviewed, exact results)

| Gate               | Result                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` | **FAIL on 08707f7** (2 errors: LeftPanel TS2367; vite.config TS2769 from literal-widening in the async config) → **PASS (exit 0) after fixes**                                                                                                                                                                                                     |
| `npm run build`    | PASS (client 2721 modules / SSR 80 modules / Nitro node-server `.output/`); re-run PASS after fixes                                                                                                                                                                                                                                                |
| `npm run lint`     | **FAIL — recorded, not hidden:** 1514 problems (1507 `prettier/prettier` formatting errors across 30 files + 7 `react-refresh/only-export-components` warnings). 100 % of errors are pre-existing formatting debt already disclosed in Hermes's report; deliberately **not** mass-reformatted during verification to keep the fix diff reviewable. |
| Tests              | none defined in package.json (no test script) — nothing to run                                                                                                                                                                                                                                                                                     |
| Built-server smoke | PASS (`node .output/server/index.mjs`, HTTP 200, correct title)                                                                                                                                                                                                                                                                                    |
| Docker             | daemon not reachable from this sandbox (`permission denied` on docker.sock); Dockerfile read-validated step-by-step against package.json scripts, actual `.output/` layout, and Nitro's node-server runtime env handling. Coolify itself performed the real image build (live site serves the result).                                             |
| Live check         | PASS — curl + bundle-content verification, before and after fixes                                                                                                                                                                                                                                                                                  |

## Hermes assertions vs Fable-reviewed conclusions

- Hermes asserted: build passing, local smoke on port 4312, rebranding complete, backup
  branch/tag created. Fable independently re-verified all of these **except** the port-4312
  local browser smoke (unverifiable after the fact; superseded by our own server smoke + live
  checks). The rebranding claim was the one inaccuracy found.
- Everything else in this document was independently established by Fable + helpers from the
  actual repo, build outputs, generated PDFs, and the live site.
