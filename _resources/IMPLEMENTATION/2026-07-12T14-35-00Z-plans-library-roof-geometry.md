# Plans library, autosave, and roof geometry correction

## Summary

Implemented a client-side member/admin flow for Residale Config and corrected roof placement/orientation behavior in 3D and section views.

## Member/admin flow

- Added an admin login screen for `iznaour@residale.com`.
- Added a `Mes plans` home page after login.
- Added plan actions:
  - create a new plan,
  - open an existing plan,
  - rename a plan,
  - duplicate a plan,
  - delete a plan,
  - return from the editor to `Mes plans`.
- Added immediate autosave for the active plan using the editor Zustand subscription.
- Autosave persists plan geometry, project name, and theme in browser localStorage.
- Existing single-plan local state is migrated into the plan library the first time the member page opens.

## Important implementation note

This is still client-side storage only because the app currently has no backend/database. The admin login gates the UI in the browser; it is not a secure server-side authentication system. A real multi-device/private account system will require a backend (Supabase/Auth+DB or equivalent).

## Roof and section fixes

- Reversed the previous roof model: the roof now sits above the exterior wall support height instead of inside/subtracting from wall height.
- Exterior wall height remains the support/HSP value; roof thickness is added above it for hors-tout.
- Added roof slope controls for flat and mono roofs:
  - slope axis: length or width,
  - invert high/low side,
  - slope degree,
  - roof thickness,
  - roof overhang.
- 3D roof mesh now uses the configured slope axis/direction and sits above the wall tops.
- Section/coupe roof polygons now draw above the walls and only show slope when the section direction matches the configured roof slope axis.
- Section levels now include high-side roof level for sloped flat/mono roofs.

## Files changed

- `src/routes/index.tsx`
- `src/lib/editor/plan-library.ts`
- `src/lib/editor/types.ts`
- `src/lib/editor/store.ts`
- `src/lib/editor/sections.ts`
- `src/components/editor/EditorShell.tsx`
- `src/components/editor/TopBar.tsx`
- `src/components/editor/RightPanel.tsx`
- `src/components/editor/Canvas3D.tsx`
- `src/components/editor/CanvasSection.tsx`

## Verification

- Changed-file ESLint: passed with the existing Fast Refresh warning in `CanvasSection.tsx`.
- `npm run build`: passed.
- Local browser verification on `http://127.0.0.1:8081/`:
  - login page appears,
  - login works with the provided admin credentials,
  - `Mes plans` page appears,
  - opening a plan enters the editor,
  - renaming in the top bar immediately updates the saved plan name on `Mes plans`,
  - flat roof controls show slope axis and invert direction,
  - 3D roof sits above wall tops and no longer cuts into the wall body,
  - browser console has no application errors; only Three.js deprecation warnings.

## Deployment

Pending at time of writing: commit, push to `main`, Coolify deploy, live verification at `https://config.residale.com`.
