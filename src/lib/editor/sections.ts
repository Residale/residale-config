import type { Furniture, Opening, Plan, Point, SectionLine, Wall } from "./types";
import { openingHeight, openingSill } from "./opening-defaults";

/**
 * Auto-generate 4 section lines passing through the geometric center of the plan.
 * Each section is a horizontal or vertical line across the entire bbox with padding.
 * Names encode the viewing direction: N = looking north (from south), etc.
 */
export function autoSectionsFromPlan(plan: Plan): SectionLine[] {
  if (plan.walls.length === 0) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    minX = Math.min(minX, w.a.x, w.b.x);
    minY = Math.min(minY, w.a.y, w.b.y);
    maxX = Math.max(maxX, w.a.x, w.b.x);
    maxY = Math.max(maxY, w.a.y, w.b.y);
  }
  const pad = 80;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // 2 horizontal cuts (looking N and S) at y = cy, 2 vertical cuts (looking E and O) at x = cx.
  // We build them slightly offset so both directions can be rendered from the same axis.
  return [
    { id: "__auto_N", name: "N", a: { x: minX - pad, y: cy }, b: { x: maxX + pad, y: cy } },
    { id: "__auto_S", name: "S", a: { x: maxX + pad, y: cy }, b: { x: minX - pad, y: cy } },
    { id: "__auto_O", name: "O", a: { x: cx, y: maxY + pad }, b: { x: cx, y: minY - pad } },
    { id: "__auto_E", name: "E", a: { x: cx, y: minY - pad }, b: { x: cx, y: maxY + pad } },
  ];
}




export type CutSegment = {
  type: "wall" | "door" | "window";
  start: number; // distance along section line, cm
  end: number;
  height: number; // top height
  sillHeight: number; // bottom
  wall: Wall;
  opening?: Opening;
};

export type ElevationFurniture = {
  furniture: Furniture;
  start: number;
  end: number;
  height: number;
  depthFromLine: number; // signed distance for depth ordering (behind cut)
};

const DOOR_H = 210;
const WIN_H = 120;
const WIN_SILL = 100;

/** Project point onto section line, return signed distance from A along AB, and perpendicular distance. */
function project(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const rx = p.x - a.x;
  const ry = p.y - a.y;
  const along = rx * ux + ry * uy;
  const perp = -rx * uy + ry * ux;
  return { along, perp, len, ux, uy };
}

/** Intersect segment AB with wall polygon (thick line) — returns t range along AB inside wall. */
function segIntersectWall(sec: SectionLine, wall: Wall): { s0: number; s1: number } | null {
  // wall is an infinite? no — segment. Approach: check line-line intersection between sec and wall centerline extended by thickness in normal direction; treat wall as an oriented box.
  const wdx = wall.b.x - wall.a.x;
  const wdy = wall.b.y - wall.a.y;
  const wlen = Math.hypot(wdx, wdy) || 1;
  const wux = wdx / wlen;
  const wuy = wdy / wlen;
  const wnx = -wuy;
  const wny = wux;
  const half = wall.thickness / 2;
  // Corners of the wall box
  const box: Point[] = [
    { x: wall.a.x + wnx * half, y: wall.a.y + wny * half },
    { x: wall.b.x + wnx * half, y: wall.b.y + wny * half },
    { x: wall.b.x - wnx * half, y: wall.b.y - wny * half },
    { x: wall.a.x - wnx * half, y: wall.a.y - wny * half },
  ];
  const secDx = sec.b.x - sec.a.x;
  const secDy = sec.b.y - sec.a.y;
  const secLen = Math.hypot(secDx, secDy) || 1;
  const sux = secDx / secLen;
  const suy = secDy / secLen;

  // Find intersections of section line with each of the 4 box edges
  const ts: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p1 = box[i];
    const p2 = box[(i + 1) % 4];
    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;
    const denom = secDx * (-ey) - secDy * (-ex);
    if (Math.abs(denom) < 1e-6) continue;
    const s = ((p1.x - sec.a.x) * (-ey) - (p1.y - sec.a.y) * (-ex)) / denom;
    const u = ((p1.x - sec.a.x) * (-secDy) - (p1.y - sec.a.y) * (-secDx)) /
      (-secDx * ey + secDy * ex);
    if (s >= 0 && s <= 1 && u >= 0 && u <= 1) {
      ts.push(s);
    }
  }
  if (ts.length < 2) return null;
  ts.sort((a, b) => a - b);
  return { s0: ts[0] * secLen, s1: ts[ts.length - 1] * secLen };
}

