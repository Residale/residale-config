import type { OpeningKind, OpeningType } from "./types";

/** Source unique de vérité pour les dimensions par sous-type d'ouverture (cm). */
export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sillHeight: number }> = {
  door_simple: { width: 83, height: 210, sillHeight: 0 },
  door_double: { width: 140, height: 210, sillHeight: 0 },
  door_slide: { width: 80, height: 210, sillHeight: 0 },
  door_pocket: { width: 80, height: 210, sillHeight: 0 },
  entrance: { width: 90, height: 215, sillHeight: 0 },
  window_1: { width: 80, height: 115, sillHeight: 100 },
  window_2: { width: 120, height: 115, sillHeight: 100 },
  window_oscillo: { width: 100, height: 115, sillHeight: 100 },
  bay: { width: 240, height: 215, sillHeight: 0 },
  bay_slide: { width: 240, height: 215, sillHeight: 0 },
  fixed: { width: 100, height: 100, sillHeight: 100 },
};

export function defaultKind(type: OpeningType): OpeningKind {
  return type === "door" ? "door_simple" : "window_1";
}

export function openingHeight(o: { kind?: OpeningKind; type: OpeningType; height?: number }): number {
  if (o.height != null) return o.height;
  const k = o.kind ?? defaultKind(o.type);
  return OPENING_DEFAULTS[k].height;
}

export function openingSill(o: { kind?: OpeningKind; type: OpeningType; sillHeight?: number }): number {
  if (o.sillHeight != null) return o.sillHeight;
  const k = o.kind ?? defaultKind(o.type);
  return OPENING_DEFAULTS[k].sillHeight;
}
