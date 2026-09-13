# Refonte traçage des murs — plan d'exécution

> **Pour Hermes :** exécuter ce plan uniquement après validation utilisateur. Ne pas faire de patch opportuniste dans `Canvas2D.tsx` sans extraire d'abord le moteur géométrique et les tests.

**But :** rendre le traçage des murs Residale Config simple, rapide, intuitif et fiable : murs droits, aimantation propre, pièces fermées détectées immédiatement, surfaces intérieures en m² visibles pendant la construction, édition logique quel que soit le sens de tracé.

**Architecture :** remplacer les règles dispersées dans `Canvas2D.tsx` par un moteur de dessin 2D déterministe : snapping → contrainte orthogonale/angle → création de segment → fusion des nœuds → détection des pièces → rendu des aides. Le canvas doit devenir une couche d'interaction/rendu, pas l'endroit où vit toute la géométrie.

**Tech stack :** React + Konva (`react-konva`), Zustand (`useEditor`), TypeScript pur pour la géométrie, tests Node/Vitest ou tests TS exécutables sans DOM pour le moteur.

---

## 0. Constat actuel après inspection du code

Fichiers inspectés :

- `src/components/editor/Canvas2D.tsx`
- `src/lib/editor/store.ts`
- `src/lib/editor/geometry.ts`
- `src/lib/editor/wall-geometry.ts`
- `src/lib/editor/rooms.ts`
- `src/components/editor/LeftPanel.tsx`
- `src/components/editor/RightPanel.tsx`
- `src/lib/editor/types.ts`
- `package.json`

Problèmes structurels repérés :

1. **Le comportement de dessin est trop dispersé dans `Canvas2D.tsx`.**  
   `applySnap`, `normalizeWallAxis`, `snapWallEndpoint`, `translateWallBody`, `snapWallMove`, `wallAxisKind`, etc. sont dans le composant React. Résultat : difficile à tester, difficile à raisonner, beaucoup de cas limites.

2. **L'orthogonalité n'est pas assez prioritaire.**  
   Le tracé utilise `snapAngle(..., 15°)` puis grille. Pour un logiciel de plan intérieur, le cas par défaut doit être 0°/90° ultra-stable. Les angles libres doivent être possibles seulement volontairement.

3. **Le magnétisme mélange plusieurs intentions.**  
   `applySnap` essaie successivement : endpoints, projection mur, grille, angle. Il manque une notion de “candidat de snap” priorisé avec feedback visuel : endpoint, prolongement d'axe, intersection, grille, mur.

4. **Les pièces sont détectées mais pas intégrées au workflow de dessin.**  
   `rooms.ts` sait détecter des cycles, mais `Canvas2D.tsx` ne semble pas l'utiliser pour afficher les m² pendant/juste après le tracé. Le sol est aujourd'hui un rectangle de bounding box (`floorRect`), pas une vraie surface fermée.

5. **Les murs sont stockés comme segments indépendants.**  
   Les jonctions sont tolérées par proximité (`EPS`, `MAGNETIC_ENDPOINT_EPS`) mais il n'y a pas un vrai graphe de nœuds stable. Quand on bouge un mur, les connexions peuvent devenir non intuitives.

6. **L'outil “Mur” fonctionne en clic-clic continu, mais il manque les aides pros :**
   - verrouillage axe horizontal/vertical automatique ;
   - retour au point de départ pour fermer une pièce ;
   - aperçu de longueur en temps réel ;
   - aperçu surface intérieure si fermeture ;
   - bouton/interaction “terminer la pièce” ;
   - correction automatique des petits décalages.

7. **L'outil “Pièce rectangle” est utile mais trop limité.**  
   Deux clics créent un rectangle, mais il n'y a pas de mode rapide “pièce” orienté métier : longueur × largeur, surfaces, poignées de redimensionnement intelligentes.

---

## 1. Résultat produit attendu

### Expérience utilisateur cible

#### Mode “Pièce rapide” — le chemin principal

1. L'utilisateur clique sur **Pièce**.
2. Premier clic : point de départ.
3. Il déplace la souris : un rectangle propre apparaît, toujours droit.
4. Deuxième clic : la pièce est créée avec 4 murs connectés.
5. La surface intérieure apparaît immédiatement au centre : `12,48 m²`.
6. Les poignées permettent d'étirer largeur/longueur sans casser les angles.
7. Les cotes apparaissent autour, en mètres, lisibles.