export function computeSection(plan: Plan, sec: SectionLine) {
  const secLen = Math.hypot(sec.b.x - sec.a.x, sec.b.y - sec.a.y);
  const ceilingH = plan.ceilingHeight ?? 250;
  const cuts: CutSegment[] = [];
  const cutWallIds = new Set<string>();

  for (const w of plan.walls) {
    const inter = segIntersectWall(sec, w);
    if (!inter) continue;
    cutWallIds.add(w.id);
    cuts.push({
      type: "wall",
      start: inter.s0,
      end: inter.s1,
      height: w.height ?? ceilingH,
      sillHeight: 0,
      wall: w,
    });
    const wLen = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    for (const o of plan.openings.filter((oo) => oo.wallId === w.id)) {
      const midS = (inter.s0 + inter.s1) / 2;
      const midX = sec.a.x + (sec.b.x - sec.a.x) * (midS / secLen);
      const midY = sec.a.y + (sec.b.y - sec.a.y) * (midS / secLen);
      const distAlongWall = Math.hypot(midX - w.a.x, midY - w.a.y);
      const opStart = wLen * o.t - o.width / 2;
      const opEnd = wLen * o.t + o.width / 2;
      if (distAlongWall >= opStart && distAlongWall <= opEnd) {
        const isDoor = o.type === "door";
        cuts.push({
          type: o.type,
          start: inter.s0,
          end: inter.s1,
          height: (o.height ?? (isDoor ? DOOR_H : WIN_H)) + (o.sillHeight ?? (isDoor ? 0 : WIN_SILL)),
          sillHeight: o.sillHeight ?? (isDoor ? 0 : WIN_SILL),
          wall: w,
          opening: o,
        });
      }
    }
  }

  // Elevation openings: on walls roughly parallel to the section line (not cut),
  // project each opening onto the section and draw it as elevation.
  for (const w of plan.walls) {
    if (cutWallIds.has(w.id)) continue;
    const openingsOnWall = plan.openings.filter((oo) => oo.wallId === w.id);
    if (openingsOnWall.length === 0) continue;
    const wdx = w.b.x - w.a.x, wdy = w.b.y - w.a.y;
    const wlen = Math.hypot(wdx, wdy) || 1;
    const wux = wdx / wlen, wuy = wdy / wlen;
    const sdx = sec.b.x - sec.a.x, sdy = sec.b.y - sec.a.y;
    const slen = Math.hypot(sdx, sdy) || 1;
    const sux = sdx / slen, suy = sdy / slen;
    const dot = Math.abs(wux * sux + wuy * suy);
    if (dot < 0.85) continue;
    for (const o of openingsOnWall) {
      const cx = w.a.x + wdx * o.t;
      const cy = w.a.y + wdy * o.t;
      const pr = project({ x: cx, y: cy }, sec.a, sec.b);
      if (pr.along < -o.width || pr.along > secLen + o.width) continue;
      const isDoor = o.type === "door";
      cuts.push({
        type: o.type,
        start: pr.along - o.width / 2,
        end: pr.along + o.width / 2,
        height: (o.height ?? (isDoor ? DOOR_H : WIN_H)) + (o.sillHeight ?? (isDoor ? 0 : WIN_SILL)),
        sillHeight: o.sillHeight ?? (isDoor ? 0 : WIN_SILL),
        wall: w,
        opening: o,
      });
    }
  }

  const furn: ElevationFurniture[] = [];
  return { length: secLen, ceilingH, cuts, furn };
}


export function furnitureDefaultHeight(kind: string): number {
  const map: Record<string, number> = {
    bed: 55, sofa: 85, chair: 90, table: 45, dining: 75, desk: 75,
    toilet: 40, sink: 85, bath: 55, fridge: 180, stove: 90, plant: 100, rug: 1,
  };
  return map[kind] ?? 60;
}
