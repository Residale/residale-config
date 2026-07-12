# Section roof/height synchronization

## Summary

Implemented the section/coupe and flat-roof synchronization fixes requested for Floor Whisper.

## Changes

- Section HSP now derives from exterior wall height and roof thickness instead of staying stuck at 250 cm.
- Exterior wall height changes synchronize HSP.
- HSP edits synchronize exterior wall envelope height.
- Flat roof now exposes editable controls for:
  - exterior/acrotère height,
  - roof thickness,
  - slope in degrees,
  - overhang.
- Flat roof geometry stays inside the wall envelope instead of being added above the wall.
- Section labels/dimensions were adjusted toward French architectural notation:
  - opening labels include cm units,
  - vertical dimensions are displayed in meters.
- 3D roof rendering now uses configured roof thickness and keeps roof mass inside the wall envelope.
- Added a zero-size guard around section canvas resize handling to avoid Konva drawImage errors when panels temporarily collapse during hot reload/layout changes.

## Files changed

- `src/lib/editor/types.ts`
- `src/lib/editor/store.ts`
- `src/lib/editor/sections.ts`
- `src/components/editor/RightPanel.tsx`
- `src/components/editor/CanvasSection.tsx`
- `src/components/editor/Canvas3D.tsx`

## Verification

- `git diff --check` passed.
- Changed-file ESLint passed with one existing warning in `CanvasSection.tsx` about Fast Refresh and `exportAllSectionsPNG`.
- `npm run build` passed.
- Local browser verification on `http://127.0.0.1:8080/`:
  - exterior wall height set to 300 cm updates HSP to 300 cm with no roof,
  - selecting flat roof with 20 cm roof thickness updates HSP to 280 cm,
  - flat roof controls are visible in French.

## Deployment

Pending at time of this report: commit/push to `main`; Coolify auto-deploy expected for `https://config.residale.com` after push.
