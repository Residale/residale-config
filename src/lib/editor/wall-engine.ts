import type { Plan, Point, Wall } from "./types.ts";
import { dist, snapPoint, uid } from "./geometry.ts";

const NODE_EPS = 8;
const MIN_WALL_LENGTH = 5;

export type WallSpec = {
  thickness: number;
  height?: number;
  wallType?: Wall["wallType"];
};

const roundPoint = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

function copyPlan(plan: Plan): Plan {
  return {
    ...plan,
    walls: plan.walls.map((w) => ({ ...w, a: { ...w.a }, b: { ...w.b } })),
    openings: plan.openings.map((o) => ({ ...o })),
    furniture: plan.furniture.map((f) => ({ ...f })),
    labels: plan.labels.map((l) => ({ ...l })),
    sections: plan.sections.map((s) => ({ ...s, a: { ...s.a }, b: { ...s.b } })),
  };
}

function axisKind(a: Point, b: Point): "horizontal" | "vertical" | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const deg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI) % 180;
  if (deg <= 12 || deg >= 168) return "horizontal";
  if (Math.abs(deg - 90) <= 12) return "vertical";
  return null;
}

function straightenWall(wall: Wall): Wall {
  const axis = axisKind(wall.a, wall.b);
  if (axis === "horizontal") {
    const y = Math.round((wall.a.y + wall.b.y) / 2);
    return { ...wall, a: { x: Math.round(wall.a.x), y }, b: { x: Math.round(wall.b.x), y } };
  }
  if (axis === "vertical") {
    const x = Math.round((wall.a.x + wall.b.x) / 2);
    return { ...wall, a: { x, y: Math.round(wall.a.y) }, b: { x, y: Math.round(wall.b.y) } };
  }
  return { ...wall, a: roundPoint(wall.a), b: roundPoint(wall.b) };
}

function clusterPoint(p: Point, clusters: Point[]): Point {
  for (const cluster of clusters) {
    if (dist(p, cluster) <= NODE_EPS) return cluster;
  }
  const rounded = roundPoint(p);
  clusters.push(rounded);
  return rounded;
}

export function normalizePlanTopology(plan: Plan): Plan {
  const next = copyPlan(plan);
  const clusters: Point[] = [];
  const normalized: Wall[] = [];
  for (const source of next.walls) {
    const straight = straightenWall(source);
    const a = clusterPoint(straight.a, clusters);
    const b = clusterPoint(straight.b, clusters);
    if (dist(a, b) < MIN_WALL_LENGTH) continue;
    normalized.push({ ...straight, a: { ...a }, b: { ...b } });
  }
  return { ...next, walls: normalized };
}

export function createWallSegment(input: {
  a: Point;
  b: Point;
  wallSettings: WallSpec;
  id?: string;
}): Wall {
  return straightenWall({
    id: input.id ?? uid(),
    a: roundPoint(input.a),
    b: roundPoint(input.b),
    thickness: input.wallSettings.thickness,
    height: input.wallSettings.height,
    wallType: input.wallSettings.wallType,
  });
}

export function createRectangularRoom(input: {
  a: Point;
  b: Point;
  wallSettings: WallSpec;
  grid: number;
}): Plan {
  const a = snapPoint(input.a, Math.max(1, input.grid));
  const b = snapPoint(input.b, Math.max(1, input.grid));
  const c1 = { x: a.x, y: a.y };
  const c2 = { x: b.x, y: a.y };
  const c3 = { x: b.x, y: b.y };
  const c4 = { x: a.x, y: b.y };
  const walls = [
    createWallSegment({ a: c1, b: c2, wallSettings: input.wallSettings }),
    createWallSegment({ a: c2, b: c3, wallSettings: input.wallSettings }),
    createWallSegment({ a: c3, b: c4, wallSettings: input.wallSettings }),
    createWallSegment({ a: c4, b: c1, wallSettings: input.wallSettings }),
  ];
  return normalizePlanTopology({ walls, openings: [], furniture: [], labels: [], sections: [] });
}

export function moveWallBodyOrthogonal(input: {
  plan: Plan;
  wallId: string;
  dx: number;
  dy: number;
  grid?: number;
}): Plan {
  const grid = input.grid ?? 1;
  const next = copyPlan(input.plan);
  next.walls = next.walls.map((wall) => {
    if (wall.id !== input.wallId) return wall;
    const moved = {
      ...wall,
      a: { x: wall.a.x + input.dx, y: wall.a.y + input.dy },
      b: { x: wall.b.x + input.dx, y: wall.b.y + input.dy },
    };
    const axis = axisKind(wall.a, wall.b) ?? axisKind(moved.a, moved.b);
    if (axis === "horizontal") {
      const y = Math.round(snap((wall.a.y + input.dy + wall.b.y + input.dy) / 2, grid));
      return { ...wall, a: { x: Math.round(wall.a.x), y }, b: { x: Math.round(wall.b.x), y } };
    }
    if (axis === "vertical") {
      const x = Math.round(snap((wall.a.x + input.dx + wall.b.x + input.dx) / 2, grid));
      return { ...wall, a: { x, y: Math.round(wall.a.y) }, b: { x, y: Math.round(wall.b.y) } };
    }
    return straightenWall(moved);
  });
  return normalizePlanTopology(next);
}

function snap(value: number, step: number) {
  return Math.round(value / Math.max(1, step)) * Math.max(1, step);
}

export function makeWallPatchOrthogonal(fixed: Point, rawTarget: Point): Point {
  const dx = rawTarget.x - fixed.x;
  const dy = rawTarget.y - fixed.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.round(rawTarget.x), y: Math.round(fixed.y) }
    : { x: Math.round(fixed.x), y: Math.round(rawTarget.y) };
}
