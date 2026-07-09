import jsPDF from "jspdf";
import type { Opening, Plan, Point, Wall } from "./types";
import { openingHeight, openingSill } from "./opening-defaults";
import { wallPolygon, wallsSharingPoint, wallExtended } from "./wall-geometry";

/**
 * Export "plan architecte" : feuille unique type dossier permis (référence AURA 48) —
 * plan au trait à l'échelle, cotations, cartouche, appels de façades et 4 élévations.
 * Tout est dessiné en vectoriel dans jsPDF (aucune capture canvas).
 */

export type SheetPaper = "a4" | "a3";

export type SheetConfig = {
  company: string; // cartouche gauche, ex. "RESIDALE SAS"
  version: string; // cartouche droite, ex. "V1"
  scale: number; // dénominateur d'échelle souhaité, ex. 100 => 1:100
  paper: SheetPaper;
  showFurniture: boolean;
  showLabels: boolean;
  showElevations: boolean;
  showDimensions: boolean;
};

export const DEFAULT_SHEET_CONFIG: SheetConfig = {
  company: "RESIDALE SAS",
  version: "V1",
  scale: 100,
  paper: "a4",
  showFurniture: true,
  showLabels: true,
  showElevations: true,
  showDimensions: true,
};

export const SCALE_LADDER = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500];

const INK: [number, number, number] = [26, 26, 26];
const DIM: [number, number, number] = [70, 70, 70];
const FACADE_FILL: [number, number, number] = [212, 212, 212];
const FACADE_STROKE: [number, number, number] = [140, 140, 140];
const FURN: [number, number, number] = [150, 150, 150];

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Emprise extérieure du plan (nu extérieur des murs), en cm. */
export function planBounds(plan: Plan): Bounds | null {
  if (!plan.walls.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of plan.walls) {
    for (const p of wallPolygon(w)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

const fmtM = (cm: number) => (cm / 100).toFixed(3); // 800 cm -> "8.000"

// ---------------------------------------------------------------------------
// Élévations (façades) — projection simple des murs alignés côté vue.
// ---------------------------------------------------------------------------

export type ElevationDir = "N" | "S" | "E" | "O";

export type ElevationOpening = {
  x0: number; // cm depuis le bord gauche de la façade (déjà orienté vue)
  x1: number;
  sill: number;
  top: number;
  opening: Opening;
};

export type Elevation = {
  dir: ElevationDir;
  width: number; // cm — étendue extérieure de la façade
  height: number; // cm — hauteur de mur max de la façade
  openings: ElevationOpening[];
};

function wallAxisInfo(w: Wall) {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  return { dx, dy, len, horiz };
}

/**
 * Calcule la façade vue depuis `dir` (N = vue depuis le nord, etc.).
 * Convention écran : y croît vers le sud, x vers l'est.
 * On retient les murs alignés avec la façade et situés sur le nu le plus proche
 * du point de vue (tolérance = épaisseur du mur), pour ne pas dessiner les
 * ouvertures de la façade opposée.
 */
export function computeElevation(plan: Plan, dir: ElevationDir): Elevation | null {
  const b = planBounds(plan);
  if (!b) return null;
  const horizFacade = dir === "N" || dir === "S"; // murs orientés est-ouest
  const aligned = plan.walls.filter((w) => {
    const { dx, dy, len } = wallAxisInfo(w);
    const cos = Math.abs((horizFacade ? dx : dy) / len);
    return cos > 0.94 && len > 20;
  });
  if (!aligned.length) return null;

  const perp = (w: Wall) => (horizFacade ? (w.a.y + w.b.y) / 2 : (w.a.x + w.b.x) / 2);
  const nearVal =
    dir === "N" ? Math.min(...aligned.map(perp))
    : dir === "S" ? Math.max(...aligned.map(perp))
    : dir === "O" ? Math.min(...aligned.map(perp))
    : Math.max(...aligned.map(perp));
  const facadeWalls = aligned.filter((w) => Math.abs(perp(w) - nearVal) <= w.thickness + 6);

  const axisMin = horizFacade ? b.minX : b.minY;
  const axisMax = horizFacade ? b.maxX : b.maxY;
  const width = axisMax - axisMin;
  const ceilingH = plan.ceilingHeight ?? 250;
  const height = Math.max(...facadeWalls.map((w) => w.height ?? ceilingH), 1);

  // Miroir : vue extérieure => l'axe est inversé pour N (on regarde vers le sud)
  // et pour E (on regarde vers l'ouest).
  const mirrored = dir === "N" || dir === "E";

  const openings: ElevationOpening[] = [];
  for (const w of facadeWalls) {
    const { dx, dy, len } = wallAxisInfo(w);
    for (const o of plan.openings.filter((oo) => oo.wallId === w.id)) {
      const cx = w.a.x + dx * o.t;
      const cy = w.a.y + dy * o.t;
      const axisPos = (horizFacade ? cx : cy) - axisMin;
      let x0 = axisPos - o.width / 2;
      let x1 = axisPos + o.width / 2;
      if (mirrored) {
        const nx0 = width - x1;
        x1 = width - x0;
        x0 = nx0;
      }
      const sill = openingSill(o);
      openings.push({ x0, x1, sill, top: sill + openingHeight(o), opening: o });
    }
  }
  openings.sort((a, o) => a.x0 - o.x0);
  return { dir, width, height, openings };
}

// ---------------------------------------------------------------------------
// Primitives jsPDF
// ---------------------------------------------------------------------------

function polygon(doc: jsPDF, pts: Array<{ x: number; y: number }>, style: "S" | "F" | "FD") {
  if (pts.length < 3) return;
  const segs: number[][] = [];
  for (let i = 1; i < pts.length; i++) segs.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
  doc.lines(segs, pts[0].x, pts[0].y, [1, 1], style, true);
}

function polyline(doc: jsPDF, pts: Array<{ x: number; y: number }>) {
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
}

/** Arc de cercle approché par segments (suffisant à 0,2 mm de trait). */
function arc(doc: jsPDF, cx: number, cy: number, r: number, a0: number, a1: number) {
  const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) / (Math.PI / 2)) * 12));
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  polyline(doc, pts);
}

