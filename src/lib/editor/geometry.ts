import type { Point, Wall } from "./types";

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const snap = (v: number, step: number) => Math.round(v / step) * step;

export const snapPoint = (p: Point, step: number): Point => ({
  x: snap(p.x, step),
  y: snap(p.y, step),
});

export function snapAngle(from: Point, to: Point, stepDeg = 15): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return to;
  const ang = Math.atan2(dy, dx);
  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(ang / step) * step;
  return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
}

export function pointOnWall(p: Point, w: Wall): { t: number; dist: number; closest: Point } {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const closest = { x: w.a.x + dx * t, y: w.a.y + dy * t };
  return { t, dist: dist(p, closest), closest };
}

export function wallAngle(w: Wall) {
  return Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
}

export function wallLength(w: Wall) {
  return dist(w.a, w.b);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
