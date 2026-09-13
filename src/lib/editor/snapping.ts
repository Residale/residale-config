import type { Plan, Point, Wall } from "./types.ts";
import { dist, pointOnWall, snap, snapAngle, snapPoint } from "./geometry.ts";

export type SnapKind =
  "endpoint" | "close-room" | "axis-x" | "axis-y" | "wall-projection" | "grid" | "free";

export type GuideLine = { a: Point; b: Point; kind: "axis-x" | "axis-y" | "wall" };

export type SnapResult = {
  point: Point;
  kind: SnapKind;
  sourcePoint?: Point;
  guideLines: GuideLine[];
  wouldCloseRoom?: boolean;
};

export type WallDrawSnapInput = {
  raw: Point;
  previous?: Point;
  drawingStart?: Point;
  plan: Plan;
  grid: number;
  scale: number;
  snapEnabled: boolean;
  freeAngle?: boolean;
  disableSnap?: boolean;
  ignoreWallId?: string;
};

const roundPoint = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

function threshold(px: number, scale: number) {
  return px / Math.max(0.15, scale || 1);
}

function nearestEndpoint(
  raw: Point,
  walls: Wall[],
  limit: number,
  ignoreWallId?: string,
): { point: Point; d: number } | null {
  let best: { point: Point; d: number } | null = null;
  for (const wall of walls) {
    if (wall.id === ignoreWallId) continue;
    for (const point of [wall.a, wall.b]) {
      const d = dist(raw, point);
      if (d <= limit && (!best || d < best.d)) best = { point: { ...point }, d };
    }
  }
  return best;
}

function nearestAxisIntersection(
  raw: Point,
  previous: Point,
  walls: Wall[],
  limit: number,
  grid: number,
  ignoreWallId?: string,
): SnapResult | null {
  let best: { point: Point; d: number; kind: "axis-x" | "axis-y"; source: Point } | null = null;
  for (const wall of walls) {
    if (wall.id === ignoreWallId) continue;
    for (const end of [wall.a, wall.b]) {
      const horizontal = { x: end.x, y: previous.y };
      const vertical = { x: previous.x, y: end.y };
      for (const candidate of [
        { point: horizontal, kind: "axis-x" as const, source: end },
        { point: vertical, kind: "axis-y" as const, source: end },
      ]) {
        const d = dist(raw, candidate.point);
        if (d <= limit && (!best || d < best.d)) {
          best = { ...candidate, point: roundPoint(candidate.point), d };
        }
      }
    }
  }
  if (!best) return null;
  return {
    point: snapPoint(best.point, grid),
    kind: best.kind,
    sourcePoint: { ...best.source },
    guideLines: [{ a: previous, b: best.point, kind: best.kind }],
  };
}

function nearestWallProjection(
  raw: Point,
  walls: Wall[],
  limit: number,
  ignoreWallId?: string,
): SnapResult | null {
  let best: { point: Point; d: number; wall: Wall } | null = null;
  for (const wall of walls) {
    if (wall.id === ignoreWallId) continue;
    const info = pointOnWall(raw, wall);
    const wallLimit = Math.max(limit, wall.thickness / 2 + limit * 0.4);
    if (info.dist <= wallLimit && (!best || info.dist < best.d)) {
      best = { point: roundPoint(info.closest), d: info.dist, wall };
    }
  }
  if (!best) return null;
  return {
    point: best.point,
    kind: "wall-projection",
    sourcePoint: best.point,
    guideLines: [{ a: best.wall.a, b: best.wall.b, kind: "wall" }],
  };
}

function dominantAxisPoint(previous: Point, raw: Point, grid: number): SnapResult {
  const dx = raw.x - previous.x;
  const dy = raw.y - previous.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const point = horizontal
    ? { x: snap(raw.x, grid), y: Math.round(previous.y) }
    : { x: Math.round(previous.x), y: snap(raw.y, grid) };
  return {
    point,
    kind: horizontal ? "axis-x" : "axis-y",
    guideLines: [{ a: previous, b: point, kind: horizontal ? "axis-x" : "axis-y" }],
  };
}

export function resolveWallDrawSnap(input: WallDrawSnapInput): SnapResult {
  const grid = Math.max(1, input.grid || 1);
  const endpointLimit = threshold(18, input.scale);
  const closeLimit = threshold(22, input.scale);
  const axisLimit = threshold(14, input.scale);
  const wallLimit = threshold(12, input.scale);

  if (input.disableSnap || !input.snapEnabled) {
    const point =
      input.previous && !input.freeAngle
        ? dominantAxisPoint(input.previous, input.raw, 1).point
        : roundPoint(input.raw);
    return {
      point,
      kind:
        input.previous && !input.freeAngle
          ? dominantAxisPoint(input.previous, input.raw, 1).kind
          : "free",
      guideLines: [],
    };
  }

  if (input.drawingStart && input.previous && dist(input.raw, input.drawingStart) <= closeLimit) {
    return {
      point: { ...input.drawingStart },
      kind: "close-room",
      sourcePoint: { ...input.drawingStart },
      guideLines: [{ a: input.previous, b: input.drawingStart, kind: "axis-x" }],
      wouldCloseRoom: true,
    };
  }

  const endpoint = nearestEndpoint(input.raw, input.plan.walls, endpointLimit, input.ignoreWallId);
  if (endpoint) {
    return { point: endpoint.point, kind: "endpoint", sourcePoint: endpoint.point, guideLines: [] };
  }

  if (input.previous) {
    const axisIntersection = nearestAxisIntersection(
      input.raw,
      input.previous,
      input.plan.walls,
      axisLimit,
      grid,
      input.ignoreWallId,
    );
    if (axisIntersection) return axisIntersection;

    if (!input.freeAngle) return dominantAxisPoint(input.previous, input.raw, grid);

    const angled = snapPoint(snapAngle(input.previous, input.raw, 15), grid);
    return {
      point: angled,
      kind: "free",
      guideLines: [{ a: input.previous, b: angled, kind: "axis-x" }],
    };
  }

  const wallProjection = nearestWallProjection(
    input.raw,
    input.plan.walls,
    wallLimit,
    input.ignoreWallId,
  );
  if (wallProjection) return wallProjection;

  return { point: snapPoint(input.raw, grid), kind: "grid", guideLines: [] };
}