#### Mode “Mur continu” — pour les formes libres mais propres

1. L'utilisateur clique sur **Mur**.
2. Premier clic : départ.
3. La souris prévisualise un mur **orthogonal par défaut** : horizontal/vertical selon le mouvement dominant.
4. Si l'utilisateur maintient une touche explicite : angle libre ou angle à 15°.
5. Chaque nouveau point s'aligne sur : endpoints, axes existants, prolongements, intersections, grille.
6. Quand le curseur revient près du point de départ, le logiciel propose une fermeture visuelle : “Fermer la pièce — XX m²”.
7. Le clic ferme la pièce proprement : endpoints fusionnés, surface calculée, label m² affiché.

#### Édition

- Déplacer un mur horizontal le garde horizontal.
- Déplacer un mur vertical le garde vertical.
- Déplacer un coin déplace les murs connectés proprement.
- Modifier la longueur dans le panneau garde le mur droit et ajuste les murs connectés de manière prévisible.
- Les murs intérieurs coupant une enveloppe créent/actualisent les surfaces de pièces.

---

## 2. Décisions d'architecture

### 2.1 Créer un moteur géométrique testable

Créer :

- `src/lib/editor/wall-engine.ts`
- `src/lib/editor/snapping.ts`
- `src/lib/editor/room-engine.ts`
- `src/lib/editor/wall-engine.test.ts` ou `tests/wall-engine.test.mjs` selon choix outillage

Objectif : sortir toute la logique métier hors de `Canvas2D.tsx`.

Le moteur expose des fonctions pures :

```ts
resolveDrawPoint(input): SnapResult
createWallSegment(input): WallMutation
normalizePlanTopology(plan): Plan
moveWallEndpoint(input): Plan
moveWallBody(input): Plan
resizeWallLength(input): Plan
detectInteriorRooms(plan): Room[]
formatAreaLabel(areaCm2): string
```

### 2.2 Introduire une topologie implicite propre

Sans forcément changer tout le modèle persisté au début, le moteur doit construire une topologie temporaire :

```ts
type WallNode = {
  id: string;
  point: Point;
  connectedWallIds: string[];
};

type WallGraph = {
  nodes: WallNode[];
  edges: Wall[];
};
```

À court terme, `Plan.walls` reste la source de vérité pour éviter une migration risquée. Mais toute action passe par `normalizePlanTopology(plan)` :

- fusion endpoints à moins de `1–2 cm` ;
- suppression des murs trop courts ;
- arrondi coordonnées ;
- maintien des connexions partagées ;
- classement stable des nœuds.

### 2.3 Priorité des snaps

Le snap doit devenir lisible et déterministe :

1. **Endpoint existant** — priorité max.
2. **Point de départ du tracé** — pour fermer une pièce.
3. **Intersection axe horizontal/vertical avec endpoint existant** — alignement mural.
4. **Projection sur prolongement horizontal/vertical du point précédent.**
5. **Projection sur mur existant** — utile pour raccorder un refend.
6. **Grille** — dernier recours.
7. **Angle libre/15°** — uniquement si option ou touche active.

Chaque résultat renvoie aussi un type d'aide visuelle :

```ts
type SnapKind =
  | 'endpoint'
  | 'close-room'
  | 'axis-x'
  | 'axis-y'
  | 'wall-projection'
  | 'grid'
  | 'free';
```

### 2.4 Orthogonalité par défaut

Règle proposée :

- Sans modificateur : le mur se verrouille automatiquement sur l'axe dominant `horizontal` ou `vertical`.
- Avec `Shift` : verrouillage explicite à l'axe dominant ou permutation de l'axe selon convention UI à définir.
- Avec `Alt` : angle libre ou snap 15°.
- Avec `Ctrl/Cmd` : désactiver temporairement le magnétisme.

Important : l'utilisateur ne doit pas avoir à “réussir” à tracer droit. Le logiciel doit le faire pour lui.

### 2.5 Surfaces intérieures

Améliorer `rooms.ts` en `room-engine.ts` :

- détecter toutes les faces fermées du graphe ;
- retirer la face extérieure ;
- calculer la surface **intérieure** et non juste la surface centre-ligne ;
- tenir compte de l'épaisseur des murs autant que raisonnable ;
- afficher surfaces par pièce ;
- recalculer à chaque mutation de mur.

Approche pragmatique :

