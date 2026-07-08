
## Ce que je vais faire

### 1. Coupes automatiques — plus besoin de l'outil "Coupe"
- **Retirer l'outil section** de la barre d'outils (à gauche) → les coupes sont générées toutes seules
- **4 vues auto** au lieu de 2 : Face Nord, Face Sud, Face Est, Face Ouest (chaque coupe est prise depuis l'extérieur, à l'aplomb du mur correspondant)
- Les portes/fenêtres apparaissent automatiquement avec cotes exactes (déjà en place)

### 2. Affichage des coupes
- **Grille des 4 coupes en même temps** (2×2), plus de "tabs" à cliquer en haut
- **Zoom / pan** avec la molette et le clic-droit-glisser, comme sur le plan 2D
- Chaque vignette a son titre : « Coupe Nord », « Coupe Sud », etc.

### 3. Exports
- **Bouton « Télécharger les coupes »** → PNG haute résolution avec les 4 vues sur une planche
- **Bouton « Dossier complet »** → **PDF architectural** multi-pages :
  1. Page de garde (nom du projet, date, surface totale)
  2. Plan 2D coté
  3. Vue 3D (snapshot)
  4. Les 4 coupes (une par page ou 2×2)
  5. **Tableau des surfaces** : liste des pièces avec m² (Séjour, Chambre, SdB, Cuisine…) + surface habitable totale
- Format A3 paysage, cartouche en bas de page style plan français

### 4. Hauteurs — clarification
Je propose de garder **une seule saisie principale** :
- **Hauteur sous plafond (HSP)** = 250 cm par défaut → c'est la mesure « utile », celle qu'on vit et qu'un architecte utilise partout
- Deux réglages avancés cachés par défaut :
  - **Épaisseur dalle** (par défaut 20 cm)
  - **Épaisseur plafond/toit** (par défaut 0-15 cm)
- La **hauteur hors-tout** (extérieure) est calculée automatiquement = HSP + dalle + plafond
- Toutes les cotes des coupes sont affichées en cohérence

> Note : « hauteur extérieure » toute seule est ambiguë (avec ou sans toit ?). La HSP est le standard universel des plans FR — on garde ça comme entrée, et on affiche le hors-tout comme info dérivée.

### 5. Détection des pièces pour le tableau des surfaces
- Détection auto des polygones fermés formés par les murs
- Chaque pièce reçoit un label éditable (Séjour, Ch. 1, SdB…)
- Calcul de la surface au sol en m² (arrondi à 0,1 m²)
- Somme = surface habitable (SHAB)

## Fichiers touchés

- `src/lib/editor/sections.ts` — 4 coupes auto au lieu de 2
- `src/components/editor/CanvasSection.tsx` — grille 2×2, zoom/pan, export PNG
- `src/components/editor/LeftPanel.tsx` — retirer l'outil section
- `src/components/editor/TopBar.tsx` — boutons export coupes + dossier PDF
- `src/lib/editor/rooms.ts` (nouveau) — détection de pièces + surfaces
- `src/lib/editor/pdf-export.ts` (nouveau) — génération du PDF (jsPDF)
- `src/lib/editor/store.ts` — HSP + dalle + plafond, retirer sectionDisplay superflus
- `src/components/editor/RightPanel.tsx` — nouveau bloc « Hauteurs » simplifié

## Question rapide (une seule)

Pour le PDF, tu préfères :
- **A** : format A3 paysage, une page par vue (2D, 3D, 4 coupes → 6-7 pages)
- **B** : format A3 paysage compact, tout tient en 2-3 pages (plan + coupes en 2×2 sur la même page)

Dis-moi A ou B et je lance tout d'un coup.
