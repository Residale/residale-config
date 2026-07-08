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
export type Opening = {
  id: string;
  wallId: string;
  t: number; // 0..1 along the wall
  width: number; // cm
  type: OpeningType;
  height?: number; // cm — default door 210, window 120
  sillHeight?: number; // cm — default door 0, window 100
};

export type FurnitureKind =
  | "bed"
  | "sofa"
  | "chair"
  | "table"
  | "dining"
  | "desk"
  | "toilet"
  | "sink"
  | "bath"
  | "fridge"
  | "stove"
  | "plant"
  | "rug";

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

export type Plan = {
  walls: Wall[];
  openings: Opening[];
  furniture: Furniture[];
  labels: RoomLabel[];
  sections: SectionLine[];
  ceilingHeight?: number; // cm, default 250
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

export type Selection =
  | { type: "wall" | "opening" | "furniture" | "label" | "section"; id: string }
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
