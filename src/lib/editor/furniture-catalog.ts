import type { FurnitureKind } from "./types";

export type CatalogItem = {
  kind: FurnitureKind;
  label: string;
  category: "Salon" | "Chambre" | "Cuisine" | "Salle de bain" | "Bureau" | "Extérieur";
  width: number; // cm
  height: number; // cm (depth in plan view)
  color: string;
};

export const CATALOG: CatalogItem[] = [
  { kind: "sofa", label: "Canapé", category: "Salon", width: 220, height: 90, color: "#b8a68a" },
  { kind: "chair", label: "Fauteuil", category: "Salon", width: 80, height: 80, color: "#c9b89a" },
  { kind: "table", label: "Table basse", category: "Salon", width: 120, height: 60, color: "#8b7355" },
  { kind: "rug", label: "Tapis", category: "Salon", width: 200, height: 300, color: "#e0d4bc" },
  { kind: "bed", label: "Lit double", category: "Chambre", width: 160, height: 200, color: "#d4c4a8" },
  { kind: "desk", label: "Bureau", category: "Bureau", width: 140, height: 70, color: "#8b7355" },
  { kind: "chair", label: "Chaise bureau", category: "Bureau", width: 55, height: 55, color: "#6b5842" },
  { kind: "dining", label: "Table à manger", category: "Cuisine", width: 180, height: 90, color: "#8b7355" },
  { kind: "fridge", label: "Frigo", category: "Cuisine", width: 70, height: 65, color: "#d0d0d0" },
  { kind: "stove", label: "Cuisinière", category: "Cuisine", width: 60, height: 60, color: "#a8a8a8" },
  { kind: "sink", label: "Évier", category: "Cuisine", width: 80, height: 50, color: "#c8c8c8" },
  { kind: "toilet", label: "WC", category: "Salle de bain", width: 40, height: 65, color: "#e8e8e8" },
  { kind: "bath", label: "Baignoire", category: "Salle de bain", width: 170, height: 75, color: "#d8e4ea" },
  { kind: "plant", label: "Plante", category: "Extérieur", width: 50, height: 50, color: "#7a9270" },
];
