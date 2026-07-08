# Refonte de l'éditeur 2D + catalogue 3D riche — plan complet

Objectif : rendre la conception 2D **intuitive, prévisible et sans friction**, et enrichir le **catalogue de mobilier 3D** avec de vrais modèles réalistes (lits, WC, éviers, plaques, hotte, baignoire, canapés, etc.) — pas des cubes.

---

## 0. Diagnostic — pourquoi c'est agaçant aujourd'hui

1. **Mobilier bloqué** : handlers `pointerdown` en doublon, l'owner du drag est parfois le canvas.
2. **Fenêtre non sélectionnable** : hit-box plus petite que la coupe, le mur vole le clic.
3. **Porte non architecturale** : arc en pointillés, pas orienté depuis la charnière, vantail invisible ; en 3D, juste un trou.
4. **Sauts de valeur** : `round(x/20)*20` traîne encore → largeur saute à 120 cm.
5. **Pan cassé** : clic gauche vide déclenche un marquee au lieu de paner.
6. **Pas de clic droit** : aucun `onContextMenu` global.
7. **Inspecteur qui saute** : inputs contrôlés en direct + round non-neutre.
8. **Duplication laborieuse** : ni raccourci, ni menu, ni Alt+drag.
9. **Catalogue pauvre** : mobilier générique en 2D, primitives basiques en 3D.

---

## 1. Modèle d'interaction unifié

| Geste | Action |
|---|---|
| Clic gauche sur élément | Sélectionne (remplace) |
| Shift + clic | Ajoute / retire de la sélection |
| Clic gauche sur vide + glisser | **Pan** (rétabli) |
| Shift + clic vide + glisser | Marquee de sélection |
| Espace maintenu / clic milieu | Pan (alternatif) |
| Molette | Zoom centré curseur |
| Alt + glisser élément | Duplique en glissant |
| Clic droit **partout** | Menu contextuel (§7) |
| Double-clic sur cote | Édition clavier |
| Double-clic sur mur | Insère un nœud |
| Double-clic sur meuble | Inspecteur focus |
| Échap | Annule / désélectionne |

**Priorité de hit-test** (`hit-test.ts`, tolérance en pixels écran, ≈ 6 px) :
1. Poignée de la sélection courante
2. Ouverture (hit-box = coupe + arc)
3. Mobilier (bbox orientée)
4. Extrémité de mur (rayon 8 px)
5. Corps de mur
6. Cote / annotation
7. Pièce (sol)

Un meuble verrouillé est transparent au clic → on peut atteindre ce qu'il y a dessous.

---

## 2. Sélection propre, visible, prévisible

- Couleur unique de sélection or `#c9a961` + survol bleu clair 40 %.
- **Bounding box orientée** unifiée : 4 coins + 4 milieux + poignée rotation.
- Multi-sélection : bbox englobante, actions groupées, alignements, distribution.
- Mini-toolbar flottante : Dupliquer / Pivoter / Verrouiller / Supprimer.
- Sélection stable pendant pan/zoom et Undo/Redo.

---

## 3. Déplacement, redimensionnement, magnétisme

Tout au **centimètre**.

**Snap unifié (`snap.ts`)** — priorité :
1. Nœud de mur (10 px)
2. Prolongement (ligne-guide pointillée)
3. Alignement bord/centre H et V (6 px)
4. Bord de mur pour mobilier (< 15 cm, pivote pour épouser le mur)
5. Grille 1 cm (5 cm avec Shift)

Feedback : cote provisoire en gras, ligne-guide colorée, étiquette « Δ +12 cm », badge du snap actif.

**Murs** : tirer une extrémité déplace le nœud partagé ; angle droit reconstruit si écart < 2° ; fusion proposée si deux nœuds à < 2 cm.
**Ouvertures** : deux poignées ↔ au cm, ancrage sur l'extrémité opposée, clamp anti-chevauchement.
**Mobilier** : 8 poignées + rotation, Shift = ratio conservé, inputs numériques.

---

## 4. Mobilier — logique fiable

Chaque meuble : ancre (`center` / `back` / `corner`), `anchorToWall`, `locked`, `L × l × h`, rotation.

**Placement** : image fantôme HTML5 masquée, aperçu vectoriel Konva aux vraies dimensions, snap mur avec surlignage doré, dépôt WYSIWYG.

**Sélection & manipulation** : un unique `pointerdown` sur `InteractionLayer` (fini les handlers par-Group qui bloquent le drag). Sélectionné → drag avec magnétisme, 8 poignées, rotation snap 15°/90°, `R` = 90°, `[`/`]` ordre Z, `L` = verrou, Alt+drag = duplication.