- Phase 1 : surface centre-ligne fiable, affichée en m², déjà bien meilleure que rien.
- Phase 2 : offset intérieur par épaisseur pour surfaces plus exactes.

---

## 3. Plan d'exécution par étapes

### Étape 1 — Ajouter des tests de géométrie avant refonte

**Objectif :** sécuriser le comportement attendu avant de toucher au canvas.

**Fichiers :**

- Créer `src/lib/editor/wall-engine.ts`
- Créer `src/lib/editor/snapping.ts`
- Créer `src/lib/editor/room-engine.ts`
- Créer `tests/wall-engine.test.mjs` ou configurer Vitest pour `src/lib/editor/*.test.ts`
- Modifier `package.json` si nécessaire pour inclure les tests géométrie dans `npm test`

**Cas tests obligatoires :**

1. tracer de `(0,0)` vers `(301, 7)` donne un mur horizontal `(0,0)` → `(300,0)` ;
2. tracer de `(0,0)` vers `(8, 247)` donne un mur vertical `(0,0)` → `(0,240/260 selon grille)` ;
3. endpoint proche d'un endpoint existant snappe dessus ;
4. retour proche du point de départ ferme la pièce ;
5. rectangle 400×300 cm crée une pièce de 12 m² centre-ligne ;
6. micro-décalage entre endpoints est fusionné ;
7. déplacement d'un mur horizontal le garde horizontal ;
8. déplacement d'un coin conserve les connexions.

**Validation :**

```bash
npm test
npm run build
```

---

### Étape 2 — Extraire le snapping hors `Canvas2D.tsx`

**Objectif :** remplacer `applySnap`, `snapWallEndpointToNode`, `snapWallEndpoint`, une partie de `normalizeWallAxis` par un moteur pur.

**Fichiers :**

- Modifier `src/lib/editor/snapping.ts`
- Modifier `src/components/editor/Canvas2D.tsx`

**API cible :**

```ts
export function resolveSnap(input: {
  raw: Point;
  previous?: Point;
  drawingStart?: Point;
  plan: Plan;
  grid: number;
  scale: number;
  snapEnabled: boolean;
  mode: 'draw-wall' | 'move-endpoint' | 'move-wall' | 'rectangle';
  modifiers?: { freeAngle?: boolean; disableSnap?: boolean };
  ignoreWallId?: string;
}): SnapResult;
```

**Résultat :** `Canvas2D` reçoit un `SnapResult` avec :

- `point` ;
- `kind` ;
- `sourcePoint` éventuel ;
- `guideLines` éventuelles ;
- `wouldCloseRoom` éventuel.

**Validation :**

- tests unitaires ;
- build ;
- test manuel : tracer 10 murs horizontaux/verticaux sans zoomer.

---

### Étape 3 — Orthogonalité par défaut dans l'outil Mur

**Objectif :** le mur doit être droit par défaut, quelle que soit la précision souris.

**Fichiers :**

- Modifier `src/lib/editor/snapping.ts`
- Modifier `src/components/editor/Canvas2D.tsx`
- Modifier `src/components/editor/ShortcutsHelp.tsx`
- Modifier `src/components/editor/LeftPanel.tsx`

**Comportement :**

- `tool === 'wall'` : axe dominant verrouillé automatiquement.
- `Alt` : angle libre / 15°.
- `Ctrl/Cmd` : snap off temporaire.
- prévisualisation du mur avec longueur en mètres.

**Acceptation :**

- si l'utilisateur bouge la souris “à peu près horizontalement”, le mur est parfaitement horizontal ;
- idem vertical ;
- aucun mur légèrement incliné à 2°/3° ne doit être créé involontairement.

---

### Étape 4 — Fermeture intelligente de pièce

**Objectif :** le logiciel comprend qu'on veut fermer une pièce et aide visuellement.

**Fichiers :**

- Modifier `src/lib/editor/snapping.ts`
- Modifier `src/lib/editor/room-engine.ts`
- Modifier `src/components/editor/Canvas2D.tsx`

**Comportement :**

- pendant un tracé continu, si le curseur est proche du premier point :
  - snap prioritaire sur le premier point ;
  - halo vert / point de fermeture ;
  - texte “Fermer la pièce” ;
  - surface prévisionnelle en m².
- au clic :
  - dernier mur créé ;
  - `drawing` remis à null ;
  - outil retourne éventuellement en sélection ou reste en mur selon décision UX.

**Acceptation :**

- tracer 4 murs approximatifs autour d'une pièce ferme exactement le polygone ;
- la surface apparaît immédiatement.

