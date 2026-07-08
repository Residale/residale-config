
# Plan — Coupes architecturales, thèmes & édition des murs

Une refonte structurée en 4 axes. Tout reste en frontend/presentation (Konva + Three.js + Zustand), aucune logique backend nécessaire.

## 1. Correction des coins de murs (2D + 3D)

**Problème** : les murs sont rendus segment par segment, ce qui laisse un « trou » d'un pixel au coin et empêche la jonction propre en 3D.

**Solution** :
- 2D : rendu des murs en deux passes — d'abord l'ombre/extérieur (union géométrique des polygones de mur épaissis), puis l'intérieur. Utilisation d'un cap `round` + jonction explicite via calcul des polygones de mur (offset perpendiculaire), avec fusion des sommets partagés dans un rayon de tolérance (≤ 2 cm) pour souder les coins.
- 3D : chaque mur devient un `ExtrudeGeometry` à partir de son polygone soudé, la géométrie est fusionnée avec `BufferGeometryUtils.mergeGeometries` → plus aucun gap visible aux jonctions.
- Vérification stricte de l'échelle : `PIXELS_PER_CM = 1` (déjà le cas) — l'épaisseur 24 cm rendra exactement 24 unités monde, mesurables à la règle de cotes.

## 2. Édition magnétique des murs

Sur sélection d'un mur avec l'outil Sélection :
- Poignées A / B (extrémités) + poignée milieu (translation parallèle du mur).
- Drag magnétique multi-cibles :
  - snap à la grille (déjà en place),
  - snap aux extrémités des autres murs (rayon 15 cm),
  - snap perpendiculaire / parallèle aux murs adjacents,
  - snap d'angle (0, 15, 30, 45, 90°) lors du drag d'une extrémité.
- Édition numérique directe dans le panneau droit : longueur, angle, position (x,y) des deux extrémités, épaisseur.
- Panneau contextuel qui affiche en temps réel la longueur pendant le drag.

## 3. Système de thèmes 2D personnalisables

**Thèmes par défaut inspirés des conventions françaises (DTU / normes archi)** :
- **Plan technique NF** — murs noirs pleins (poché), sol blanc, cotes noires, texte JetBrains Mono. Style DPE / permis de construire.
- **Aquarelle architecte** — murs gris foncé pochés, sol bleu clair (comme votre exemple), remplissages doux. Style rendu client.
- **Blueprint** — fond bleu profond, traits blancs. Style présentation.
- **Épuré / minimal** — murs gris moyen, sol beige, cotes discrètes.

**Personnalisation** :
- Nouveau panneau « Thème » dans la barre gauche (onglet Palette) :
  - couleur murs (poché intérieur + contour),
  - couleur sol / remplissage pièce,
  - couleur cotes & texte,
  - couleur grille,
  - épaisseur des traits (fin/standard/gras),
  - style de hachurage mur (plein, hachures 45°, poché noir).
- Thème stocké dans le store, réutilisé par Canvas2D et les coupes.
- 3D reste sur son propre système (matériaux configurables séparément — extension future).

## 4. Plans en coupe architecturaux (nouvelle vue)

C'est la grosse feature. Basée sur les conventions françaises (échelle 1/50 ou 1/100, cotes extérieures, cotes de niveau, hachures de terre/dalle).

**Ajout au modèle** :
- `Wall.height` (défaut 250 cm),
- `Opening.height`, `Opening.sillHeight` (allège pour fenêtre — défaut 100 cm ; porte = 0),
- `Furniture.height` (défaut selon catalogue),
- `Plan.levels` : dalle bas (0), plafond (250), toiture optionnelle.

**Générateur de coupe** :
- L'utilisateur trace un « plan de coupe » (ligne A-A') dans la vue 2D via un nouvel outil `section`.
- Un moteur calcule l'intersection de cette ligne avec chaque mur, ouverture, mobilier → produit une liste d'éléments coupés (largeur projetée sur la ligne, hauteur, type).
- Vue coupe rendue en Konva séparé :
  - dalle bas hachurée (hachures terre 45°),
  - murs coupés en poché noir plein,
  - portes : rectangle vide 210 cm de haut, cote de hauteur,
  - fenêtres : allège + vitrage + linteau, cotes de sill et de tête,
  - mobilier vu en élévation derrière (contour fin),
  - cotes verticales complètes (allège, hauteur ouverture, linteau, plafond),
  - cotes horizontales sur toute la largeur,
  - étiquette « Coupe A-A' », échelle, indication du nord.
- Multi-coupes : possibilité de créer plusieurs lignes (A-A', B-B', C-C').

**Sélecteur d'affichage** (panneau droit en mode coupe) :
- toggles : cotes verticales, cotes horizontales, cotes de niveau, hachures de sol, mobilier, étiquettes d'ouvertures, ligne de terrain naturel, axes.
- choix du thème 2D actif (les 4 thèmes + custom).
- export PNG de la coupe.

**Nouvelle vue dans la topbar** : `2D | Coupe | 3D | Split`.

## Détails techniques

- Nouveaux fichiers :
  - `src/lib/editor/theme.ts` — presets + type `Theme2D`.
  - `src/lib/editor/sections.ts` — calcul d'intersection ligne × mur / ouverture / mobilier.
  - `src/lib/editor/wall-geometry.ts` — polygones de mur soudés (offset + fusion sommets).
  - `src/components/editor/CanvasSection.tsx` — rendu Konva de la coupe.
  - `src/components/editor/ThemePanel.tsx` — édition des couleurs & preset.
- Store enrichi : `theme`, `sections: SectionLine[]`, `activeSectionId`, actions associées.
- Types enrichis : `height`, `sillHeight`, `Level`, `SectionLine`.
- `RightPanel` gagne un mode contextuel selon la vue active.
- Canvas2D : ajoute les poignées de mur + drag magnétique + calcul polygone soudé.
- Canvas3D : consomme les polygones soudés + `Wall.height`.

## Livraison

Tout en un lot. Les toggles / snaps / thèmes existants restent fonctionnels et rétro-compatibles avec le plan de démarrage. Un plan par défaut est enrichi avec une ligne de coupe A-A' d'exemple pour valider la vue coupe dès l'ouverture.
