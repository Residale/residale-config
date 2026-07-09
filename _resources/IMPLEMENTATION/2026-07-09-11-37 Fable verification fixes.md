# Fable verification fixes — follow-up to commit 08707f7

- **Date:** 2026-07-09 11:37 UTC
- **Author:** Claude Code Fable (orchestrator) — fixes derived from the 5-helper verification
  documented in `_resources/REVIEW/2026-07-09-11-37 Fable verification review.md`.

## Changes

| File | Fix | Severity |
|---|---|---|
| `src/components/editor/LeftPanel.tsx` | Preset thumbnail glyph: `o.kind === "door"` → `o.type === "door"` (post-refactor `o.kind` is an `OpeningKind` and never `"door"`; all thumbnails rendered the window glyph; also a `tsc` TS2367 error) | Low (UI) + typecheck |
| `vite.config.ts` | Annotate async config as `Promise<UserConfig>` — restores contextual typing so `css.transformer: "lightningcss"` stops widening to `string` (TS2769) | Typecheck |
| `src/lib/editor/pdf-export.ts` | Dossier PDF footer: "Plana Studio" → "Floor Whisper — Residale" (stale pre-rebrand branding in every exported dossier page) | User-visible branding |
| `src/routes/__root.tsx` | `<html lang="en">` → `lang="fr"` (all-French product; a11y/SEO) | Minor |
| `src/lib/editor/sheet-export.ts` | (a) each façade cell header now prints its own scale (`Façade Nord — 1:125`) since elevations legitimately auto-fit to a different scale than the plan — previously unlabeled, an architect would mis-measure; (b) cartouche date added (`SheetConfig.date`, defaults to fr-FR today); (c) cartouche company/project/version auto-shrink to fit their cells (`fitFontSize`) instead of overflowing; (d) export filename transliterates accents via NFD normalization ("Séjour" → "Sejour…", was "Sjour…") with a `"plan"` fallback for all-special-char names | Medium (a) + Low |
| `src/components/editor/EditorShell.tsx` | Success toast reports both scales when façades differ from the plan ("plan 1:50, façades 1:125") | Low |

## Deliberately not changed
- The 1507 pre-existing `prettier/prettier` lint errors (30 files): known, disclosed debt;
  mass-reformatting would swamp this fix diff. Run `npm run format` as a standalone commit.
- The 5×`window.prompt` input flow and the unreachable `show*` toggles in the sheet export:
  known disclosed UX gap; replacing with a proper dialog is future product work, not a
  verification fix.
- Hermes's implementation report text (historical artifact): its overstated rebranding claim
  is documented in the review report; the underlying code is now actually rebranded.

## Verification of the fixes
- `npx tsc --noEmit` → exit 0 (was 2 errors on 08707f7).
- `npm run build` → success (client + SSR + Nitro node-server `.output/`).
- PDF harness re-run against fixed source (Node, esbuild bundle of `buildArchitectSheet`):
  empty/populated/A3 plans all structurally valid (`%PDF-1.3` … `%%EOF`, no NaN); scale math
  unchanged (820 cm → 164 mm at 1:50); new labels confirmed in the byte stream: `1:125` ×4
  (one per façade cell), cartouche date `(09/07/2026)`, parens/accents still escaped/encoded
  correctly.
- Commit + push to `main`; Coolify auto-deploy; live verification of
  `https://config.residale.com` (new asset hashes + new strings in served bundles) — see
  commit reference below.

## Commit
- Fixes committed on `main` immediately after this artifact (single commit including both
  `_resources` reports; hash recorded in git history as the child of 08707f7).