---

## 5. Portes et fenêtres — dessin architectural correct

Référence : image partagée. Arc plein, vantail plein, coupe franche.

**Anatomie** :
- Coupe franche du mur (rectangle blanc).
- Deux jambages perpendiculaires.
- Vantail : trait plein épais (~4 cm à l'échelle), part de la charnière perpendiculairement.
- Arc : quart de cercle **plein** (fin, 0.6× stroke), rayon = largeur, de la pointe fermée du vantail à la pointe ouverte. **Plus jamais de pointillés sur l'arc.**

**Kinds** : `door_simple`, `door_double`, `door_slide`, `door_pocket` (pointillés dans le mur — le seul cas légitime), `entrance`, `window_1`, `window_2`, `french`, `bay`.

**Module unique** `opening-render.ts` : une fonction par kind.

**Poignées quand sélectionné** (inspiré de la référence) :
- ↔ aux deux extrémités : redimensionne au cm
- ⇄ centre : translate le long du mur
- ⟳ : inverse la charnière (`F`)
- ⇆ : inverse le côté (`Shift+F`)
- Sélecteur d'angle 30°/60°/90°/120° (`Alt+F`)

**Hit-box** (`opening-hitbox.ts`) = union(coupeRect, arcBbox), testée avant le mur → clic sur fenêtre = fenêtre, plus jamais le mur.

**Cohérence 3D des ouvertures** :
- Ajout d'un maillage vantail (plaque 4 cm) placé sur la charnière, pivoté selon `opening.openAngle`.
- Fenêtres : cadre + verre translucide, refends selon le kind.
- Le sens de la porte est visible en 2D **et** en 3D.

---

## 6. Inspecteur droit contextuel

Inputs **qui ne sautent pas** : buffer local, commit sur `Enter`/blur, `Échap` annule, `+`/`–` par 1 cm, flèches clavier ±1 cm (±10 cm avec Shift).

Contenus par sélection : mur / ouverture / meuble / pièce / multi / plan (aucune sélection).

---

## 7. Menu contextuel (clic droit)

`ContextMenu2D` (Radix), contenu dérivé du hit-test.

- **Vide** : Coller, Sélectionner tout, Ajouter mur ici, Ajouter mobilier ▶, Recentrer, Toggle cotes/grille.
- **Mur** : Insérer nœud, Ajouter porte, Ajouter fenêtre, Aligner H/V, Séparer, Propriétés, Supprimer.
- **Ouverture** : Changer type ▶ (vignettes), Inverser sens, Inverser côté, Angle ▶, Dupliquer, Supprimer.
- **Meuble** : Dupliquer, Pivoter 90°, Coller au mur, Ordre Z, Verrouiller, Supprimer.
- **Multi** : Aligner (G/C/D/H/M/B), Distribuer H/V, Grouper, Dupliquer, Supprimer.

Raccourcis affichés à droite de chaque entrée.

---

## 8. Feedback visuel permanent

Curseur adaptatif, barre d'état (coordonnées, échelle, sélection, snap, outil), cotes auto (toggle `H`), surbrillance pièce + étiquette m², HUD raccourcis via `?`.

---

## 9. Raccourcis clavier

```text
V Sélection   W Mur   D Porte   F Fenêtre   M Mobilier   T Cote
Espace Pan    0 Recentrer   +/- Zoom   1..4 Vues
Ctrl/Cmd + C/V/X/D/Z/Shift+Z/A/G/S/P
Suppr / Échap
R Rotation 90°   [/] Ordre Z
F Flip charnière   Shift+F Flip côté   Alt+F Angle suivant
L Verrou   H Cotes   G Grille   ? Aide
```

---

## 10. Catalogue 3D riche (nouveau chantier)

Le mobilier doit **ressembler à ce qu'il est**. On combine deux stratégies : modèles GLB téléchargés + modèles procéduraux paramétriques.

### Stratégie

**A. Modèles GLB téléchargés** — sources libres et attribuables :
- **Poly Pizza** (poly.pizza) — bibliothèque CC0 / CC-BY massive, mobilier maison, sanitaire, cuisine.
- **Kenney Assets** (kenney.nl) — pack « Furniture Kit » CC0.
- **Sketchfab** — filtres CC0 / CC-BY (attribution auto dans un fichier `CREDITS.md`).
- **Quaternius** — packs CC0.

Chaque modèle est :
- Téléchargé au format `.glb` (draco compressé si dispo)
- Uploadé via `lovable-assets create` → pointeur `.asset.json` dans `src/assets/models/`
- Référencé dans le catalogue par son `url` CDN
- Chargé à la demande avec `<Gltf />` de `@react-three/drei`, avec `Suspense` + placeholder

**B. Modèles procéduraux paramétriques** (fallback + éléments qui doivent s'adapter aux dimensions) :
- Lit : matelas + sommier + tête de lit + oreillers (paramétré par L × l).
- Canapé : assise + dossier + accoudoirs + coussins (paramétré 2p/3p/angle).
- Table : plateau + pieds paramétrés.
- Plan de travail cuisine : segment paramétrable (longueur, profondeur, retour d'angle).
- Placard / dressing : caisson + portes paramétrées.

Ces modèles se redimensionnent proprement quand l'utilisateur change L/l/h — un GLB non paramétrique se contente de se scaler.

### Contenu ciblé du catalogue

Catégories (chacune avec **au minimum** les éléments listés) :

**Chambre** : lit 90/120/140/160/180/200, tête de lit, table de chevet, commode, dressing, penderie, coiffeuse, chaise, banc de pied de lit.

**Salon** : canapé 2p, canapé 3p, canapé d'angle, méridienne, fauteuil, pouf, table basse, table d'appoint, meuble TV, bibliothèque, étagère, tapis, lampadaire, lampe de table, plante.

**Cuisine** :
- Éléments bas : caisson 40/60/80/100/120 cm, tiroirs, casserolier, sous-évier, coin.
- Éléments hauts : caisson mural 60/80, vitrine.
- Colonnes : four/micro-onde, frigo intégré, rangement.
- Électroménager : plaque induction/gaz 60/90, four, micro-ondes, frigo américain, frigo classique, lave-vaisselle, **hotte** (murale, îlot, décorative).
- Évier simple / double, robinetterie, îlot, bar, tabourets de bar.

**Salle de bain** : **WC** (suspendu + posé), lavabo simple, lavabo double, meuble vasque, baignoire, baignoire d'angle, douche italienne, cabine de douche, sèche-serviettes, miroir, machine à laver, sèche-linge.

**Salle à manger** : table 4/6/8, chaises, buffet, vaisselier.

**Bureau** : bureau, chaise de bureau, caisson, bibliothèque, imprimante.

**Extérieur** : arbre, buisson, pot, salon de jardin, barbecue, parasol.

**Divers** : porte intérieure de placard, escalier droit / quart tournant / hélicoïdal, cheminée, poêle, radiateur.

Objectif : **~100 modèles à la sortie**, extensible.

### Structure technique du catalogue

`src/lib/editor/furniture-catalog.ts` évolue vers :

```ts
type CatalogItem = {
  id: string;
  category: 'bedroom' | 'living' | 'kitchen' | 'bathroom' | ...;
  label: string;
  labelFr: string;
  defaultSize: { L: number; l: number; h: number };
  anchor: 'center' | 'back' | 'corner';
  anchorToWall: boolean;
  render2D: { kind: '2d-symbol'; symbol: string } // dessin schématique
  render3D:
    | { kind: 'glb'; url: string; scaleMode: 'fit' | 'uniform' }
    | { kind: 'procedural'; builder: string /* fn id */ };
  tags: string[]; // pour la recherche
  credit?: { author: string; license: string; url: string };
};
```

- Un dossier `src/assets/models/` centralise les pointeurs `.asset.json`.
- Un fichier `CREDITS.md` liste toutes les attributions CC-BY.
- Chargement 3D via `useGLTF` (drei) avec cache et Suspense.
- Rendu 2D : symbole vectoriel dédié (`FurnitureShape2D.tsx`) — le catalogue mappe `id → symbol`.

### Panneau gauche — nouveau design

- **Recherche** en haut (par label / tag).
- **Catégories** repliables avec compteurs.
- **Vignettes** : rendu 3D miniature généré à la volée (offscreen canvas), pas des png stockés.
- **Filtres** : par pièce, par dimensions, par style.
- **Drag & drop** : preview vectoriel avec vraies dimensions (§4).

### Approvisionnement (comment on remplit le catalogue)

Étape d'exécution dédiée :
1. Sélectionner une liste de ~80–100 modèles CC0/CC-BY depuis Poly Pizza / Kenney / Quaternius.
2. Télécharger les GLB, les optimiser (Draco / Meshopt si nécessaire) et retirer les textures inutiles.
3. `lovable-assets create` sur chaque, écrire les pointeurs dans `src/assets/models/`.
4. Compléter `furniture-catalog.ts` avec entrées + tags + crédits.
5. Ajouter les modèles procéduraux pour lit / canapé / table / cuisine / dressing.
6. Générer les symboles 2D correspondants (schématiques, cohérents avec la vue en plan).

---

## 11. Section technique (implémentation)

### Nouveaux modules
- `src/lib/editor/hit-test.ts`, `snap.ts`, `opening-render.ts`, `opening-hitbox.ts`, `commands.ts`
- `src/lib/editor/furniture-catalog.ts` (refonte + structure `CatalogItem`)
- `src/lib/editor/procedural/` : `bed.ts`, `sofa.ts`, `table.ts`, `kitchen.ts`, `wardrobe.ts`
- `src/components/editor/ContextMenu2D.tsx`, `SelectionHandles.tsx`, `OpeningQuickActions.tsx`, `StatusBar2D.tsx`, `ShortcutsHelp.tsx`
- `src/components/editor/CatalogPanel.tsx` (nouveau panneau gauche avec recherche + vignettes 3D)
- `src/components/editor/FurnitureThumb3D.tsx` (miniature 3D offscreen)

### Refactor `Canvas2D.tsx` en couches
`Canvas2DStage` / `WallsLayer` / `OpeningsLayer` / `FurnitureLayer` / `RoomsLayer` / `OverlayLayer` (guides/cotes/handles/marquee) / `InteractionLayer` (**seule couche qui écoute**).

### `store.ts`
Ajouts : `hoverId`, `clipboard`, `guides`, `snapConfig`, `openAngle`. Actions : `duplicate`, `alignSelection`, `distributeSelection`, `flipOpening`, `setOpeningAngle`, `insertNode`, `mergeNodes`, `lockToggle`.

### `types.ts`
`Opening.openAngle`, kinds `bay`/`french`, `Furniture.locked`, `Furniture.anchorToWall`, `Furniture.modelRef` (glb ou procedural).

### Fixes ciblés
| Bug | Correctif |
|---|---|
| Mobilier bloqué | `InteractionLayer` unique, hit-test centralisé |
| Fenêtre insélectionnable | Hit-box coupe + arc, testée avant mur |
| Portes non-architecturales | `opening-render.ts` (arc plein, vantail, jambages) |
| Ouverture invisible en 3D | Maillage vantail pivoté selon `openAngle` |
| Sauts à 20 cm | Suppression de tous les `round(x/20)*20` |
| Pan cassé | Clic-gauche-vide sans outil → pan |
| Pas de clic droit | `ContextMenu2D` sur le stage |
| Inspecteur qui saute | Inputs bufferisés (commit blur/Enter) |
| Catalogue pauvre | GLB téléchargés + procédural + panneau catalogue |

### Perf
- Couches Konva en `listening={false}` sauf `InteractionLayer`.
- Mémoïsation rendu ouvertures `(wall.id, opening.id, scale, selected, openAngle)`.
- Guides throttle `requestAnimationFrame`.
- 3D : `useGLTF` cache global, LOD si nécessaire, `Suspense` avec placeholder cube.

---

## 12. Livraison par étapes

1. **Fondations interaction** — `hit-test`, `snap`, refactor `Canvas2D` en couches, `InteractionLayer` unique. → Corrige mobilier bloqué, fenêtre insélectionnable, pan, sauts.
2. **Portes & fenêtres** — `opening-render`, `opening-hitbox`, `OpeningQuickActions`, vantail 3D.
3. **Sélection & poignées** — `SelectionHandles`, marquee, alignements, distribution.
4. **Mobilier interaction** — magnétisme mur, 8 poignées, drag preview vectoriel, verrou.
5. **Menu contextuel** — `ContextMenu2D` complet.
6. **Inspecteur** — inputs bufferisés, sections dédiées.
7. **Catalogue 3D** — refonte `furniture-catalog.ts`, procédural (lit/canapé/table/cuisine/dressing), téléchargement + upload assets d'un premier lot (~40 modèles GLB : cuisine, salle de bain, chambre en priorité), panneau gauche avec recherche et vignettes 3D.
8. **Catalogue 3D — extension** — deuxième lot (~40 modèles supplémentaires : salon, salle à manger, bureau, extérieur, divers), crédits.
9. **Feedback & aide** — `StatusBar2D`, curseurs adaptatifs, `ShortcutsHelp`, raccourcis complets.

Checklist de recette après chaque étape (mobilier bougeable au cm, fenêtre sélectionnable, porte avec arc plein, WC ressemble à un WC en 3D, hotte visible, etc.).
