import type { Plan, Point, Wall } from "./types";

const EPS = 1.5;

type Node = { id: string; p: Point };
type Edge = { from: string; to: string; wall: Wall };

function keyOf(p: Point) {
  return `${Math.round(p.x / EPS)}:${Math.round(p.y / EPS)}`;
}

/** Detect closed rooms as minimal cycles in the wall graph. Returns polygons. */
export function detectRooms(plan: Plan): { polygon: Point[]; area: number; center: Point }[] {
  const nodes = new Map<string, Node>();
  const edgesByNode = new Map<string, { to: string; wall: Wall }[]>();

  const addNode = (p: Point) => {
    const k = keyOf(p);
    if (!nodes.has(k)) nodes.set(k, { id: k, p });
    return k;
  };
  const addEdge = (a: string, b: string, w: Wall) => {
    if (!edgesByNode.has(a)) edgesByNode.set(a, []);
    if (!edgesByNode.has(b)) edgesByNode.set(b, []);
    edgesByNode.get(a)!.push({ to: b, wall: w });
    edgesByNode.get(b)!.push({ to: a, wall: w });
  };

  for (const w of plan.walls) {
    const ka = addNode(w.a);
    const kb = addNode(w.b);
    if (ka === kb) continue;
    addEdge(ka, kb, w);
  }

  // Find minimal cycles by walking always turning right (clockwise face finding).
  const usedFace = new Set<string>();
  const faces: string[][] = [];

  const angle = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x);

  for (const startId of nodes.keys()) {
    const edges = edgesByNode.get(startId) ?? [];
    for (const e of edges) {
      const dirKey = `${startId}->${e.to}`;
      if (usedFace.has(dirKey)) continue;
      // walk
      const face: string[] = [startId];
      let prev = startId;
      let curr = e.to;
      let safety = 0;
      while (curr !== startId && safety++ < 200) {
        face.push(curr);
        usedFace.add(`${prev}->${curr}`);
        const nexts = edgesByNode.get(curr) ?? [];
        if (nexts.length === 0) break;
        const inAng = angle(nodes.get(curr)!.p, nodes.get(prev)!.p);
        let best: { to: string; a: number } | null = null;
        for (const n of nexts) {
          if (n.to === prev && nexts.length > 1) continue;
          const outAng = angle(nodes.get(curr)!.p, nodes.get(n.to)!.p);
          let diff = outAng - inAng;
          while (diff <= 0) diff += Math.PI * 2;
          while (diff > Math.PI * 2) diff -= Math.PI * 2;
          if (!best || diff < best.a) best = { to: n.to, a: diff };
        }
        if (!best) break;
        prev = curr;
        curr = best.to;
      }
      if (curr === startId && face.length >= 3) {
        usedFace.add(`${prev}->${curr}`);
        faces.push(face);
      }
    }
  }

  const rooms: { polygon: Point[]; area: number; center: Point }[] = [];
  for (const face of faces) {
    const poly = face.map((id) => nodes.get(id)!.p);
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      a += p1.x * p2.y - p2.x * p1.y;
    }
    a = a / 2;
    if (a >= 0) continue; // exterior face (CCW in screen coords)
    const area = Math.abs(a);
    if (area < 50 * 50) continue; // < 0.25 m² noise
    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    rooms.push({ polygon: poly, area, center: { x: cx, y: cy } });
  }

  // Sort largest first (usually séjour)
  rooms.sort((a, b) => b.area - a.area);
  return rooms;
}

export type RoomSummary = { name: string; area: number; center: Point };

export function summarizeRooms(plan: Plan): RoomSummary[] {
  const rooms = detectRooms(plan);
  const labels = plan.labels ?? [];
  return rooms.map((r, i) => {
    // Attach nearest label if within room polygon-ish (bbox test)
    let closestLabel: string | null = null;
    let closestD = Infinity;
    for (const l of labels) {
      const d = Math.hypot(l.x - r.center.x, l.y - r.center.y);
      if (d < closestD) {
        closestD = d;
        closestLabel = l.text;
      }
    }
    const fallback = i === 0 ? "Séjour" : i === 1 ? "Chambre" : `Pièce ${i + 1}`;
    return { name: closestLabel ?? fallback, area: r.area / 10000, center: r.center };
  });
}
