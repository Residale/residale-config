
# Refonte UX et cohérence architecturale complète

Objectif : un éditeur où **chaque geste est évident**, où **toutes les vues (2D / 3D / coupes) restent parfaitement cohérentes** entre elles, avec des cotes justes au centimètre près, comme sur un vrai plan d'architecte.

---

## PARTIE A — Manipulation directe (2D)

### A.1 Murs — plus de poignées, tout se fait au corps du mur

**Problème actuel** : 3 pastilles (A, B, milieu) à viser, sélection perdue si on rate, drag qui saute.

**Nouveau modèle** (inspiré Figma / SketchUp) :
- **Hover sur le mur** → curseur adapté :
  - à moins de 20 cm world de A ou B → `ew-resize` (ou `ns-resize` selon l'orientation) + petit tick doré à l'extrémité
  - ailleurs sur le mur → `move`
  - sur le vide → `default` ou `crosshair` (selon l'outil)
- **Clic simple** → sélection (liseré doré 1.5 px sur toute la longueur).
- **Cliquer-glisser sur une extrémité** (zone de 20 cm) → étire cette extrémité ; les murs qui partagent ce point suivent automatiquement (jonction préservée).
- **Cliquer-glisser sur le corps** → **translation parallèle** du mur ; les murs perpendiculaires connectés s'étirent, les murs parallèles connectés se translatent avec (généralisation de `resizeWallAndOpposite` dans store.ts).
- **Double-clic sur le mur** → input inline flottant « Longueur (cm) » ; Entrée valide, Échap annule ; le mur se redimensionne depuis l'extrémité opposée au point cliqué.
- **Alt+drag** → duplique le mur.
- **Suppression des poignées A / B / mid** dans Canvas2D.tsx (bloc `selectedWall && tool === "select"` lignes 865-921 supprimé).

### A.2 Ouvertures — glissement le long du mur et transfert

**Problème actuel** : impossible de repositionner à la souris ; il faut re-glisser depuis le catalogue.

**Nouveau** :
- **Cliquer-glisser sur une ouverture** → elle glisse le long de son mur, `t` recalculé ; snap tous les 5 cm ; snap aux extrémités du mur (marge d'aisance min de largeur/2 + 5 cm).
- **Cliquer-glisser au-delà du mur** → détection du mur cible sous le curseur (`findWallNear`) ; si trouvé et compatible (longueur suffisante), l'ouverture est **transférée** (`wallId` + `t` recalculés) ; sinon, elle reste sur le mur d'origine (relâche = annulation).
- **Feedback pendant le transfert** : mur source en gris atténué, mur cible en surbrillance dorée + ghost de l'ouverture en position cible.
- **Poignées de largeur invisibles** : cliquer-glisser sur les 10 % gauche/droite de l'ouverture = redimensionne, snap tous les 5 cm, minimum 40 cm, maximum = longueur du mur - 10 cm.
- **Double-clic** → popup inline « Largeur (cm) ».
- **Handles ⇄ / ⇅** (flip charnière / sens d'ouverture) : conservés mais **repositionnés** juste au-dessus de l'ouverture sélectionnée, taille réduite (9 px), et n'interceptent plus le drag principal (zone hit stricte).
- **Suppression** avec `Backspace` / `Del` (déjà OK).
- **Nudge clavier** flèches ← → (déjà OK).

### A.3 Meubles

- Drag existant conservé.
- **Handles de coin** (4 petits carrés) sur meuble sélectionné → redimensionnement libre (avec `Shift` pour conserver le ratio).
- **Handle rond de rotation** au-dessus du meuble → curseur `crosshair`, angle live affiché en overlay ; snap tous les 15°, `Shift` pour libre.
- **Snap au mur amélioré** : quand le meuble arrive à < 25 cm d'un mur, il « colle » à l'intérieur (côté salle) avec la bonne orientation (dos au mur). Type détecté par `wallType` : côté intérieur si mur extérieur, indifférent si mur intérieur.
- **Alt+drag** = duplication.

**Ajout exécuté — mobilité et édition des meubles** :
- Un meuble sélectionné se déplace directement au clic-glisser, sans drag HTML parasite.
- Les 4 coins redimensionnent le meuble au centimètre, avec cadre de sélection visible.
- Le handle rond supérieur pivote le meuble avec snap propre à 15°.
- Au déplacement, le meuble devient magnétique aux murs proches et s'oriente automatiquement dans l'axe du mur.
- Le panneau droit conserve l'édition numérique largeur / profondeur / hauteur / rotation pour les corrections exactes.

### A.4 Guides d'alignement intelligents (nouveauté)

Pendant un drag (mur, ouverture, meuble) :
- Scan de tous les autres éléments : si un axe (x ou y) est aligné à ± 4 px world, on affiche une **ligne pointillée dorée** allant de l'élément aligné jusqu'au curseur, et on **snappe** dessus.
- Alignement avec centres, faces, endpoints.
- Petit badge « = 245 cm » quand une distance égale est détectée entre deux paires d'éléments.

### A.5 Sélection multiple, copie et aimantation structurelle

**Ajout exécuté** :
- `Shift + clic` ajoute / retire un mur, une ouverture, un meuble ou une coupe de la sélection.
- `Shift + glisser` sur le vide trace un rectangle de sélection et sélectionne tous les éléments inclus.
- `Cmd/Ctrl + C`, `Cmd/Ctrl + V` et `Cmd/Ctrl + D` copient / dupliquent la sélection.
- Le panneau droit affiche un état « sélection multiple » avec duplication et suppression groupée.
- La duplication de murs conserve les ouvertures associées lorsque le mur est copié.
- Les murs déplacés restent magnétiques aux extrémités proches pour éviter les décrochages.
- Le dessin de nouveaux murs aimante les extrémités existantes et peut aussi s'accrocher sur un mur proche.

---

## PARTIE B — Navigation unifiée (zoom / pan) dans les 4 vues

Aujourd'hui : 2D = molette + espace, 3D = OrbitControls, Coupes = système ad hoc. **Nouveau : mêmes gestes partout.**

| Geste | Action |
|---|---|
| **Molette** | zoom sur le curseur (facteur 1.05) |
| **Espace + drag** | pan |
| **Clic-molette + drag** | pan |
| **Clic-droit + drag** | pan (en 3D : orbite) |
| **Deux-doigts trackpad** | pan (en 3D : orbite) |
| **Pinch trackpad** | zoom |
| **Double-clic sur le vide** | fit-to-content |
| **+ / -** | zoom in / out |
| **0** | fit-to-content |
| **1 / 2 / 3 / 4** | vues 2D / 3D / Split / Coupes |
| **Espace maintenu** | pan temporaire (curseur `grab`) |

- Chaque canvas a un **overlay bas-droite** : `[- ] 100 % [+] [⛶ recentrer]`.
- Fit-to-content au mount si le plan a du contenu (corrige le zoom pété à l'ouverture).
- Limites : zoom 15 % → 600 % en 2D, distance 1.5 → 80 m en 3D.

**Ajout exécuté — navigation 2D restaurée** :
- En mode sélection, clic-glisser sur le vide déplace à nouveau le plan.
- `Shift + clic-glisser` sur le vide crée un rectangle de sélection multiple.
- `0` recentre automatiquement le contenu, `+` et `-` zooment rapidement.

---

## PARTIE C — Cohérence entre 2D, 3D et coupes

C'est la partie critique. Aujourd'hui chaque vue fait ses propres calculs et diverge. **Toute cote doit être identique dans les 3 vues, au centimètre près.**

### C.1 Modèle de hauteurs unifié

Un seul système, source de vérité dans `store.ts` :

```
wallHeight      = mur.height (par type : intérieur 250, extérieur 270)
ceilingHeight   = plan.ceilingHeight (HSP, 250 par défaut)
floorThickness  = plan.floorThickness (dalle, 20 par défaut)
ceilingThick    = plan.ceilingThickness (0 par défaut)
roofRise        = calculé selon plan.roof
```

Dérivés :
- **Hauteur hors-tout** = wallHeight_ext + floorThickness + roofRise
- **Niveau 0** = haut de dalle (= sol fini)
- Le sol dessiné en coupe et en 3D est à Y = 0, la dalle descend en négatif.

Ces valeurs sont lues **par toutes les vues** — plus de constantes dispersées comme `DOOR_H = 210` en dur dans sections.ts (à supprimer, remplacer par la hauteur réelle de l'ouverture).

### C.2 Ouvertures — dimensions strictes

Chaque ouverture porte :
- `width` (cm, sur mur)
- `height` (cm, hauteur du panneau)
- `sillHeight` (allège, cm depuis le sol fini)

Défauts propres :
- Porte simple : w=83, h=210, sill=0
- Porte d'entrée : w=90, h=215, sill=0
- Porte double : w=140, h=210, sill=0
- Porte coulissante : w=80, h=210, sill=0
- Fenêtre 1 vantail : w=80, h=115, sill=100
- Fenêtre 2 vantaux : w=120, h=115, sill=100
- Oscillo-battant : w=100, h=115, sill=100
- Baie vitrée : w=240, h=215, sill=0
- Baie coulissante : w=240, h=215, sill=0
- Fixe : w=100, h=100, sill=100

**Ces défauts sont l'unique source** : suppression des fallbacks 210/120/100 codés dans Canvas3D, sections.ts, RightPanel. Utilisation systématique de `opening.height ?? DEFAULTS[kind].height`.

### C.3 Coupes — vraies coupes architecturales

Refonte de `sections.ts` :

**Génération** : 4 coupes auto **passant par le centre géométrique du plan** (pas à 1/3-2/3 comme aujourd'hui) :
- Coupe **N-S** verticale à x = centreX (vue depuis l'ouest, montrant le mur nord au fond)
- Coupe **N-S** verticale à x = centreX (vue depuis l'est)
- Coupe **E-O** horizontale à y = centreY (vue depuis le nord)
- Coupe **E-O** horizontale à y = centreY (vue depuis le sud)

**Contenu de chaque coupe** :
1. **Sol** : dalle hachurée sous Y=0, épaisseur `floorThickness`, largeur = longueur totale de coupe + débords 50 cm.
2. **Terrain naturel** : trait tireté à Y=-5 cm avec petite hachure sol naturel.
3. **Murs coupés** (traversés par le trait) : rectangle plein noir de largeur = épaisseur du mur, hauteur = wallHeight, avec ouvertures découpées (linteau + allège dessinés en trait fort).
4. **Murs en élévation** (parallèles au trait, en arrière-plan) : trait fin gris ; ouvertures dessinées en trait plus fin, avec allège + linteau + traverse centrale pour fenêtres.
5. **Plafond / dalle haute** : trait horizontal + hachure au-dessus, à Y = wallHeight.
6. **Toiture** si `plan.roof` défini : profil réel selon `kind` (plate, monopente, 2 pentes, 4 pentes), avec débords `overhang`.
7. **Cotes verticales à gauche** : niveaux successifs (Sol fini 0.00, Allège 1.00, Linteau 2.15, Plafond 2.50, Faîtage) — style plan FR avec triangles de niveau.
8. **Cotes horizontales en bas** : chaînage entre chaque ouverture et les murs (tableau bord → mur → ouverture → mur → ouverture → bord).
9. **Cote hors-tout** en bas, plus large.
10. **Label** en haut : « Coupe A-A' », « Coupe B-B' », etc.
11. **Cartouche** minuscule en bas-droite : échelle 1:50 ou 1:100 selon zoom.

**Précision** : toutes les cotes sont calculées à partir des mêmes données que le 2D et la 3D. Test de cohérence intégré (dev only) : `assertOpeningsMatch(plan2D, plan3D, planSection)`.

**Suppression** du magic dot 0.85 dans sections.ts qui décidait arbitrairement quels murs sont « parallèles » : nouvelle logique = **tout mur non traversé** dont la projection tombe dans la largeur de coupe est dessiné en élévation, avec profondeur calculée pour l'ordre de rendu (murs proches devant, éloignés derrière + estompés).

### C.4 3D — cohérence stricte avec le 2D

Refonte `Canvas3D.tsx` :
- **Murs** : hauteur = `w.height` (déjà OK), épaisseur = `w.thickness`, position = centreline exact.
- **Jonctions** : ajout de patches carrés aux endpoints (comme en 2D lignes 850-852) pour éviter les gaps aux coins → cubes de côté `maxThicknessAtJunction` à chaque endpoint partagé.
- **Ouvertures** : la découpe rectangulaire dans le mur (algo `rects` déjà présent) est conservée, mais avec les vraies hauteurs (voir C.2).
- **Vitrage** : plan vertical à mi-épaisseur, opacité 0.45, teinte bleu ciel.
- **Portes** : panneau ouvert à 90° pour porte simple, deux panneaux pour double, effacée pour coulissante (rail visible).
- **Sol** : plan à Y=0, dalle épaisse en dessous.
- **Plafond** : dalle grise à Y = ceilingHeight, visible depuis l'extérieur, masquée quand la caméra est dedans (auto-detect via bounding box).
- **Toit** : rendu conforme à `plan.roof` (déjà présent, à ajuster : pente, débords, matériau tuile #8b5a3c).
- **Refresh** : `useMemo` dépendant de tous les champs pertinents ; `key` sur `<Scene>` bumpé au changement de hauteurs pour forcer un remount propre.
- **Sync sélection** : cliquer un mur en 3D le sélectionne aussi en 2D (raycast → wallId).
- **Overlay HUD** : cote hors-tout, HSP, surface au sol en bas-gauche.

### C.5 Cotes 2D — normes plan français

- Cotes en cm entiers en dessous de 100 cm, en mètres avec 2 décimales au-delà (`2,45 m`).
- Tirets aux extrémités à 45° (déjà OK dans `renderDim`).
- Chaînage : cotes extérieures **cumulées** en bas + à droite, cotes intérieures **par pièce** en haut + à gauche.
- Cotes d'ouvertures : largeur affichée en petit sous chaque ouverture, allège en italique.
- Symbole nord (rose des vents) en haut-droite du 2D, orientable.

---

## PARTIE D — Interface et organisation

### D.1 Barre supérieure (TopBar)

`[Logo | Nom du projet] ... [2D | 3D | Split | Coupes] ... [Undo Redo | Grille Cotes | Export PNG PDF JSON]`

- Segmented control View avec états visuels clairs.
- Boutons Undo/Redo grisés quand indisponibles.

### D.2 Barre gauche (LeftPanel)

Sections avec séparateurs :
- **Sélection** : Sélection (V), Gomme (E)
- **Construction** : Mur (W), Pièce rectangle (R)
- **Ouvertures** : Porte (D), Fenêtre (F)
- **Mobilier** : catalogue draggable (déjà OK, à polish)

Suppression de l'outil **Section** (S) — les coupes sont automatiques.

Chaque outil : icône + tooltip (nom + raccourci) au hover.

### D.3 Panneau droit (RightPanel) — inspecteur contextuel

Un seul composant qui bascule selon la sélection :

- **Aucune sélection** :
  - Nom du projet
  - HSP (input cm, défaut 250)
  - Épaisseur dalle (input cm, défaut 20, caché derrière « Avancé »)
  - Épaisseur plafond (input cm, défaut 0, caché)
  - Hauteur hors-tout (readonly, calculée)
  - Type de toit + pente + débord
  - Grille (pas), unités, thème
  - Bouton « Appliquer les hauteurs à tous les murs »

- **Mur** : type (intérieur/extérieur, dropdown), épaisseur, hauteur, longueur (readonly), bouton « Retourner ».

- **Ouverture** : type (porte/fenêtre), sous-type (dropdown avec preview icône), largeur, hauteur, allège, sens (⇄ ⇅ boutons), position sur mur (slider 0-100 %).

- **Meuble** : label (éditable), largeur, hauteur, rotation, kind (readonly).

Tous les inputs numériques : Entrée valide, Tab navigue, blur sauve. Unités affichées (cm / m / °).

### D.4 Split view

Layout 50/50, resize handle central. Sélectionner en 2D highlight en 3D et vice-versa (matériau doré temporaire sur le mesh).

### D.5 Coupes view

Grille 2×2 des 4 coupes auto (déjà en place). Ajouts :
- Chaque vignette a son propre zoom/pan indépendant.
- Titre cliquable → plein écran (modal), Échap referme.
- Bouton « Recentrer » par vignette.
- Sélection croisée : cliquer un mur en coupe le sélectionne aussi en 2D.

---

## PARTIE E — Bugs et incohérences à corriger

1. **Drag mur qui saute** : disparaît avec suppression des poignées (nouveau modèle direct).
2. **Sélection perdue au flip** : `cancelBubble` renforcé + `e.evt.stopPropagation()`.
3. **Pan involontaire quand on drag un shape** : `onDragStart` du Stage vérifie strictement `e.target === stage`.
4. **Zoom initial cassé** : fit-to-content au mount si `plan.walls.length > 0`.
5. **Coupes vides au 1er affichage** : recompute au `useEffect` sur mount de la vue.
6. **3D pas rafraîchi au changement de HSP** : deps `useMemo` complètes, `key` sur `<Scene>`.
7. **Hauteurs 210/120 codées en dur** dans `sections.ts` → utiliser `opening.height`.
8. **Dot product 0.85 arbitraire** → nouvelle logique de projection par largeur de coupe.
9. **Sections auto à 1/3-2/3** → recentrées au milieu.
10. **Handles flip qui bloquent le clic sur l'ouverture** → hit zone stricte + z-index.
11. **Meubles qui traversent les murs en 3D** → clamp Y et détection collision au drop.
12. **Roof qui ne suit pas les changements de hauteur mur** → deps corrigées.
13. **Cotes qui se chevauchent quand le plan est petit** → offset dynamique selon `scale`.
14. **Grille qui déborde du canvas** → clip à la viewport.
15. **Export PDF qui prend la mauvaise résolution** → `pixelRatio` calculé selon la taille du plan.

---

## PARTIE F — Feedback visuel et micro-interactions

- **Hover** sur wall/opening/furniture : halo doré à 30 % opacité + curseur adapté.
- **Sélection** : liseré doré 1.5 px + coins rectangulaires (pas de disques).
- **Drag actif** : badge de cotation qui suit le curseur (position, longueur, angle selon contexte).
- **Snap actif** : petit tick jaune + ligne d'alignement pointillée dorée.
- **Snap grille** : discret (juste le mouvement discret).
- **Transfert d'ouverture** : mur source atténué, mur cible mis en valeur, ghost coloré.
- **Toasts** discrets pour actions non-destructives (« Coupes régénérées », « Plan sauvegardé »).
- **Undo/Redo** : léger flash sur les éléments impactés.

---

## Fichiers touchés

### Modifications
- `src/components/editor/Canvas2D.tsx` — refonte drag (murs sans poignées, ouvertures glissantes, meubles handles coin/rotation), guides d'alignement, popups inline.
- `src/components/editor/Canvas3D.tsx` — jonctions carrées, sélection sync, plafond conditionnel, HUD, deps corrigées.
- `src/components/editor/CanvasSection.tsx` — zoom/pan unifié, plein écran modal, cotes normées FR, cohérence dimensions.
- `src/components/editor/EditorShell.tsx` — segmented view, sync sélection Split, raccourcis 1/2/3/4.
- `src/components/editor/LeftPanel.tsx` — sections outils, retrait section, tooltips + raccourcis.
- `src/components/editor/RightPanel.tsx` — inspecteur contextuel unifié, avancé collapsible.
- `src/components/editor/TopBar.tsx` — segmented control + états.
- `src/lib/editor/store.ts` — actions `moveWallParallel`, `transferOpeningToWall`, `duplicateFurniture`, `setFloorThickness`, `setCeilingThickness`, sync selection.
- `src/lib/editor/sections.ts` — génération 4 coupes centrées, suppression consts en dur, projection par largeur de coupe, cotes niveaux + chaînage, dalle/plafond/toit.
- `src/lib/editor/geometry.ts` — `nearestWallEnd`, `alignmentGuides`, `wallsAtPoint`.
- `src/lib/editor/types.ts` — `plan.floorThickness`, `plan.ceilingThickness`, defaults ouvertures typés.

### Nouveaux
- `src/lib/editor/opening-defaults.ts` — source unique des dimensions par sous-type.
- `src/lib/editor/coherence.ts` — helpers d'assertions dev (2D = 3D = coupes).
- `src/components/editor/InlineNumberInput.tsx` — popup édition rapide au double-clic.
- `src/components/editor/AlignmentGuides.tsx` — overlay guides Figma-like.

## Détails techniques

- **Détection extrémité vs corps** : dans `onMouseDown`, si `dist(curseur, endpoint) < 20 / scale` → mode extrémité, sinon → mode corps. Aucune poignée visible.
- **Translation parallèle** : projection du déplacement curseur sur la normale du mur ; les murs perpendiculaires connectés étirent une extrémité (celle qui touche notre mur), les murs parallèles connectés se translatent aussi. Algo itératif limité à 1 propagation (pas de cascade infinie).
- **Transfert ouverture** : au `mouseup`, si `findWallNear` retourne un mur ≠ mur d'origine et longueur >= largeur + 20 cm, on remap ; on `commit()` avant.
- **Guides d'alignement** : au `mousemove`, on liste les endpoints, centres, faces qui ont `|x - curseur.x| < 4 / scale` ou `|y - curseur.y| < 4 / scale`, on snappe et on dessine la ligne.
- **Sections centrées** : `xW = xE = (minX + maxX) / 2`, `yN = yS = (minY + maxY) / 2` ; on garde 4 vues distinctes pour les 4 directions de regard.
- **Cohérence hauteurs** : source = `store`, tous les fallbacks 210/120/100 remplacés par `OPENING_DEFAULTS[o.kind].height`.
- **Cotes chaînées coupe** : parcours des cuts triés par `start`, dessin d'une ligne de cote continue avec ticks à chaque break, labels centrés dans chaque intervalle.
- **Fit-to-content** : bbox du plan + padding 15 %, calcul `scale = min(w_canvas / bbox.w, h_canvas / bbox.h)`.
- **Cross-view sélection** : `selection` déjà global, il suffit de câbler les raycasts 3D et les hit-tests coupes.

## Hors scope

- Détection auto de pièces / tableau de surfaces (déjà en place, à ne pas retoucher sauf branchement PDF).
- Génération PDF (déjà en place).
- Catalogue meubles (contenu).
- Thèmes de couleur.

## Ordre d'exécution

1. **Fondations** : `opening-defaults.ts`, `store.ts` (nouveaux champs + actions), `types.ts`, `geometry.ts` helpers.
2. **Cohérence data** : `sections.ts` refonte, suppression consts en dur, `coherence.ts`.
3. **2D manipulation** : `Canvas2D.tsx` — suppression poignées, drag direct murs, drag ouvertures + transfert, meubles handles, guides.
4. **3D cohérence** : `Canvas3D.tsx` — jonctions, hauteurs strictes, sélection sync, HUD.
5. **Coupes** : `CanvasSection.tsx` — 4 coupes centrées, cotes niveaux + chaînage, plein écran, zoom unifié.
6. **Interface** : `TopBar.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `EditorShell.tsx` — segmented, inspecteur, raccourcis.
7. **Polish** : guides d'alignement, popups inline, feedback visuels, toasts.
8. **QA** : tests sur ton plan existant (7×2,76 m avec porte 73 + fenêtre 80), vérification que 2D / 3D / 4 coupes montrent exactement les mêmes cotes.

Dis-moi si tu valides, ou si un point mérite d'être ajusté avant que je démarre.