---

### Étape 5 — Refaire la détection de pièces et affichage m²

**Objectif :** afficher les surfaces intérieures en permanence dès qu'une pièce existe.

**Fichiers :**

- Remplacer/étendre `src/lib/editor/rooms.ts` ou créer `src/lib/editor/room-engine.ts`
- Modifier `src/components/editor/Canvas2D.tsx`
- Modifier `src/components/editor/LeftPanel.tsx`

**Rendu canvas :**

- remplissage léger de chaque pièce ;
- label au centre : `Séjour · 18,42 m²` si label disponible, sinon `Pièce 1 · 18,42 m²` ;
- surface mise à jour quand un mur bouge.

**Résumé panneau gauche :**

- nombre de pièces ;
- surface totale intérieure ;
- liste courte : Pièce 1, Pièce 2, etc.

**Acceptation :**

- rectangle 4 m × 3 m → `12,00 m²` ;
- deux pièces séparées par un mur intérieur → deux surfaces ;
- suppression du mur intérieur → une surface globale.

---

### Étape 6 — Remplacer `floorRect` par de vraies surfaces

**Objectif :** ne plus colorer le sol avec un simple bounding box.

**Fichier :**

- Modifier `src/components/editor/Canvas2D.tsx`

**Comportement :**

- les surfaces détectées sont rendues comme polygones ;
- plus de faux rectangle de sol autour d'un plan en L ;
- les pièces non fermées ne sont pas remplies ou sont indiquées comme “non fermées”.

**Acceptation :**

- plan en L : le sol suit le L, pas le rectangle englobant ;
- pièce ouverte : pas de surface m² trompeuse.

---

### Étape 7 — Édition mur/coin vraiment logique

**Objectif :** peu importe le sens dans lequel le mur a été créé, édition prévisible.

**Fichiers :**

- Modifier `src/lib/editor/wall-engine.ts`
- Modifier `src/lib/editor/store.ts`
- Modifier `src/components/editor/Canvas2D.tsx`
- Modifier `src/components/editor/RightPanel.tsx`

**Comportements :**

- sélectionner un mur affiche : longueur, orientation, type, épaisseur, hauteur ;
- bouton “Rendre horizontal” / “Rendre vertical” si mur non orthogonal ;
- modifier la longueur respecte l'ancre choisie : début, centre, fin ;
- déplacer un endpoint bouge toutes les connexions du nœud ;
- déplacer un mur ne casse pas les pièces adjacentes.

**Acceptation :**

- mur tracé gauche→droite ou droite→gauche : même comportement ;
- longueur modifiée dans panneau : pas de diagonale involontaire ;
- coins connectés restent connectés.

---

### Étape 8 — Feedback visuel magnétisme

**Objectif :** l'utilisateur comprend ce qui se passe.

**Fichier principal :**

- `src/components/editor/Canvas2D.tsx`

**À afficher :**

- point aimanté coloré ;
- ligne guide horizontale/verticale ;
- tooltip près du curseur : `4,20 m`, `Horizontal`, `Aligné`, `Fermer · 12,00 m²` ;
- couleur différente pour endpoint / axe / grille.

**Acceptation :**

- le curseur donne un retour immédiat ;
- plus de sensation que le logiciel “saute” sans explication.

---

### Étape 9 — Mode “Pièce rapide” amélioré

**Objectif :** faire du bouton `Pièce` l'outil principal pour un commercial/non-technicien.

**Fichiers :**

- Modifier `src/components/editor/Canvas2D.tsx`
- Modifier `src/components/editor/LeftPanel.tsx`
- Modifier `src/lib/editor/wall-engine.ts`

**Comportement :**

- deux clics créent un rectangle propre ;
- affichage live `L × l` + m² pendant le déplacement ;
- dimensions arrondies à la grille ;
- option dans panneau : épaisseur extérieure / intérieure ;
- après création, la pièce est sélectionnée ou les 4 murs sont sélectionnés comme groupe.

**Acceptation :**

- créer une pièce standard prend moins de 3 secondes ;
- surface visible sans action supplémentaire.

---

### Étape 10 — QA navigateur et scénarios métier

**Objectif :** vérifier en vrai, pas seulement au build.

**Scénarios manuels obligatoires :**