function setStroke(doc: jsPDF, c: [number, number, number], w: number) {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(w);
}

/** Ligne de cote avec attaches, ticks obliques et texte en mètres. */
function dimLine(
  doc: jsPDF,
  x1: number, y1: number, x2: number, y2: number,
  labelCm: number,
  opts: { textAngle?: number; fontSize?: number } = {},
) {
  setStroke(doc, DIM, 0.12);
  doc.line(x1, y1, x2, y2);
  const ux = (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
  const uy = (y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
  // ticks obliques à 45°
  const t = 0.9;
  for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
    doc.line(px - (ux - uy) * t * 0.5, py - (uy + ux) * t * 0.5, px + (ux - uy) * t * 0.5, py + (uy + ux) * t * 0.5);
  }
  doc.setFontSize(opts.fontSize ?? 6.5);
  doc.setTextColor(DIM[0], DIM[1], DIM[2]);
  doc.setFont("helvetica", "normal");
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const angle = opts.textAngle ?? 0;
  doc.text(fmtM(labelCm), mx - uy * 1.6, my + ux * 1.6 - (angle === 0 ? 0.4 : 0), {
    align: "center",
    angle,
  });
}

// ---------------------------------------------------------------------------
// Plan 2D vectoriel
// ---------------------------------------------------------------------------

type Mapper = { px: (x: number) => number; py: (y: number) => number; s: number };

function drawWalls(doc: jsPDF, plan: Plan, m: Mapper) {
  doc.setFillColor(INK[0], INK[1], INK[2]);
  setStroke(doc, INK, 0.15);
  for (const w of plan.walls) {
    // Ferme les angles quand une autre pièce de mur partage l'extrémité.
    const extendA = wallsSharingPoint(plan.walls, w.a).length > 1 ? w.thickness / 2 : 0;
    const extendB = wallsSharingPoint(plan.walls, w.b).length > 1 ? w.thickness / 2 : 0;
    const ext = wallExtended(w, 0);
    const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const wa = { x: ext.a.x - ux * extendA, y: ext.a.y - uy * extendA };
    const wb = { x: ext.b.x + ux * extendB, y: ext.b.y + uy * extendB };
    const poly = wallPolygon({ ...w, a: wa, b: wb });
    polygon(doc, poly.map((p) => ({ x: m.px(p.x), y: m.py(p.y) })), "FD");
  }
}

function openingFrame(o: Opening): { alongOffsets: number[] } {
  // lignes fines parallèles au mur dans la baie (symbole fenêtre / châssis fixe)
  switch (o.kind) {
    case "window_2":
    case "bay":
      return { alongOffsets: [-0.5, 0, 0.5] };
    case "fixed":
      return { alongOffsets: [0] };
    default:
      return { alongOffsets: [-0.5, 0, 0.5] };
  }
}

function drawOpenings(doc: jsPDF, plan: Plan, m: Mapper) {
  for (const o of plan.openings) {
    const w = plan.walls.find((ww) => ww.id === o.wallId);
    if (!w) continue;
    const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const cx = w.a.x + dx * o.t;
    const cy = w.a.y + dy * o.t;
    const half = o.width / 2;
    const th = w.thickness / 2;
    const corner = (su: number, sn: number) => ({
      x: m.px(cx + ux * su * half + nx * sn * th),
      y: m.py(cy + uy * su * half + ny * sn * th),
    });

    // 1. Perce la baie (blanc), légèrement plus grand pour recouvrir le trait du mur.
    doc.setFillColor(255, 255, 255);
    const overshoot = 1.06;
    polygon(doc, [corner(-1, -overshoot), corner(1, -overshoot), corner(1, overshoot), corner(-1, overshoot)], "F");

    // 2. Tableaux (jambages) aux extrémités de la baie.
    setStroke(doc, INK, 0.15);
    doc.line(corner(-1, -1).x, corner(-1, -1).y, corner(-1, 1).x, corner(-1, 1).y);
    doc.line(corner(1, -1).x, corner(1, -1).y, corner(1, 1).x, corner(1, 1).y);

    const isWindow = o.type === "window";
    const kind = o.kind ?? (isWindow ? "window_1" : "door_simple");

    if (isWindow || kind === "bay" || kind === "fixed") {
      // Symbole fenêtre : traits fins parallèles au mur.
      setStroke(doc, INK, 0.1);
      for (const off of openingFrame(o).alongOffsets) {
        doc.line(corner(-1, off).x, corner(-1, off).y, corner(1, off).x, corner(1, off).y);
      }
      if (kind === "window_2" || kind === "bay") {
        // meneau central
        setStroke(doc, INK, 0.14);
        doc.line(corner(0, -0.6).x, corner(0, -0.6).y, corner(0, 0.6).x, corner(0, 0.6).y);
      }
      if (kind === "bay_slide") drawSlidingPanes(doc, corner);
      continue;
    }

    // Portes
    const swing = o.swingSide === "n" ? -1 : 1;
    const hinge = o.hingeSide === "b" ? 1 : -1;
    if (kind === "door_slide" || kind === "bay_slide") {
      drawSlidingPanes(doc, corner);
    } else if (kind === "door_pocket") {
      setStroke(doc, INK, 0.12);
      doc.setLineDashPattern([1.2, 0.8], 0);
      doc.line(corner(-1, 0).x, corner(-1, 0).y, corner(1, 0).x, corner(1, 0).y);
      doc.setLineDashPattern([], 0);
    } else if (kind === "door_double") {
      drawLeaf(doc, m, { cx, cy, ux, uy, nx, ny }, half, -1, swing, half, o.openAngle ?? 90);
      drawLeaf(doc, m, { cx, cy, ux, uy, nx, ny }, half, 1, swing, half, o.openAngle ?? 90);
    } else {
      // door_simple / entrance
      drawLeaf(doc, m, { cx, cy, ux, uy, nx, ny }, half, hinge, swing, o.width, o.openAngle ?? 90);
    }
  }
}

function drawSlidingPanes(
  doc: jsPDF,
  corner: (su: number, sn: number) => { x: number; y: number },
) {
  setStroke(doc, INK, 0.16);
  // deux vantaux décalés de part et d'autre de l'axe
  const a1 = corner(-1, -0.25), b1 = corner(0.15, -0.25);
  const a2 = corner(-0.15, 0.25), b2 = corner(1, 0.25);
  doc.line(a1.x, a1.y, b1.x, b1.y);
  doc.line(a2.x, a2.y, b2.x, b2.y);
}

function drawLeaf(
  doc: jsPDF,
  m: Mapper,
  f: { cx: number; cy: number; ux: number; uy: number; nx: number; ny: number },
  half: number,
  hinge: -1 | 1,
  swing: -1 | 1,
  leafLen: number,
  angleDeg: number,
) {
  // Charnière au jambage `hinge`, vantail ouvert de angleDeg vers le côté `swing`.
  const hx = f.cx + f.ux * hinge * half;
  const hy = f.cy + f.uy * hinge * half;
  const closedAng = Math.atan2(-hinge * f.uy, -hinge * f.ux); // direction vers l'autre jambage
  const openAng = closedAng - hinge * swing * (Math.PI / 180) * angleDeg;
  const tipX = hx + Math.cos(openAng) * leafLen;
  const tipY = hy + Math.sin(openAng) * leafLen;
  setStroke(doc, INK, 0.2);
  doc.line(m.px(hx), m.py(hy), m.px(tipX), m.py(tipY));
  setStroke(doc, DIM, 0.1);
  const r = leafLen * m.s;
  arc(doc, m.px(hx), m.py(hy), r, Math.min(closedAng, openAng), Math.max(closedAng, openAng));
}

function drawFurniture(doc: jsPDF, plan: Plan, m: Mapper) {
  setStroke(doc, FURN, 0.12);
  for (const f of plan.furniture) {
    const a = (f.rotation * Math.PI) / 180;
    const cosA = Math.cos(a), sinA = Math.sin(a);
    const hw = f.width / 2, hh = f.height / 2;
    // x/y = centre du meuble, rotation autour du centre (cf. Canvas2D).
    const cx = f.x;
    const cy = f.y;
    const pts = [
      { x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh },
    ].map((p) => ({
      x: m.px(cx + p.x * cosA - p.y * sinA),
      y: m.py(cy + p.x * sinA + p.y * cosA),
    }));
    if (f.kind === "rug") doc.setLineDashPattern([0.8, 0.8], 0);
    polygon(doc, pts, "S");
    doc.setLineDashPattern([], 0);
  }
}

function drawPlanLabels(doc: jsPDF, plan: Plan, m: Mapper) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(DIM[0], DIM[1], DIM[2]);
  for (const l of plan.labels) {
    doc.text(l.text, m.px(l.x), m.py(l.y), { align: "center" });
  }
}

