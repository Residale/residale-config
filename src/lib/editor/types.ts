export type Point = { x: number; y: number };

export type WallType = "interior" | "exterior";
export type Wall = {
  id: string;
  a: Point;
  b: Point;
  thickness: number; // cm
  height?: number; // cm, default 250
  wallType?: WallType;
};

export type WallSettings = {
  interior: { thickness: number; height: number };
  exterior: { thickness: number; height: number };
};

export type OpeningType = "door" | "window";
export type OpeningKind =
  | "door_simple"
  | "door_double"
  | "door_slide"
  | "door_pocket"
  | "entrance"
  | "window_1"
  | "window_2"
  | "window_oscillo"
  | "bay"
  | "bay_slide"
  | "fixed";
export type HingeSide = "a" | "b"; // which wall endpoint the hinge is closest to
export type SwingSide = "p" | "n"; // which side of the wall the leaf swings toward (positive/negative normal)
export type Opening = {
  id: string;
  wallId: string;
  t: number; // 0..1 along the wall
  width: number; // cm
  type: OpeningType;
  kind?: OpeningKind;
  hingeSide?: HingeSide;
  swingSide?: SwingSide;
  height?: number; // cm — default door 210, window 120
  sillHeight?: number; // cm — default door 0, window 100
  openAngle?: number; // degrees, 0-120, default 90 — arc/leaf opening angle
};

export type FurnitureKind =
  | "bed"
  | "bed_single"
  | "nightstand"
  | "wardrobe"
  | "dresser"
  | "sofa"
  | "sofa_l"
  | "armchair"
  | "chair"
  | "table"
  | "dining"
  | "desk"
  | "bookshelf"
  | "tv_console"
  | "tv"
  | "coffee_table"
  | "toilet"
  | "bidet"
  | "sink"
  | "vanity"
  | "bath"
  | "shower"
  | "radiator"
  | "towel_rack"
  | "washer"
  | "fridge"
  | "stove"
  | "oven"
  | "microwave"
  | "hood"
  | "dishwasher"
  | "kitchen_island"
  | "kitchen_base"
  | "kitchen_upper"
  | "plant"
  | "rug"
  | "staircase"
  | "fireplace"
  | "wood_stove"
  | "bbq"
  | "garden_table"
  | "garden_chair"
  | "parasol"
  | "pool";

export type Furniture = {
  id: string;
  kind: FurnitureKind;
  x: number; // cm
  y: number; // cm
  width: number; // cm
  height: number; // cm (depth in plan view)
  rotation: number; // deg
  label?: string;
  zHeight?: number; // cm (elevation height)
  locked?: boolean;
  anchorToWall?: boolean;
};

export type RoomLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type SectionLine = {
  id: string;
  name: string; // "A", "B", "C"...
  a: Point;
  b: Point;
};

export type RoofKind = "flat" | "mono" | "gable" | "hip";
export type Roof = {
  kind: RoofKind;
  pitch: number; // degrees (0-60). ignored for flat
  eaveHeight: number; // cm — height of the eave above ± 0.00 (top of wall)
  overhang: number; // cm — horizontal overhang past exterior face
  ridgeAxis?: "x" | "y"; // for gable, direction along which the ridge runs
};

export type Plan = {
  walls: Wall[];
  openings: Opening[];
  furniture: Furniture[];
  labels: RoomLabel[];
  sections: SectionLine[];
  ceilingHeight?: number; // cm, default 250
  roof?: Roof;
};

export type Tool =
  | "select"
  | "wall"
  | "rectangle"
  | "door"
  | "window"
  | "label"
  | "eraser"
  | "section";

export type SelectionItem = { type: "wall" | "opening" | "furniture" | "label" | "section"; id: string };

export type Selection =
  | SelectionItem
  | { type: "multi"; items: SelectionItem[] }
  | null;

export type SectionDisplay = {
  showVerticalDims: boolean;
  showHorizontalDims: boolean;
  showLevels: boolean;
  showFloorHatch: boolean;
  showFurniture: boolean;
  showOpeningLabels: boolean;
  showGround: boolean;
  showAxes: boolean;
};
