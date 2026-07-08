
# Refonte Residale — Plan v2 (avec vitesse de conception & manipulation fine)

Ajouts v2 par rapport à v1 :
- Bloc dédié **Vitesse de conception** (créer un plan en < 5 min).
- Bloc dédié **Manipulation fine des ouvertures** (sens d'ouverture, pivot, type).
- Prix Residale = **placeholders éditables** dans l'admin (Cloud).
- Nano Banana validé.

---

## 1. Architecture d'ensemble (inchangé)

```text
┌─────────────────────────────────────────────────────────────┐
│  /studio (interne)  │  /configurator (client)  │  /share/:token │
└─────────────────────────────────────────────────────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
   Lovable Cloud : models · configs · shares · uploads · quotes · prices (admin-editable)
```

---

## 2. NOUVEAU — Vitesse de conception (priorité #1)

Objectif : **plan brut en < 5 min, plan fini avec ouvertures et mobilier en < 15 min.**

### 2.1 Démarrage express
- **3 façons de démarrer** proposées dès l'ouverture :
  1. **Depuis un modèle Residale** (dupliquer un modèle catalogue, on n'a plus qu'à modifier).
  2. **Depuis une forme** : cliquer sur une forme (L, T, U, rectangle, plain-pied, R+1) → dimensions demandées → murs générés d'un coup.
  3. **Page blanche**.
- Le mode "depuis une forme" est le défaut : 90 % des maisons Residale rentrent dedans.

### 2.2 Outil "Pièce" ultra rapide
- Clic-glisser : trace un rectangle → devient une pièce fermée, 4 murs, type interior, label auto ("Salon", "Chambre 1"...).
- Édition inline du label et des dimensions (input cm/m au clic sur la cote).
- Duplication d'une pièce : Ctrl+D → copie collée alignée sur la grille.

### 2.3 Outil "Mur" tracé continu
- Clic-clic-clic : chaîne de murs, Entrée ou Échap pour finir.
- Longueur affichée en direct pendant le tracé.
- Angle contraint 15° (libre avec Alt).
- Snap sur murs existants + extrémités.
- Fermeture auto quand on revient sur le point de départ (aimant 15 cm).

### 2.4 Raccourcis clavier (documentés dans une palette `?`)
- `V` sélection · `W` mur · `R` pièce · `D` porte · `F` fenêtre · `C` cloison · `M` mobilier
- `Ctrl+D` dupliquer · `Ctrl+Z/Y` undo/redo · `Suppr` supprimer
- `[` / `]` rotation −15° / +15° · `Shift+[/]` −1° / +1°
- `Espace` (maintenu) pan · molette zoom · `F` centrer sur sélection · `H` fit-to-screen
- `1` vue 2D · `2` vue 3D · `3` coupe · `4` photomontage
- `Tab` bascule sens d'ouverture (voir §3)

### 2.5 Palette de commandes
- `Ctrl+K` : recherche floue → toutes les actions et tous les objets du catalogue accessibles au clavier ("porte 90", "chambre 12 m²", "bardage terre boréale").

### 2.6 Auto-retour à Sélection
- Déjà en place, à généraliser : après **chaque** création d'objet, retour auto sur l'outil Sélection avec l'objet sélectionné et son panneau contextuel ouvert. Zéro clic perdu.

### 2.7 Templates de pièces
- Bibliothèque de "pièces types" : salle de bain 4 m², cuisine linéaire 3 m, chambre parentale 12 m² avec dressing, WC 1,5 m²… → drag-drop dans le plan avec mobilier pré-placé.

---

## 3. NOUVEAU — Manipulation fine des ouvertures

Chaque porte/fenêtre a **4 attributs manipulables au clic direct**, pas dans un menu :

### 3.1 Attributs
- `type` : porte simple, porte double, porte coulissante, porte à galandage, fenêtre 1 vantail, fenêtre 2 vantaux, fenêtre oscillo-battante, baie coulissante, baie vitrée, châssis fixe, porte-fenêtre, porte d'entrée.
- `hingeSide` : gauche | droite (charnière).
- `swingDirection` : intérieur | extérieur (sens d'ouverture).
- `width`, `height`, `sillHeight` : cotes.

### 3.2 Interactions au clic direct sur l'ouverture
Quand une ouverture est sélectionnée, apparaissent **4 poignées circulaires** autour d'elle :
- ⤺ **poignée charnière** (haut) : clic = bascule G/D (l'arc de battement pivote).
- ⇄ **poignée sens** (bas) : clic = bascule intérieur/extérieur (l'arc bascule de l'autre côté du mur).
- ↔ **poignée largeur** (gauche/droite) : drag horizontal = change la largeur, valeur affichée en cm.
- ⟲ **poignée rotation** : uniquement si l'ouverture est détachée du mur (édition libre).

**Raccourcis** (quand sélectionnée) :
- `Tab` = cycle des 4 combinaisons (G-int → D-int → G-ext → D-ext).
- Flèches ← → = déplace l'ouverture le long du mur (5 cm par flèche, 1 cm avec Shift).
- `Delete` = supprime.
- Double-clic = ouvre le sélecteur de **type** (radio buttons visuels : arc porte, baie, oscillo…).

### 3.3 Rendu 2D
- Chaque type a un symbole normalisé NF :
  - Porte battante : arc 90° depuis la charnière + trait du vantail dans le sens de battement.
  - Porte double : deux arcs symétriques.
  - Porte coulissante : rectangle rayé + flèche double-sens.
  - Porte à galandage : rectangle en pointillés dans le mur.
  - Fenêtre 1 vantail : trait + arc léger (croix pour oscillo-battant).
  - Fenêtre 2 vantaux : deux arcs symétriques.
  - Baie coulissante : deux vantaux superposés avec flèches.
  - Châssis fixe : trait simple sans arc.
- L'arc de battement est **rendu vivant** — pendant le drag de la poignée charnière, il pivote en direct.

### 3.4 Rendu 3D
- Porte battante : vantail 3D positionné, ouvert à 30° par défaut pour visualiser le sens.
- Porte coulissante : vantail visible glissé sur le côté.
- Fenêtre : dormant + ouvrant + vitrage translucide, oscillo-battante entrouverte.

### 3.5 Rendu en coupe
- Le sens d'ouverture influe sur la coupe : le vantail est représenté du bon côté.

### 3.6 Catalogue de tailles standard françaises
- Portes : 63, 73, 83, 93 cm (largeur passage) — hauteur 204 cm standard.
- Fenêtres : 60×75, 80×100, 100×100, 100×125, 120×100, 120×125, 140×125 cm.
- Baies : 180×215, 210×215, 240×215, 300×215 cm.
- Porte d'entrée : 90×215.
- Sélection en un clic dans le sélecteur de type (avec preview).

---

## 4. Manipulation fine du mobilier (extension v2)

Même logique que les ouvertures — clic direct + poignées.

### 4.1 Poignées universelles
- 4 poignées d'angle : resize proportionnel (avec Shift).
- 4 poignées de milieu : resize sur un axe.
- 1 poignée rotation (au-dessus).
- 1 poignée déplacement (centre).
- Cotes live pendant le drag.

### 4.2 Seuils sémantiques
- Lit : 90 (1 pers), 140 (2 pers std), 160 (Queen FR), 180 (Queen US), 200 (King) — l'icône et le label changent.
- Canapé : 2/3/4/5 places selon largeur.
- Table à manger : couverts déduits (60 cm/personne).
- Meuble cuisine bas : 40/50/60/80/100/120 cm → 1 porte / 2 portes / tiroir auto.
- Meuble cuisine haut : idem, aligné en Z sur 90 cm (plan de travail) + 55 cm (crédence).

### 4.3 Rotation
- `R` maintenu + drag = rotation libre.
- Clic droit → "Pivoter 90°" / "Miroir H" / "Miroir V".
- Snap 15° par défaut (libre avec Alt).

### 4.4 Alignement
- Sélection multiple (Shift+clic ou lasso) → alignements (gauche/centre/droite/haut/milieu/bas) + distribution.

---

## 5. Configurateur client (§3 v1, inchangé sauf prix)

- Prix = table `pricing` dans Cloud, éditable via `/studio/admin/pricing` (interface admin).
- Colonnes : clé (`option.terrasse`, `bardage.terre_boreale`, `personnalisation.ajustement.min`…), valeur €, TVA, description.
- Placeholders au départ (150 €, 600 €, "sur devis" pour les paliers ; +X€ raisonnables pour ambiances/options — modifiables sans redéploiement).

---

## 6. Éditeur pro — toiture (§4.3 v1, inchangé)

Types plate / 1 pan / 2 pans / 4 pans / mansart, angle 5–45°, débord, couverture, coloris. Prise en compte auto en coupe.

## 7. Bardage par façade (§4.4 v1, inchangé)

Matériau + coloris + zoning anthracite % par façade, mapping UV 3D correct.

## 8. Coupes NF (§4.5 v1, inchangé — reste le morceau le plus lourd)

Auto-4-coupes A/B/C/D, cartouche, TN/TF, dalle, murs pochés, ouvertures cotées avec sens, toiture coupée avec angle, niveaux ±0.00 → faîtage, cotes verticales cumulées, cotes horizontales, étiquettes pièces, thème NF/aquarelle/blueprint/épuré, échelle 1/50-1/100-1/200, export vectoriel.

## 9. Partage `/share/:token` (§5 v1, inchangé)

Vue publique read-only, tabs 2D/3D/coupes/photomontage, visite 3D walk, PDF, analytics.

## 10. Photomontage IA terrain (§3.2 v1 point 7, inchangé)

Nano Banana `google/gemini-3.1-flash-image` par défaut, fallback pro-image. 3-4 variantes.

## 11. Export PDF (§6 v1, inchangé)

Mode commercial (magazine) et mode technique (plans + coupes + tableaux menuiseries).

## 12. Backend Cloud (§7 v1, + table pricing)

Tables : `models`, `configurations`, `terrain_uploads`, `quotes`, `pricing`, `user_roles`. RLS + `has_role`.

---

## 13. Découpage en lots (v2 réordonné)

Priorité vitesse d'usage d'abord, wow client ensuite.

1. **Lot 1 — Vitesse & manipulation** : outil pièce rectangle, tracé continu, raccourcis clavier, palette Ctrl+K, auto-return sélection, templates pièces, poignées ouvertures (sens G/D + int/ext + Tab), catalogue tailles NF, poignées mobilier avec seuils sémantiques, sélection multiple + alignement.
2. **Lot 2 — Toiture** : type/pente/couverture, rendu 3D + coupe.
3. **Lot 3 — Coupes NF complètes** : auto 4 coupes, cartouche, TN, niveaux, cotes cumulées, thèmes, échelles, export vectoriel.
4. **Lot 4 — Bardage & façades** : zoning anthracite + textures Residale + mapping 3D.
5. **Lot 5 — Cloud + bibliothèque modèles + admin pricing** : schéma, CRUD modèles, table pricing éditable.
6. **Lot 6 — Configurateur client** : écran modèles, options avec prix live (depuis pricing), paliers personnalisation, récap devis.
7. **Lot 7 — Partage** : token, page publique, mode visite 3D.
8. **Lot 8 — Photomontage IA terrain** : upload, Nano Banana streaming, galerie.
9. **Lot 9 — Export PDF** : commercial + technique.
10. **Lot 10 — Polish** : mobile/tablette, i18n, perf 3D (LOD, instancing), tests visuels.

Chaque lot est livré fonctionnel de bout en bout.

---

## 14. Ce qu'il te reste à valider

- Ordre des lots : **lot 1 (vitesse + manipulation) d'abord**, puis lot 3 (coupes NF) ? C'est mon défaut recommandé.
- Activation **Lovable Cloud** : dès le lot 5, ou tout de suite pour tout câbler d'un coup ? (Je peux commencer sans Cloud pour les lots 1–4, ça reste 100 % frontend.)
- Prix placeholders : je pars sur des valeurs plausibles (ambiance +2 000 €, terrasse 250 €/m², paliers 150/600/sur devis) — tu ajusteras dans l'admin quand la table sera là. OK ?
- Autre chose à ajouter avant que je passe en build ? (Ex : symbolique escalier, VMC, radiateurs, prises électriques, plan électrique séparé — je peux les intégrer maintenant si c'est utile.)

Dis-moi et on passe en build sur le lot 1.