/** Appel de façade : libellé + triangle ouvert pointant vers le plan. */
function elevationCallout(
  doc: jsPDF,
  x: number, y: number,
  label: string,
  pointing: "up" | "down" | "left" | "right",
  textAngle: number,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  const t = 2.4; // demi-base du triangle
  const gap = 3.4; // écart texte/triangle
  setStroke(doc, [110, 110, 110], 0.2);
  const tri = (pts: number[][]) => {
    polygon(doc, pts.map(([px, py]) => ({ x: px, y: py })), "S");
  };
  if (pointing === "down") {
    doc.text(label, x - gap, y + 1, { align: "right", angle: textAngle });
    tri([[x + t, y - t + 0.8], [x + 3 * t, y - t + 0.8], [x + 2 * t, y + t + 0.8]]);
  } else if (pointing === "up") {
    doc.text(label, x - gap, y + 1, { align: "right", angle: textAngle });
    tri([[x + t, y + t - 0.6], [x + 3 * t, y + t - 0.6], [x + 2 * t, y - t - 0.6]]);
  } else if (pointing === "right") {
    doc.text(label, x - 1, y + gap, { align: "left", angle: 90 });
    tri([[x - t + 0.4, y - 3 * t], [x - t + 0.4, y - t], [x + t + 0.4, y - 2 * t]]);
  } else {
    doc.text(label, x + 1, y - gap, { align: "left", angle: -90 });
    tri([[x + t - 0.4, y + t], [x + t - 0.4, y + 3 * t], [x - t - 0.4, y + 2 * t]]);
  }
}

