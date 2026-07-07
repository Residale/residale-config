export type Point = { x: number; y: number };

export type Wall = {
  id: string;
  a: Point;
  b: Point;
  thickness: number; // cm
};

export type OpeningType = "door" | "window";
export type Opening = {
  id: string;
  wallId: string;
  t: number; // 0..1 along the wall
  width: number; // cm
  type: OpeningType;
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
  height: number; // cm
  rotation: number; // deg
  label?: string;
};

export type RoomLabel = {
  id: string;
  x: number;
  y: number;
  text: string;
};

export type Plan = {
  walls: Wall[];
  openings: Opening[];
  furniture: Furniture[];
  labels: RoomLabel[];
};

export type Tool =
  | "select"
  | "wall"
  | "rectangle"
  | "door"
  | "window"
  | "label"
  | "eraser";

export type Selection = { type: "wall" | "opening" | "furniture" | "label"; id: string } | null;
