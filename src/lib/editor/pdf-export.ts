import jsPDF from "jspdf";
import Konva from "konva";
import type { Plan, SectionLine } from "./types";
import { autoSectionsFromPlan, computeSection } from "./sections";
import { summarizeRooms } from "./rooms";
import { DEFAULT_THEME, type Theme2D } from "./theme";

/** Render a single section to a PNG dataURL using an offscreen Konva stage. */
export function renderSectionPNG(
  plan: Plan,
  sec: SectionLine,
  theme: Theme2D,
  opts: { width: number; height: number; pixelRatio?: number },
): string {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${opts.width}px`;
  container.style.height = `${opts.height}px`;
  document.body.appendChild(container);

  try {
    const data = computeSection(plan, sec);
    const totalLen = data.length;
    const cuts = [...data.cuts].sort((a, b) => a.start - b.start);
    const wallCuts = cuts.filter((c) => c.type === "wall");
    const roofMaxH = (() => {
      if (!plan.roof || !wallCuts.length) return data.ceilingH;
      const spanStart = Math.min(...wallCuts.map((c) => c.start));
      const spanEnd = Math.max(...wallCuts.map((c) => c.end));
      const xL = spanStart - plan.roof.overhang;
      const xR = spanEnd + plan.roof.overhang;
      if (plan.roof.kind === "flat") return Math.max(data.ceilingH, plan.roof.eaveHeight + 20);
      if (plan.roof.kind === "mono")
        return Math.max(
          data.ceilingH,
          plan.roof.eaveHeight + Math.tan((plan.roof.pitch * Math.PI) / 180) * (xR - xL),
        );
      return Math.max(
        data.ceilingH,
        plan.roof.eaveHeight +
          Math.tan((plan.roof.pitch * Math.PI) / 180) *
            ((spanEnd - spanStart) / 2 + plan.roof.overhang),
      );
    })();
    const totalH = roofMaxH + 60;
    const marginX = 70,
      marginY = 50;
    const availW = opts.width - marginX * 2;
    const availH = opts.height - marginY * 2;
    const s = Math.min(availW / Math.max(1, totalLen), availH / Math.max(1, totalH));
    const originX = marginX;
    const originY = marginY + roofMaxH * s;
    const toX = (cm: number) => originX + cm * s;
    const toY = (cm: number) => originY - cm * s;

    const stage = new Konva.Stage({ container, width: opts.width, height: opts.height });
    const layer = new Konva.Layer();
    stage.add(layer);

    // Background
    layer.add(
      new Konva.Rect({ x: 0, y: 0, width: opts.width, height: opts.height, fill: "#faf8f2" }),
    );

    // Ground
    layer.add(
      new Konva.Rect({
        x: toX(-50) - 20,
        y: originY,
        width: (totalLen + 100) * s + 40,
        height: 30,
        fill: theme.floor,
        opacity: 0.4,
      }),
    );
    layer.add(
      new Konva.Line({
        points: [toX(-50) - 20, originY, toX(totalLen + 50) + 20, originY],
        stroke: theme.wallStroke,
        strokeWidth: 1.5,
      }),
    );

    // Ceiling
    layer.add(
      new Konva.Line({
        points: [toX(-50), toY(data.ceilingH), toX(totalLen + 50), toY(data.ceilingH)],
        stroke: theme.wallStroke,
        strokeWidth: 1,
        dash: [8, 4],
      }),
    );

    // Roof
    if (plan.roof && wallCuts.length > 0) {
      const spanStart = Math.min(...wallCuts.map((c) => c.start));
      const spanEnd = Math.max(...wallCuts.map((c) => c.end));
      const ov = plan.roof.overhang;
      const eave = plan.roof.eaveHeight;
      const pitchRad = (plan.roof.pitch * Math.PI) / 180;
      const half = (spanEnd - spanStart) / 2 + ov;
      const ridgeH = plan.roof.kind === "flat" ? eave + 20 : eave + Math.tan(pitchRad) * half;
      const xL = spanStart - ov,
        xR = spanEnd + ov;
      let poly: number[] = [];
      if (plan.roof.kind === "flat") {
        poly = [
          toX(xL),
          toY(eave + 20),
          toX(xR),
          toY(eave + 20),
          toX(xR),
          toY(eave),
          toX(xL),
          toY(eave),
        ];
      } else if (plan.roof.kind === "mono") {
        const hi = eave + Math.tan(pitchRad) * (xR - xL);
        poly = [
          toX(xL),
          toY(eave),
          toX(xR),
          toY(hi),
          toX(xR),
          toY(hi - 15),
          toX(xL),
          toY(eave - 15),
        ];
      } else {
        const midX = (xL + xR) / 2;
        poly = [
          toX(xL),
          toY(eave),
          toX(midX),
          toY(ridgeH),
          toX(xR),
          toY(eave),
          toX(xR),
          toY(eave - 15),
          toX(midX),
          toY(ridgeH - 15),
          toX(xL),
          toY(eave - 15),
        ];
      }
      layer.add(
        new Konva.Line({
          points: poly,
          closed: true,
          fill: theme.wallFill,
          stroke: theme.wallStroke,
          strokeWidth: 1,
          opacity: 0.9,
        }),
      );
    }

    // Walls
    for (const c of cuts.filter((c) => c.type === "wall")) {
      layer.add(
        new Konva.Rect({
          x: toX(c.start),
          y: toY(c.height),
          width: (c.end - c.start) * s,
          height: c.height * s,
          fill: theme.wallFill,
          stroke: theme.wallStroke,
          strokeWidth: 1,
        }),
      );
    }

    // Openings
    for (const c of cuts.filter((c) => c.type !== "wall")) {
      const openH = c.height - c.sillHeight;
      const openW = c.opening?.width ?? c.end - c.start;
      layer.add(
        new Konva.Rect({
          x: toX(c.start),
          y: toY(c.height),
          width: (c.end - c.start) * s,
          height: openH * s,
          fill: "#faf8f2",
          stroke: theme.openingStroke,
          strokeWidth: 1,
        }),
      );
      if (c.type === "window") {
        layer.add(
          new Konva.Line({
            points: [
              toX(c.start),
              toY((c.height + c.sillHeight) / 2),
              toX(c.end),
              toY((c.height + c.sillHeight) / 2),
            ],
            stroke: theme.openingStroke,
            strokeWidth: 0.6,
          }),
        );
        layer.add(
          new Konva.Rect({
            x: toX(c.start),
            y: toY(c.sillHeight),
            width: (c.end - c.start) * s,
            height: c.sillHeight * s,
            fill: theme.wallFill,
            stroke: theme.wallStroke,
            strokeWidth: 1,
          }),
        );
      }
      const kind = c.type === "door" ? "Porte" : "Fenêtre";
      layer.add(
        new Konva.Text({
          x: toX((c.start + c.end) / 2) - 80,
          y: toY(c.height) - 18,
          width: 160,
          align: "center",
          text: `${kind} ${Math.round(openW)}×${Math.round(openH)}`,
          fontSize: 10,
          fontFamily: "Inter",
          fill: theme.dimension,
        }),
      );
    }

    // Slab
    layer.add(
      new Konva.Rect({
        x: toX(-50),
        y: toY(0),
        width: (totalLen + 100) * s,
        height: 16,
        fill: theme.wallFill,
      }),
    );

    // Levels
    layer.add(
      new Konva.Text({
        x: toX(-50) - 60,
        y: toY(0) - 6,
        text: "± 0.00",
        fontSize: 10,
        fontFamily: "JetBrains Mono",
        fill: theme.dimension,
      }),
    );
    layer.add(
      new Konva.Text({
        x: toX(-50) - 60,
        y: toY(data.ceilingH) - 6,
        text: `+ ${(data.ceilingH / 100).toFixed(2)}`,
        fontSize: 10,
        fontFamily: "JetBrains Mono",
        fill: theme.dimension,
      }),
    );

    // Top dim
    if (wallCuts.length > 0) {
      const spanStart = Math.min(...wallCuts.map((c) => c.start));
      const spanEnd = Math.max(...wallCuts.map((c) => c.end));
      const spanLen = spanEnd - spanStart;
      const dimY = marginY - 20;
      layer.add(
        new Konva.Line({
          points: [toX(spanStart), dimY, toX(spanEnd), dimY],
          stroke: theme.dimension,
          strokeWidth: 1,
        }),
      );
      layer.add(
        new Konva.Text({
          x: toX((spanStart + spanEnd) / 2) - 40,
          y: dimY - 15,
          width: 80,
          align: "center",
          text: `${(spanLen / 100).toFixed(2)} m`,
          fontSize: 11,
          fontFamily: "JetBrains Mono",
          fill: theme.dimension,
        }),
      );
    }

    layer.draw();
    const url = stage.toDataURL({ pixelRatio: opts.pixelRatio ?? 2 });
    stage.destroy();
    return url;
  } finally {
    container.remove();
  }
}

/** Grab a currently visible Konva stage on the page (used for 2D & 3D captures). */
export function findStageDataURL(): string | null {
  const canvases = Array.from(document.querySelectorAll("canvas"));
  if (canvases.length === 0) return null;
  // Prefer the largest visible canvas
  let best: HTMLCanvasElement | null = null;
  let bestArea = 0;
  for (const c of canvases) {
    const rect = c.getBoundingClientRect();
    if (rect.width < 50) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      best = c;
    }
  }
  return best?.toDataURL("image/png") ?? null;
}

type DossierData = {
  plan: Plan;
  projectName: string;
  theme?: Theme2D;
  plan2DImage?: string | null;
  view3DImage?: string | null;
};

export async function exportDossierPDF({
  plan,
  projectName,
  theme = DEFAULT_THEME,
  plan2DImage,
  view3DImage,
}: DossierData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  const rooms = summarizeRooms(plan);
  const shab = rooms.reduce((s, r) => s + r.area, 0);
  const date = new Date().toLocaleDateString("fr-FR");

  const drawCartouche = (pageTitle: string, pageNum: number, pageTotal: number) => {
    const y = pageH - 20;
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, 12);
    doc.line(margin + contentW * 0.5, y, margin + contentW * 0.5, y + 12);
    doc.line(margin + contentW * 0.75, y, margin + contentW * 0.75, y + 12);
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(projectName, margin + 3, y + 5);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Residale Config — Residale · ${date}`, margin + 3, y + 9);
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(pageTitle, margin + contentW * 0.5 + 3, y + 7);
    doc.setFontSize(8);
    doc.text(`Page ${pageNum} / ${pageTotal}`, margin + contentW * 0.75 + 3, y + 7);
  };

  const totalPages = 3;

  // ================= PAGE 1 : Cover + Plan 2D =================
  doc.setFontSize(28);
  doc.setTextColor(30);
  doc.text(projectName, margin, margin + 12);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Dossier plans · ${date}`, margin, margin + 20);

  if (plan2DImage) {
    const imgY = margin + 28;
    const imgH = pageH - imgY - 30;
    const imgW = contentW;
    doc.addImage(plan2DImage, "PNG", margin, imgY, imgW, imgH, undefined, "FAST");
  }
  drawCartouche("Plan 2D — RDC", 1, totalPages);

  // ================= PAGE 2 : Coupes 2×2 + 3D =================
  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Coupes et vue perspective", margin, margin + 8);

  const sections = plan.sections.length ? plan.sections : autoSectionsFromPlan(plan);
  const gridTop = margin + 14;
  const gridH = pageH - gridTop - 30;
  const cellW = (contentW * 0.66) / 2;
  const cellH = gridH / 2;
  const gap = 4;

  sections.slice(0, 4).forEach((sec, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (cellW + gap);
    const y = gridTop + row * (cellH + gap);
    // draw border
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cellW - gap, cellH - gap);
    try {
      const png = renderSectionPNG(plan, sec, theme, { width: 900, height: 600, pixelRatio: 1.5 });
      doc.addImage(png, "PNG", x, y, cellW - gap, cellH - gap, undefined, "FAST");
    } catch {
      // ignore render failures
    }
    const nameMap: Record<string, string> = {
      N: "Coupe Nord",
      S: "Coupe Sud",
      E: "Coupe Est",
      O: "Coupe Ouest",
    };
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(nameMap[sec.name] ?? `Coupe ${sec.name}-${sec.name}'`, x + 2, y + 5);
  });

  // 3D snapshot on right side
  if (view3DImage) {
    const x = margin + contentW * 0.66 + 4;
    const y = gridTop;
    const w = contentW - (contentW * 0.66 + 4);
    const h = gridH;
    doc.setDrawColor(180);
    doc.rect(x, y, w, h);
    doc.addImage(view3DImage, "PNG", x, y, w, h, undefined, "FAST");
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text("Vue 3D", x + 2, y + 5);
  } else {
    const x = margin + contentW * 0.66 + 4;
    const y = gridTop;
    const w = contentW - (contentW * 0.66 + 4);
    const h = gridH;
    doc.setDrawColor(200);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(x, y, w, h);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("Vue 3D non disponible", x + w / 2 - 20, y + h / 2);
  }
  drawCartouche("Coupes N/S/E/O · Vue 3D", 2, totalPages);

  // ================= PAGE 3 : Tableau des surfaces =================
  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(30);
  doc.text("Tableau des surfaces", margin, margin + 8);

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Surface habitable totale : ${shab.toFixed(2)} m²`, margin, margin + 16);

  // table
  const tableTop = margin + 24;
  const rowH = 9;
  const colX = [margin, margin + 15, margin + 100, margin + 160];
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, tableTop, contentW, rowH, "F");
  doc.setDrawColor(160);
  doc.setLineWidth(0.2);
  doc.rect(margin, tableTop, contentW, rowH);
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text("N°", colX[0] + 2, tableTop + 6);
  doc.text("Désignation", colX[1] + 2, tableTop + 6);
  doc.text("Surface (m²)", colX[2] + 2, tableTop + 6);
  doc.text("Observations", colX[3] + 2, tableTop + 6);

  rooms.forEach((r, i) => {
    const y = tableTop + rowH + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, contentW, rowH, "F");
    }
    doc.setDrawColor(200);
    doc.rect(margin, y, contentW, rowH);
    doc.setTextColor(30);
    doc.setFontSize(9);
    doc.text(String(i + 1).padStart(2, "0"), colX[0] + 2, y + 6);
    doc.text(r.name, colX[1] + 2, y + 6);
    doc.text(r.area.toFixed(2), colX[2] + 2, y + 6);
    doc.setTextColor(120);
    doc.text("—", colX[3] + 2, y + 6);
  });

  // Total row
  const totalY = tableTop + rowH + rooms.length * rowH + 2;
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, totalY, contentW, rowH, "F");
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.rect(margin, totalY, contentW, rowH);
  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.text("SHAB (surface habitable totale)", colX[1] + 2, totalY + 6);
  doc.text(`${shab.toFixed(2)} m²`, colX[2] + 2, totalY + 6);

  // Metadata block
  const metaY = totalY + rowH + 12;
  doc.setFontSize(9);
  doc.setTextColor(80);
  const metaLines = [
    `Hauteur sous plafond : ${((plan.ceilingHeight ?? 250) / 100).toFixed(2)} m`,
    `Nombre de pièces : ${rooms.length}`,
    `Murs : ${plan.walls.length} · Ouvertures : ${plan.openings.length}`,
    plan.roof
      ? `Toiture : ${plan.roof.kind === "flat" ? "plate" : plan.roof.kind === "mono" ? "1 pan" : plan.roof.kind === "gable" ? "2 pans" : plan.roof.kind}`
      : "Toiture : non définie",
  ];
  metaLines.forEach((line, i) => doc.text(line, margin, metaY + i * 5));

  drawCartouche("Surfaces & métré", 3, totalPages);

  doc.save(`${projectName || "plan"}_dossier.pdf`);
}
