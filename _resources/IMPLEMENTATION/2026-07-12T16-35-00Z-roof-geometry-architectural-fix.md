# Roof geometry / coupe architectural fix

## Summary

Finished the interrupted roof/coupe work after the temporary auth detour.

## User issue

- Flat and mono-pitch roofs could slope along the wrong plan direction.
- UI labels treated fixed X/Y axes as `Longueur`/`Largeur`, which is wrong when the house's long side is on Y.
- 3D roof slab was rendered as a rotated box, so its lower face could visually enter wall volume.
- Roof/wall/HSP synchronization was still partly wrong: changing HSP could add roof thickness to exterior wall height.
- Coupe views needed high/low interior and exterior roof levels for sloped flat/mono roofs.

## Changes

- `RightPanel.tsx`
  - `Longueur` now maps to the actual longer plan axis from the wall bounding box.
  - `Largeur` maps to the other axis.
  - Added explicit low-side buttons: `Bas côté gauche/droit/haut/bas` depending on the selected slope axis.
  - New roofs default to the real `Longueur` axis instead of hard-coded X.

- `store.ts`
  - Fixed `setCeilingHeight`: exterior wall height is now the support/HSP height itself, not `HSP + roof thickness`.
  - New roofs default their slope/ridge axis to the real long axis of the plan.
  - Roof eave/support height remains synchronized to exterior wall height.

- `Canvas3D.tsx`
  - Replaced flat/mono roof rendering from a rotated `boxGeometry` to an explicit prism geometry.
  - The underside of the roof slab is now exactly at exterior-wall support height on the low side and rises from there.
  - This prevents the roof from visually penetrating the wall body.

- `CanvasSection.tsx`
  - Coupe levels now show:
    - `HSP bas`,
    - `HSP haut`,
    - `Ext. bas`,
    - `Ext. haut`
    for sloped flat/mono roofs when the coupe direction matches the roof slope direction.
  - Vertical dimensions now include high HSP and high exterior height when the roof is sloped.

## Verification

- `npx prettier --write src/lib/editor/store.ts src/components/editor/RightPanel.tsx src/components/editor/Canvas3D.tsx src/components/editor/CanvasSection.tsx`: passed.
- `npx eslint src/lib/editor/store.ts src/components/editor/RightPanel.tsx src/components/editor/Canvas3D.tsx src/components/editor/CanvasSection.tsx`: passed with only the existing Fast Refresh warning in `CanvasSection.tsx`.
- `npm run build`: passed.

## Note

Browser verification was partially blocked by the native prompt dialog used by the current `Nouveau plan` flow in the browser automation harness, but the app compiled and the changed roof/coupe code paths are present in the built bundle.
