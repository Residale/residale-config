export type Theme2D = {
  id: string;
  name: string;
  background: string;
  floor: string; // room fill
  wallFill: string; // wall poché
  wallStroke: string; // wall outline
  wallHatch: "solid" | "poche" | "hatch45";
  dimension: string; // dimension text/lines
  grid: string;
  gridMajor: string;
  openingStroke: string;
  furnitureFill: string;
  furnitureStroke: string;
  lineWeight: number; // multiplier
};

export const THEME_PRESETS: Theme2D[] = [
  {
    id: "technique",
    name: "Technique NF",
    background: "#ffffff",
    floor: "#ffffff",
    wallFill: "#111111",
    wallStroke: "#000000",
    wallHatch: "solid",
    dimension: "#111111",
    grid: "#f0f0f0",
    gridMajor: "#e0e0e0",
    openingStroke: "#111111",
    furnitureFill: "#ffffff",
    furnitureStroke: "#333333",
    lineWeight: 1,
  },
  {
    id: "aquarelle",
    name: "Aquarelle",
    background: "#fafaf7",
    floor: "#c9dde4",
    wallFill: "#6b6a66",
    wallStroke: "#3d3c39",
    wallHatch: "solid",
    dimension: "#5a5751",
    grid: "#efece2",
    gridMajor: "#e0dccc",
    openingStroke: "#3d3c39",
    furnitureFill: "#ffffff",
    furnitureStroke: "#3d3c39",
    lineWeight: 1,
  },
  {
    id: "blueprint",
    name: "Blueprint",
    background: "#0f2a52",
    floor: "#153a72",
    wallFill: "#eaf2ff",
    wallStroke: "#ffffff",
    wallHatch: "solid",
    dimension: "#eaf2ff",
    grid: "#1a3a6e",
    gridMajor: "#255196",
    openingStroke: "#eaf2ff",
    furnitureFill: "transparent",
    furnitureStroke: "#eaf2ff",
    lineWeight: 1,
  },
  {
    id: "minimal",
    name: "Épuré",
    background: "#faf8f5",
    floor: "#f2ede4",
    wallFill: "#2d2d2d",
    wallStroke: "#1a1a1a",
    wallHatch: "solid",
    dimension: "#8b7355",
    grid: "#ede8dc",
    gridMajor: "#ded7c5",
    openingStroke: "#2d2d2d",
    furnitureFill: "#ffffff",
    furnitureStroke: "#6b5842",
    lineWeight: 0.85,
  },
];

export const DEFAULT_THEME = THEME_PRESETS[1];
