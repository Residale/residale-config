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
  depthFromLine: number;
};

export type ElevationWall = {
  start: number;
  end: number;
  height: number;
  depth: number; // signed perp distance for depth ordering
  wall: Wall;
};


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
  const wdx = wall.b.x - wall.a.x;
  const wdy = wall.b.y - wall.a.y;
  const wlen = Math.hypot(wdx, wdy) || 1;
  const wux = wdx / wlen;
  const wuy = wdy / wlen;
  const wnx = -wuy;
  const wny = wux;
  const half = wall.thickness / 2;
  const box: Point[] = [
    { x: wall.a.x + wnx * half, y: wall.a.y + wny * half },
    { x: wall.b.x + wnx * half, y: wall.b.y + wny * half },
    { x: wall.b.x - wnx * half, y: wall.b.y - wny * half },
    { x: wall.a.x - wnx * half, y: wall.a.y - wny * half },
  ];
  const secDx = sec.b.x - sec.a.x;
  const secDy = sec.b.y - sec.a.y;
  const secLen = Math.hypot(secDx, secDy) || 1;

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

  const secLenSafe = secLen || 1;
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
      const midX = sec.a.x + (sec.b.x - sec.a.x) * (midS / secLenSafe);
      const midY = sec.a.y + (sec.b.y - sec.a.y) * (midS / secLenSafe);
      const distAlongWall = Math.hypot(midX - w.a.x, midY - w.a.y);
      const opStart = wLen * o.t - o.width / 2;
      const opEnd = wLen * o.t + o.width / 2;
      if (distAlongWall >= opStart && distAlongWall <= opEnd) {
        const sill = openingSill(o);
        const h = openingHeight(o);
        cuts.push({
          type: o.type,
          start: inter.s0,
          end: inter.s1,
          height: h + sill,
          sillHeight: sill,
          wall: w,
          opening: o,
        });
      }
    }
  }

  // Elevation: all non-cut walls whose projection overlaps the section span.
  // We draw the wall silhouette as background, then openings on top as facade views.
  const elevationWalls: ElevationWall[] = [];
  for (const w of plan.walls) {
    if (cutWallIds.has(w.id)) continue;
    const prA = project(w.a, sec.a, sec.b);
    const prB = project(w.b, sec.a, sec.b);
    const s0 = Math.min(prA.along, prB.along);
    const s1 = Math.max(prA.along, prB.along);
    // Skip walls entirely off-screen
    if (s1 < -50 || s0 > secLen + 50) continue;
    // Only include walls somewhat aligned with the cut (visible facade)
    const wdx = w.b.x - w.a.x, wdy = w.b.y - w.a.y;
    const wlen = Math.hypot(wdx, wdy) || 1;
    const sdx = sec.b.x - sec.a.x, sdy = sec.b.y - sec.a.y;
    const slen = Math.hypot(sdx, sdy) || 1;
    const dot = Math.abs((wdx / wlen) * (sdx / slen) + (wdy / wlen) * (sdy / slen));
    if (dot < 0.2) continue;
    const depth = (prA.perp + prB.perp) / 2;
    elevationWalls.push({
      start: s0,
      end: s1,
      height: w.height ?? ceilingH,
      depth,
      wall: w,
    });
    for (const o of plan.openings.filter((oo) => oo.wallId === w.id)) {
      const cx = w.a.x + wdx * o.t;
      const cy = w.a.y + wdy * o.t;
      const pr = project({ x: cx, y: cy }, sec.a, sec.b);
      if (pr.along < -o.width || pr.along > secLen + o.width) continue;
      const sill = openingSill(o);
      const h = openingHeight(o);
      cuts.push({
        type: o.type,
        start: pr.along - o.width / 2,
        end: pr.along + o.width / 2,
        height: h + sill,
        sillHeight: sill,
        wall: w,
        opening: o,
      });
    }
  }
  // Sort elevation walls back-to-front (further first, so nearer overlay them)
  elevationWalls.sort((a, b) => Math.abs(b.depth) - Math.abs(a.depth));

  const furn: ElevationFurniture[] = [];
  return { length: secLen, ceilingH, cuts, elevationWalls, furn };
}




export function furnitureDefaultHeight(kind: string): number {
  const map: Record<string, number> = {
    bed: 55, bed_single: 55, nightstand: 55, wardrobe: 220, dresser: 90,
    sofa: 85, sofa_l: 85, armchair: 90, chair: 90,
    table: 45, coffee_table: 40, dining: 75, desk: 75,
    bookshelf: 200, tv_console: 50, tv: 75,
    toilet: 80, bidet: 40, sink: 90, vanity: 85, bath: 55, shower: 210,
    radiator: 60, towel_rack: 120, washer: 85,
    fridge: 180, stove: 90, oven: 90, microwave: 30, hood: 60, dishwasher: 90,
    kitchen_island: 90, kitchen_base: 90, kitchen_upper: 70,
    plant: 100, rug: 1,
    staircase: 250, fireplace: 220, wood_stove: 110,
    bbq: 100, garden_table: 75, garden_chair: 85, parasol: 240, pool: 20,
  };
  return map[kind] ?? 60;
}
