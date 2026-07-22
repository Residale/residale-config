import type { OpeningKind, OpeningType, WallType } from "./types";

export type OpeningPreset = {
  id: string;
  type: OpeningType;
  kind: OpeningKind;
  label: string;
  width: number;
  height: number;
  sillHeight: number;
  group: "Portes" | "Fenêtres" | "Accès terrasse";
};

export type WallPreset = {
  id: string;
  label: string;
  wallType: WallType;
  thickness: number;
  height: number;
  description: string;
};

export const WALL_PRESETS: WallPreset[] = [
  {
    id: "ext-re2020-30",
    label: "Extérieur RE2020",
    wallType: "exterior",
    thickness: 30,
    height: 270,
    description: "Mur extérieur isolé courant",
  },
  {
    id: "ext-ossature-22",
    label: "Ossature bois",
    wallType: "exterior",
    thickness: 22,
    height: 270,
    description: "Façade légère / module habitat",
  },
  {
    id: "int-porteur-20",
    label: "Porteur intérieur",
    wallType: "interior",
    thickness: 20,
    height: 250,
    description: "Refend ou mur porteur",
  },
  {
    id: "int-cloison-10",
    label: "Cloison 10",
    wallType: "interior",
    thickness: 10,
    height: 250,
    description: "Cloison standard",
  },
  {
    id: "int-cloison-7",
    label: "Cloison 7",
    wallType: "interior",
    thickness: 7,
    height: 250,
    description: "Cloison légère",
  },
];

export const OPENING_PRESETS: OpeningPreset[] = [
  {
    id: "door-interior-73",
    type: "door",
    kind: "door_simple",
    label: "Porte intérieure 73",
    width: 73,
    height: 204,
    sillHeight: 0,
    group: "Portes",
  },
  {
    id: "door-interior-83",
    type: "door",
    kind: "door_simple",
    label: "Porte intérieure 83",
    width: 83,
    height: 204,
    sillHeight: 0,
    group: "Portes",
  },
  {
    id: "door-interior-93",
    type: "door",
    kind: "door_simple",
    label: "Porte intérieure PMR 93",
    width: 93,
    height: 215,
    sillHeight: 0,
    group: "Portes",
  },
  {
    id: "door-exterior-full",
    type: "door",
    kind: "entrance",
    label: "Porte extérieure pleine",
    width: 90,
    height: 215,
    sillHeight: 0,
    group: "Portes",
  },
  {
    id: "door-exterior-glass",
    type: "door",
    kind: "entrance",
    label: "Porte extérieure vitrée",
    width: 90,
    height: 215,
    sillHeight: 0,
    group: "Portes",
  },
  {
    id: "door-slide-pocket",
    type: "door",
    kind: "door_pocket",
    label: "Porte à galandage",
    width: 90,
    height: 210,
    sillHeight: 0,
    group: "Portes",
  },
  {
    id: "window-one-casement",
    type: "window",
    kind: "window_1",
    label: "Fenêtre 1 vantail",
    width: 80,
    height: 115,
    sillHeight: 100,
    group: "Fenêtres",
  },
  {
    id: "window-two-casement",
    type: "window",
    kind: "window_2",
    label: "Fenêtre 2 vantaux",
    width: 120,
    height: 125,
    sillHeight: 90,
    group: "Fenêtres",
  },
  {
    id: "window-oscillo",
    type: "window",
    kind: "window_oscillo",
    label: "Oscillo-battant",
    width: 100,
    height: 115,
    sillHeight: 100,
    group: "Fenêtres",
  },
  {
    id: "window-fixed",
    type: "window",
    kind: "fixed",
    label: "Châssis fixe",
    width: 100,
    height: 100,
    sillHeight: 100,
    group: "Fenêtres",
  },
  {
    id: "terrace-door-1",
    type: "window",
    kind: "bay",
    label: "Porte-fenêtre 1 vantail",
    width: 90,
    height: 215,
    sillHeight: 0,
    group: "Accès terrasse",
  },
  {
    id: "terrace-door-2",
    type: "window",
    kind: "bay",
    label: "Porte-fenêtre 2 vantaux",
    width: 180,
    height: 215,
    sillHeight: 0,
    group: "Accès terrasse",
  },
  {
    id: "large-bay-240",
    type: "window",
    kind: "bay_slide",
    label: "Baie coulissante 240",
    width: 240,
    height: 215,
    sillHeight: 0,
    group: "Accès terrasse",
  },
  {
    id: "large-bay-300",
    type: "window",
    kind: "bay_slide",
    label: "Grande baie 300",
    width: 300,
    height: 215,
    sillHeight: 0,
    group: "Accès terrasse",
  },
];