// ---------------------------------------------------------------------------
// Élévation vectorielle (une cellule)
// ---------------------------------------------------------------------------

function drawElevation(
  doc: jsPDF,
  elev: Elevation,
  cell: { x: number; y: number; w: number; h: number },
  s: number, // mm par cm
  showDims: boolean,
) {
  const wMM = elev.width * s;
  const hMM = elev.height * s;
  const ox = cell.x + (cell.w - wMM) / 2 + 4; // décale pour laisser la cote verticale à gauche
  const oy = cell.y + (cell.h - hMM) / 2 - 2;
  const X = (cm: number) => ox + cm * s;
  const Y = (cm: number) => oy + hMM - cm * s; // cm depuis le sol

  // Corps de façade
  doc.setFillColor(FACADE_FILL[0], FACADE_FILL[1], FACADE_FILL[2]);
  setStroke(doc, FACADE_STROKE, 0.15);
  doc.rect(ox, oy, wMM, hMM, "FD");

  // Ouvertures
  for (const o of elev.openings) {
    const x = X(Math.max(0, o.x0));
    const wOp = (Math.min(elev.width, o.x1) - Math.max(0, o.x0)) * s;
    if (wOp <= 0) continue;
    const yTop = Y(Math.min(o.top, elev.height));
    const hOp = (Math.min(o.top, elev.height) - o.sill) * s;
    doc.setFillColor(246, 246, 246);
    setStroke(doc, [110, 110, 110], 0.18);
    doc.rect(x, yTop, wOp, hOp, "FD");
    // cadre intérieur
    setStroke(doc, [130, 130, 130], 0.1);
    const inset = Math.min(0.8, wOp * 0.08);
    doc.rect(x + inset, yTop + inset, wOp - 2 * inset, hOp - 2 * inset, "S");
    // meneau pour 2 vantaux / coulissants
    const k = o.opening.kind;
    if (k === "window_2" || k === "door_double" || k === "bay" || k === "bay_slide") {
      doc.line(x + wOp / 2, yTop + inset, x + wOp / 2, yTop + hOp - inset);
    }
  }

  // Ligne de sol
  setStroke(doc, [80, 80, 80], 0.3);
  doc.line(ox - 2.5, oy + hMM, ox + wMM + 2.5, oy + hMM);

  if (showDims) {
    dimLine(doc, ox - 3.2, oy + hMM, ox - 3.2, oy, elev.height, { textAngle: 90, fontSize: 6 });
    dimLine(doc, ox, oy + hMM + 4.2, ox + wMM, oy + hMM + 4.2, elev.width, { fontSize: 6 });
  }
}

