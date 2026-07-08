import type { Wall, Point, Plan } from "./types";
import { dist } from "./geometry";

const EPS = 1.5; // cm tolerance for shared endpoints

export function wallsSharingPoint(walls: Wall[], p: Point) {
  return walls.filter((w) => dist(w.a, p) < EPS || dist(w.b, p) < EPS);
}

/** Returns the outline polygon (4 points) of a wall extruded by thickness. */
export function wallPolygon(w: Wall): Point[] {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w.thickness / 2);
  const ny = (dx / len) * (w.thickness / 2);
  return [
    { x: w.a.x + nx, y: w.a.y + ny },
    { x: w.b.x + nx, y: w.b.y + ny },
    { x: w.b.x - nx, y: w.b.y - ny },
    { x: w.a.x - nx, y: w.a.y - ny },
  ];
}

/** Collect unique endpoints with max adjacent wall thickness (for corner disks). */
export function collectJunctions(plan: Plan): { p: Point; radius: number }[] {
  const pts: { p: Point; radius: number }[] = [];
  const push = (p: Point, thickness: number) => {
    for (const j of pts) {
      if (dist(j.p, p) < EPS) {
        j.radius = Math.max(j.radius, thickness / 2);
        return;
      }
    }
    pts.push({ p: { ...p }, radius: thickness / 2 });
  };
  for (const w of plan.walls) {
    push(w.a, w.thickness);
    push(w.b, w.thickness);
  }
  return pts;
}

/** Extend endpoint slightly along the wall direction to close corners. */
export function wallExtended(w: Wall, extend: number) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return {
    a: { x: w.a.x - ux * extend, y: w.a.y - uy * extend },
    b: { x: w.b.x + ux * extend, y: w.b.y + uy * extend },
  };
}
