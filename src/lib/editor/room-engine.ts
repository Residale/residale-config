import type { Plan, Point } from "./types.ts";

const EPS = 1.5;

export type InteriorRoom = {
  id: string;
  polygon: Point[];
  areaCm2: number;
  areaM2: number;
  center: Point;
  name: string;
};

type Node = { id: string; p: Point };

type DirectedEdge = { from: string; to: string; angle: number };

function keyOf(p: Point) {
  return `${Math.round(p.x / EPS)}:${Math.round(p.y / EPS)}`;
}

function signedArea(poly: Point[]) {
  let area = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function centroid(poly: Point[]) {
  const area = signedArea(poly);
  if (Math.abs(area) < 0.001) {
    return {
      x: poly.reduce((sum, p) => sum + p.x, 0) / Math.max(1, poly.length),
      y: poly.reduce((sum, p) => sum + p.y, 0) / Math.max(1, poly.length),
    };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y || 1) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function canonicalFace(face: string[]) {
  const rotations = face.map((_, i) => [...face.slice(i), ...face.slice(0, i)].join("|"));
  return rotations.sort()[0];
}

export function detectInteriorRooms(plan: Plan): InteriorRoom[] {
  const nodes = new Map<string, Node>();
  const adjacency = new Map<string, DirectedEdge[]>();

  const nodeId = (p: Point) => {
    const key = keyOf(p);
    if (!nodes.has(key)) nodes.set(key, { id: key, p: { x: Math.round(p.x), y: Math.round(p.y) } });
    return key;
  };

  const addDirected = (from: string, to: string) => {
    const a = nodes.get(from)!.p;
    const b = nodes.get(to)!.p;
    const edge = { from, to, angle: Math.atan2(b.y - a.y, b.x - a.x) };
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push(edge);
  };

  for (const wall of plan.walls) {
    const a = nodeId(wall.a);
    const b = nodeId(wall.b);
    if (a === b) continue;
    addDirected(a, b);
    addDirected(b, a);
  }

  for (const edges of adjacency.values()) edges.sort((a, b) => a.angle - b.angle);

  const visited = new Set<string>();
  const faces: string[][] = [];

  const nextEdge = (from: string, to: string): DirectedEdge | null => {
    const edges = adjacency.get(to) ?? [];
    if (!edges.length) return null;
    const reverseIndex = edges.findIndex((edge) => edge.to === from);
    if (reverseIndex < 0) return edges[0];
    // Face walk in screen coordinates: choose the edge just before the reverse
    // edge in angular order, producing clockwise interior faces for normal plans.
    return edges[(reverseIndex - 1 + edges.length) % edges.length];
  };

  for (const [from, edges] of adjacency.entries()) {
    for (const edge of edges) {
      const startKey = `${from}->${edge.to}`;
      if (visited.has(startKey)) continue;
      const face: string[] = [];
      let curFrom = from;
      let curTo = edge.to;
      let safety = 0;
      while (safety++ < 500) {
        const key = `${curFrom}->${curTo}`;
        if (visited.has(key)) break;
        visited.add(key);
        face.push(curFrom);
        const next = nextEdge(curFrom, curTo);
        if (!next) break;
        curFrom = curTo;
        curTo = next.to;
        if (curFrom === from && curTo === edge.to) {
          if (face.length >= 3) faces.push(face);
          break;
        }
      }
    }
  }

  const unique = new Map<string, Point[]>();
  for (const face of faces) {
    unique.set(
      canonicalFace(face),
      face.map((id) => nodes.get(id)!.p),
    );
  }

  const candidates = [...unique.values()]
    .map((polygon) => ({ polygon, area: signedArea(polygon), center: centroid(polygon) }))
    .filter((face) => Math.abs(face.area) >= 50 * 50);

  if (!candidates.length) return [];
  const exteriorAbsArea = Math.max(...candidates.map((face) => Math.abs(face.area)));

  const labels = plan.labels ?? [];
  const rooms = candidates
    .filter((face) => {
      // Drop the exterior/unbounded face: with the walk direction above, it is
      // normally the largest counter-clockwise face in screen coordinates.
      if (Math.abs(Math.abs(face.area) - exteriorAbsArea) < 0.001 && face.area > 0) return false;
      return face.area < 0 || Math.abs(face.area) < exteriorAbsArea - 0.001;
    })
    .map((face, index) => {
      const matchingLabel = labels.find((label) => pointInPolygon(label, face.polygon));
      const areaCm2 = Math.abs(face.area);
      return {
        id: `room-${index + 1}`,
        polygon: face.polygon,
        areaCm2,
        areaM2: areaCm2 / 10000,
        center: face.center,
        name: matchingLabel?.text?.trim() || `Pièce ${index + 1}`,
      };
    })
    .sort((a, b) => b.areaM2 - a.areaM2);

  return rooms.map((room, index) => ({ ...room, id: `room-${index + 1}` }));
}

export function formatAreaM2(areaM2: number) {
  return `${areaM2.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function totalInteriorAreaM2(plan: Plan) {
  return detectInteriorRooms(plan).reduce((sum, room) => sum + room.areaM2, 0);
}