1. Créer une pièce rectangulaire 4×3 m.
2. Créer un plan en L.
3. Tracer 4 murs à main approximative et vérifier fermeture/surface.
4. Ajouter un mur intérieur et vérifier surfaces séparées.
5. Déplacer un mur extérieur et vérifier surfaces recalculées.
6. Déplacer un coin et vérifier connexions.
7. Poser porte/fenêtre après refonte et vérifier qu'elles s'alignent encore.
8. Export PDF/feuille architecte pour vérifier absence de régression visuelle.

**Commandes :**

```bash
npm test
npm run build
npm run dev
```

Puis test navigateur local avec console ouverte : zéro erreur JS.

---

## 4. Fichiers probablement modifiés

### Géométrie / moteur

- `src/lib/editor/geometry.ts`
- `src/lib/editor/wall-geometry.ts`
- `src/lib/editor/rooms.ts`
- `src/lib/editor/wall-engine.ts` — nouveau
- `src/lib/editor/snapping.ts` — nouveau
- `src/lib/editor/room-engine.ts` — nouveau ou remplacement propre de `rooms.ts`
- `src/lib/editor/types.ts` — types `SnapResult`, `Room`, éventuellement `WallNode`

### État

- `src/lib/editor/store.ts`

### UI canvas

- `src/components/editor/Canvas2D.tsx`

### Panneaux / aide

- `src/components/editor/LeftPanel.tsx`
- `src/components/editor/RightPanel.tsx`
- `src/components/editor/ShortcutsHelp.tsx`
- `src/components/editor/CommandPalette.tsx`

### Tests / config

- `package.json`
- `tests/wall-engine.test.mjs` ou `src/lib/editor/*.test.ts`

---

## 5. Critères d'acceptation non négociables

- Aucun mur légèrement incliné n'est créé par erreur en usage normal.
- Le magnétisme ne casse pas l'intention utilisateur : endpoint > fermeture > axe > mur > grille.
- Une pièce fermée affiche automatiquement ses m².
- Les surfaces se mettent à jour après déplacement/suppression de mur.
- Un plan en L n'affiche pas une fausse surface rectangulaire.
- Le bouton `Pièce` permet de créer une pièce complète en deux clics.
- Le mode `Mur` permet de faire une forme complète rapidement, avec fermeture guidée.
- Les portes/fenêtres continuent de fonctionner après refonte.
- `npm test` et `npm run build` passent.
- Validation navigateur réelle faite avant de dire “terminé”.

---

## 6. Risques et garde-fous

### Risque : trop grosse refonte en une seule fois

**Garde-fou :** d'abord extraire moteur + tests, puis brancher progressivement dans `Canvas2D.tsx`.

### Risque : casser portes/fenêtres

Les ouvertures sont attachées par `wallId` + `t`. Si les murs sont recréés trop souvent, les ouvertures peuvent perdre leur support.

**Garde-fou :** préserver les IDs de murs existants autant que possible ; tests de déplacement/raccourcissement avec ouverture posée.

### Risque : surface intérieure exacte complexe

L'offset intérieur par épaisseur peut être délicat pour formes concaves/intersections.

**Garde-fou :** livrer d'abord une surface centre-ligne stable, puis itérer vers surface intérieure exacte. L'UI peut indiquer “surface estimée” si nécessaire pendant la première phase.

### Risque : interactions clavier ambiguës

Shift/Alt/Ctrl peuvent déjà servir ailleurs.

**Garde-fou :** documenter dans `ShortcutsHelp.tsx`, tester sur Mac/Windows, garder un comportement par défaut simple sans demander de raccourci.

---

## 7. Ordre de livraison recommandé

1. Tests géométrie + moteur minimal.
2. Snap/orthogonalité par défaut dans le tracé mur.
3. Fermeture de pièce + surface live.
4. Affichage permanent des surfaces.
5. Remplacement du faux `floorRect`.
6. Édition mur/coin propre.
7. Feedback visuel complet.
8. QA, build, navigateur, export.

---

## 8. Note sur le logiciel de référence

Le message utilisateur mentionne un logiciel envoyé “ci-dessous”, mais aucune pièce jointe/référence visuelle n'est disponible dans le contexte actuel. Dès réception du screenshot, lien ou vidéo, comparer explicitement :

- méthode de démarrage/fin de mur ;
- snapping visible ;
- fermeture pièce ;
- affichage des cotes ;
- affichage m² ;
- édition post-création.

Le plan ci-dessus reste valide comme base technique ; la référence servira à ajuster le niveau d'UX et les détails visuels.