// ---------------------------------------------------------------------------
// Feuille complète
// ---------------------------------------------------------------------------

export type SheetResult = { effectiveScale: number; elevationScale: number };

export function buildArchitectSheet(plan: Plan, projectName: string, cfg: SheetConfig): { doc: jsPDF } & SheetResult {
  const paperSize = cfg.paper === "a3" ? { w: 297, h: 420 } : { w: 210, h: 297 };
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: cfg.paper });
  const pageW = paperSize.w, pageH = paperSize.h;

  const margin = 7;
  const titleH = cfg.paper === "a3" ? 28 : 22;
  const innerX = margin, innerY = margin;
  const innerW = pageW - margin * 2;
  const innerH = pageH - margin * 2;

  // Cadre de page + cartouche
  setStroke(doc, INK, 0.3);
  doc.rect(innerX, innerY, innerW, innerH, "S");

  const tbY = innerY + innerH - titleH;
  doc.line(innerX, tbY, innerX + innerW, tbY);
  const c1 = innerX + innerW * 0.34;
  const c2 = innerX + innerW * 0.68;
  setStroke(doc, INK, 0.25);
  doc.line(c1, tbY, c1, tbY + titleH);
  doc.line(c2, tbY, c2, tbY + titleH);
  // colonne droite : V1 en haut, Echelle en bas
  const rMid = tbY + titleH * 0.5;
  doc.line(c2, rMid, innerX + innerW, rMid);

  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(cfg.paper === "a3" ? 16 : 13);
  doc.text(cfg.company, (innerX + c1) / 2, tbY + titleH / 2 + 1.8, { align: "center" });
  doc.text(projectName, (c1 + c2) / 2, tbY + titleH / 2 + 1.8, { align: "center" });
  doc.setFontSize(cfg.paper === "a3" ? 13 : 11);
  doc.text(cfg.version, (c2 + innerX + innerW) / 2, tbY + titleH * 0.25 + 1.6, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 90);
  doc.text("Echelle", c2 + 1.5, rMid + 3);

  const bounds = planBounds(plan);
  if (!bounds) {
    doc.setFontSize(11);
    doc.text("Plan vide", pageW / 2, pageH / 2, { align: "center" });
    return { doc, effectiveScale: cfg.scale, elevationScale: cfg.scale };
  }

  const bw = bounds.maxX - bounds.minX; // cm
  const bh = bounds.maxY - bounds.minY;

  // Zones : plan en haut (~46 % de la hauteur utile), élévations en dessous.
  const contentH = innerH - titleH;
  const calloutPad = 16; // place pour appels de façades + cotes autour du plan
  const planZone = {
    x: innerX + calloutPad,
    y: innerY + calloutPad,
    w: innerW - calloutPad * 2,
    h: (cfg.showElevations ? contentH * 0.46 : contentH) - calloutPad * 2,
  };

  // Échelle effective : la valeur demandée si le plan tient, sinon le premier
  // palier normalisé supérieur qui tient.
  const fits = (den: number) => (bw * 10) / den <= planZone.w && (bh * 10) / den <= planZone.h;
  let effectiveScale = cfg.scale;
  if (!fits(effectiveScale)) {
    effectiveScale = SCALE_LADDER.find((d) => d >= cfg.scale && fits(d)) ?? Math.ceil((Math.max((bw * 10) / planZone.w, (bh * 10) / planZone.h)) / 25) * 25;
  }
  const s = 10 / effectiveScale; // mm par cm

  const planW = bw * s, planH = bh * s;
  const planOx = planZone.x + (planZone.w - planW) / 2;
  const planOy = planZone.y + (planZone.h - planH) / 2;
  const m: Mapper = {
    px: (x: number) => planOx + (x - bounds.minX) * s,
    py: (y: number) => planOy + (y - bounds.minY) * s,
    s,
  };

  // Plan
  drawWalls(doc, plan, m);
  drawOpenings(doc, plan, m);
  if (cfg.showFurniture) drawFurniture(doc, plan, m);
  if (cfg.showLabels) drawPlanLabels(doc, plan, m);

  // Cotes générales
  if (cfg.showDimensions) {
    dimLine(doc, m.px(bounds.minX), planOy - 5, m.px(bounds.maxX), planOy - 5, bw);
    dimLine(doc, planOx - 5, m.py(bounds.maxY), planOx - 5, m.py(bounds.minY), bh, { textAngle: 90 });
  }

  // Appels de façades autour du plan
  const cxMid = planOx + planW / 2;
  const cyMid = planOy + planH / 2;
  elevationCallout(doc, cxMid, planOy - 11.5, "Façade Nord", "down", 0);
  elevationCallout(doc, cxMid, planOy + planH + 11, "Façade Sud", "up", 0);
  elevationCallout(doc, planZone.x - 7, cyMid, "Façade Ouest", "right", 90);
  elevationCallout(doc, planZone.x + planZone.w + 7, cyMid, "Façade Est", "left", -90);

  // Élévations 2×2
  let elevationScale = effectiveScale;
  if (cfg.showElevations) {
    const zoneY = innerY + contentH * 0.5;
    const zoneH = tbY - zoneY - 4;
    const gap = 6;
    const cellW = (innerW - gap * 3) / 2;
    const cellH = (zoneH - gap) / 2;

    const elevations = (["N", "E", "S", "O"] as ElevationDir[])
      .map((d) => computeElevation(plan, d))
      .filter((e): e is Elevation => !!e);

    const maxW = Math.max(...elevations.map((e) => e.width), 1);
    const maxH = Math.max(...elevations.map((e) => e.height), 1);
    const fitsElev = (den: number) => (maxW * 10) / den <= cellW - 14 && (maxH * 10) / den <= cellH - 12;
    if (!fitsElev(elevationScale)) {
      elevationScale = SCALE_LADDER.find((d) => d >= elevationScale && fitsElev(d))
        ?? Math.ceil(Math.max((maxW * 10) / (cellW - 14), (maxH * 10) / (cellH - 12)) / 25) * 25;
    }
    const es = 10 / elevationScale;

    const names: Record<ElevationDir, string> = { N: "Façade Nord", S: "Façade Sud", E: "Façade Est", O: "Façade Ouest" };
    elevations.slice(0, 4).forEach((elev, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const cell = {
        x: innerX + gap + col * (cellW + gap),
        y: zoneY + row * (cellH + gap),
        w: cellW,
        h: cellH,
      };
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text(names[elev.dir], cell.x + 1, cell.y + 2.4);
      drawElevation(doc, elev, cell, es, cfg.showDimensions);
    });
  }

  // Note d'échelle réelle si différente de la demandée
  if (effectiveScale !== cfg.scale) {
    doc.setFontSize(5.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Plan ajusté à 1:${effectiveScale} pour tenir sur la feuille`, innerX + 2, tbY - 2);
  }

  // Valeur d'échelle dans le cartouche (échelle effective du plan)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(cfg.paper === "a3" ? 13 : 11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`1:${effectiveScale}`, (c2 + innerX + innerW) / 2, tbY + titleH * 0.75 + 1.6, { align: "center" });

  return { doc, effectiveScale, elevationScale };
}

export function exportArchitectSheetPDF(plan: Plan, projectName: string, cfg: SheetConfig): SheetResult {
  const { doc, effectiveScale, elevationScale } = buildArchitectSheet(plan, projectName, cfg);
  const safeName = (projectName || "plan").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
  doc.save(`${safeName}_${cfg.version || "V1"}_plan.pdf`);
  return { effectiveScale, elevationScale };
}
