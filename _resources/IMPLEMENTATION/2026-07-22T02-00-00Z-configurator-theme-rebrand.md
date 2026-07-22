# CONFIGURATOR rebrand + professional theme (UI/UX template alignment)

Date: 2026-07-22 · Branch: `uiux-configurator-theme-fable`

## What changed

Replaced the warm paper/brass/gold "architectural" theme with the professional
operational app style from `/home/hermes/templates/UI-UX/App-UIUX-Template.md`:
calm navy/slate neutral surfaces, flat bordered cards (no card shadows),
Inter-only typography, class-based light/dark theming, and a tokenized accent.

### Tokens (`src/styles.css`)

- Full rewrite of `:root` to the template's navy/slate light palette (hue 220),
  plus a new `.dark` palette. Values stored as complete `hsl()` colors and
  mapped through the Tailwind v4 `@theme inline` block.
- Added template token families: `surface-elevated` / `surface-sunken` and the
  six fixed `status-*` colors.
- Accent changed from gold/brass to **teal**: light `hsl(175 77% 26%)`
  (≈ #0f766e, white foreground ≥ 4.5:1), dark `hsl(172 66% 50%)` (bright teal,
  dark foreground), following the template's custom-accent recipe
  (`references/theme-customization.md`). Light `--primary`/`--ring` stay deep
  navy per the template; dark `--primary`/`--ring` take the bright accent.
- Removed legacy brand tokens `--paper`, `--ink`, `--brass`, `--blueprint`,
  the warm body radial-gradient, the `grain-paper` utility, and the Fraunces
  serif display font (display font is now Inter; `@fontsource/fraunces` imports
  dropped from CSS — the npm dependency remains but is unused).

### Dark mode

- `@custom-variant dark` was already declared but unused; now wired: an inline
  head script in `src/routes/__root.tsx` applies `.dark` on `<html>` from
  `localStorage("app-theme")` with `prefers-color-scheme` fallback (no flash).
- New `src/components/ThemeToggle.tsx` (Sun/Moon, `aria-pressed`), rendered in
  the editor TopBar and the plans-home header.

### Branding

- Title/metadata (`__root.tsx`, `src/routes/index.tsx` head): now
  `CONFIGURATOR — Residale` (og/twitter included), matching the CRM's tab
  naming convention.
- Editor TopBar wordmark: stale "Floor Whisper" replaced with
  `CONFIGURATOR` / `Residale`.
- Visible product-name strings in `index.tsx` and the PDF export footer renamed
  to CONFIGURATOR. Functional identifiers (localStorage keys, Supabase table
  `residale_config_plans`, RPC, type names) intentionally untouched.
- Favicon: sourced from Residale CRM
  (`residale-crm/apps/web/public/favicon-crm.png`) → `public/favicon.png`
  (500×500) and `public/favicon.ico` (64×64, converted with ffmpeg). Linked in
  `__root.tsx` head (`icon` ×2 + `apple-touch-icon`).

### Component chrome

- All `text-ink` / `bg-ink` / `text-paper` / `brass` utility usages replaced
  with semantic tokens across `index.tsx`, `TopBar`, `LeftPanel`, `RightPanel`,
  `CommandPalette`, `CanvasSection`, `Canvas3D`, `Canvas2D` overlays. Mapping:
  primary CTAs → `bg-primary text-primary-foreground`; active/selected states →
  `border-accent` / `bg-accent/10`; hover affordances → `hover:border-ring/40`
  + `hover:bg-muted`; focus → `focus:border-ring`.
- Konva/three.js need concrete color strings, so canvas UI-chrome colors are
  centralized in `src/lib/editor/canvas-colors.ts` (ACCENT #0f766e,
  `accentAlpha()`), replacing every hardcoded `#c9a961` selection color and
  `rgba(201,169,97,…)` fill in `Canvas2D.tsx`. Keep this file in sync with
  `--accent` in `styles.css`.
- Canvas3D sky gradient and ground grid neutralized to slate; warm cream page
  backgrounds (`#f5f0e6`, `#faf8f2`) replaced with tokens/white.

## Deliberately unchanged

- Furniture/material colors (furniture-catalog, FurnitureShape2D/Mesh3D/Thumb,
  wood/glass/stairs in Canvas3D, `store.ts` wall/floor 3D defaults): these are
  realistic *content* colors of the drawn objects, not UI chrome.
- 2D canvas drawing themes (`src/lib/editor/theme.ts` presets — technique,
  aquarelle, blueprint, épuré): user-selectable document styles; the drawing
  surface stays a light "document" in both app themes.
- `sheet-export.ts` greyscale print palette; `error-page.ts` neutral inline CSS.
- Supabase schema names, localStorage keys, `FloorWhisper*` internal type names.

## Gates

See final session report: `npm run lint` and `npm run build` were run after the
change set; results documented there.
