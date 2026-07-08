import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Circle, Group, Text, Path } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import type { Furniture, Opening, Point, SectionLine, SelectionItem, Wall } from "@/lib/editor/types";
import {
  dist,
  pointOnWall,
  snapAngle,
  snapPoint,
  wallAngle,
  wallLength,
} from "@/lib/editor/geometry";
import { collectJunctions } from "@/lib/editor/wall-geometry";
import { FurnitureShape2D } from "./FurnitureShape2D";



type Props = { onExportRef?: (fn: () => string | null) => void };

export function Canvas2D({ onExportRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1.1);
  const [pos, setPos] = useState({ x: 400, y: 300 });
  const [cursor, setCursor] = useState<Point | null>(null);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [sectionStart, setSectionStart] = useState<Point | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragHandle, setDragHandle] = useState<null | { wallId: string; end: "a" | "b" | "mid"; origA: Point; origB: Point; startPointer: Point }>(null);
  const [openingDrag, setOpeningDrag] = useState<null | { openingId: string; origWallId: string; origT: number; origWidth: number; mode: "move" | "resizeA" | "resizeB" }>(null);
  const [furnitureTransform, setFurnitureTransform] = useState<null | { furnitureId: string; mode: "nw" | "ne" | "se" | "sw" | "rotate"; orig: Furniture }>(null);
  const [moveDrag, setMoveDrag] = useState<null | { items: SelectionItem[]; startPointer: Point; furniture: Furniture[]; walls: Wall[]; sections: SectionLine[] }>(null);
  const [selectionRect, setSelectionRect] = useState<null | { start: Point; current: Point }>(null);
  const [hoverWallForDrop, setHoverWallForDrop] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<null | { kind: "opening" | "furniture"; pos: Point; width: number; height: number; wallId?: string; type?: "door" | "window" }>(null);
  const didFitRef = useRef(false);
  const clipboardRef = useRef<SelectionItem[]>([]);
  const [contextMenu, setContextMenu] = useState<null | { screen: { x: number; y: number }; target: SelectionItem | null }>(null);


  const s = useEditor();
  const {
    plan, tool, selection, grid, snapEnabled, showGrid, showDimensions,
    showExteriorDims, showInteriorDims,
    theme, setTool, setSelection, addWall, addOpening, addFurniture, addSection,
    updateFurniture, updateWall, commit, deleteSelected, undo, redo,
  } = s;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Fit-to-content at mount when the plan has walls.
  useEffect(() => {
    if (didFitRef.current) return;
    if (plan.walls.length === 0 || size.w < 100 || size.h < 100) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of plan.walls) {
      minX = Math.min(minX, w.a.x, w.b.x);
      minY = Math.min(minY, w.a.y, w.b.y);
      maxX = Math.max(maxX, w.a.x, w.b.x);
      maxY = Math.max(maxY, w.a.y, w.b.y);
    }
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    if (bboxW < 1 || bboxH < 1) return;
    const pad = 0.18;
    const s = Math.min(size.w / (bboxW * (1 + pad)), size.h / (bboxH * (1 + pad)));
    const clamped = Math.max(0.2, Math.min(5, s));
    setScale(clamped);
    setPos({
      x: size.w / 2 - ((minX + maxX) / 2) * clamped,
      y: size.h / 2 - ((minY + maxY) / 2) * clamped,
    });
    didFitRef.current = true;
  }, [plan.walls, size.w, size.h]);

  const toWorld = useCallback(
    (p: Point): Point => ({ x: (p.x - pos.x) / scale, y: (p.y - pos.y) / scale }),
    [pos, scale]
  );

  const getWorldPointer = useCallback((): Point | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const p = stage.getPointerPosition();
    if (!p) return null;
    return toWorld(p);
  }, [toWorld]);

  const selectionItems = useMemo<SelectionItem[]>(() => {
    if (!selection) return [];
    return selection.type === "multi" ? selection.items : [selection];
  }, [selection]);

  const isSelected = useCallback((type: SelectionItem["type"], id: string) => (
    selectionItems.some((item) => item.type === type && item.id === id)
  ), [selectionItems]);

  const selectItem = useCallback((item: SelectionItem, additive: boolean) => {
    if (!additive) {
      setSelection(item);
      return;
    }
    const exists = selectionItems.some((sel) => sel.type === item.type && sel.id === item.id);
    const next = exists
      ? selectionItems.filter((sel) => !(sel.type === item.type && sel.id === item.id))
      : [...selectionItems, item];
    setSelection(next.length === 0 ? null : next.length === 1 ? next[0] : { type: "multi", items: next });
  }, [selectionItems, setSelection]);

  const fitToContent = useCallback(() => {
    const points: Point[] = [];
    for (const w of plan.walls) points.push(w.a, w.b);
    for (const f of plan.furniture) {
      points.push({ x: f.x - f.width / 2, y: f.y - f.height / 2 }, { x: f.x + f.width / 2, y: f.y + f.height / 2 });
    }
    if (!points.length) return;
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));
    const bw = Math.max(80, maxX - minX);
    const bh = Math.max(80, maxY - minY);
    const nextScale = Math.max(0.15, Math.min(6, Math.min(size.w / (bw * 1.25), size.h / (bh * 1.25))));
    setScale(nextScale);
    setPos({ x: size.w / 2 - ((minX + maxX) / 2) * nextScale, y: size.h / 2 - ((minY + maxY) / 2) * nextScale });
  }, [plan.furniture, plan.walls, size.h, size.w]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); }
      if (e.key === "Escape") {
        if (drawing) setTool("select");
        setDrawing(null); setRectStart(null); setSectionStart(null); setSelection(null); setSelectionRect(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) { e.preventDefault(); deleteSelected(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && selectionItems.length) {
        e.preventDefault();
        clipboardRef.current = selectionItems;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && clipboardRef.current.length) {
        e.preventDefault();
        s.duplicateItems(clipboardRef.current);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectionItems.length) {
        e.preventDefault();
        s.duplicateItems(selectionItems);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const items: SelectionItem[] = [
          ...s.plan.walls.map((w) => ({ type: "wall" as const, id: w.id })),
          ...s.plan.openings.map((o) => ({ type: "opening" as const, id: o.id })),
          ...s.plan.furniture.map((f) => ({ type: "furniture" as const, id: f.id })),
          ...s.plan.labels.map((l) => ({ type: "label" as const, id: l.id })),
          ...s.plan.sections.map((sec) => ({ type: "section" as const, id: sec.id })),
        ];
        setSelection(items.length ? { type: "multi", items } : null);
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "+") { e.preventDefault(); setScale((v) => Math.min(6, v * 1.1)); }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "-") { e.preventDefault(); setScale((v) => Math.max(0.15, v / 1.1)); }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "0") { e.preventDefault(); fitToContent(); }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const map: Record<string, typeof tool> = {
          v: "select", w: "wall", r: "rectangle", d: "door", f: "window",
          s: "section", e: "eraser",
        };
        const t = map[e.key.toLowerCase()];
        if (t) { e.preventDefault(); setTool(t); return; }
        if (e.key === "1") { s.setView("2d"); return; }
        if (e.key === "2") { s.setView("3d"); return; }
        if (e.key === "3") { s.setView("section"); return; }
      }

      if (selection?.type === "opening") {
        const op = s.plan.openings.find((o) => o.id === selection.id);
        if (!op) return;
        if (e.key === "Tab") {
          e.preventDefault();
          const cur = `${op.hingeSide ?? "a"}${op.swingSide ?? "p"}`;
          const order = ["ap", "bp", "bn", "an"];
          const nextIdx = (order.indexOf(cur) + 1) % order.length;
          const next = order[nextIdx];
          s.updateOpening(op.id, { hingeSide: next[0] as "a" | "b", swingSide: next[1] as "p" | "n" });
        }
        if (e.key === "ArrowLeft") { e.preventDefault(); s.nudgeOpening(op.id, e.shiftKey ? -1 : -5); }
        if (e.key === "ArrowRight") { e.preventDefault(); s.nudgeOpening(op.id, e.shiftKey ? 1 : 5); }
        if (e.key.toLowerCase() === "k" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); s.cycleOpeningKind(op.id, e.shiftKey ? -1 : 1); }
      }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [selection, selectionItems, deleteSelected, undo, redo, setSelection, setTool, drawing, s, tool, fitToContent]);

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.05;
    const newScale = Math.max(0.15, Math.min(6, direction > 0 ? oldScale * factor : oldScale / factor));
    const mp = { x: (pointer.x - pos.x) / oldScale, y: (pointer.y - pos.y) / oldScale };
    setScale(newScale);
    setPos({ x: pointer.x - mp.x * newScale, y: pointer.y - mp.y * newScale });
  };

  const applySnap = (p: Point, refFrom?: Point, ignoreWallId?: string): Point => {
    const magneticThreshold = 18 / scale;
    for (const w of plan.walls) {
      if (w.id === ignoreWallId) continue;
      for (const end of [w.a, w.b]) {
        if (dist(end, p) < magneticThreshold) return { ...end };
      }
    }
    let wallSnap: Point | null = null;
    let wallSnapDist = Infinity;
    for (const w of plan.walls) {
      if (w.id === ignoreWallId) continue;
      const info = pointOnWall(p, w);
      const limit = w.thickness / 2 + 12 / scale;
      if (info.dist < limit && info.dist < wallSnapDist) {
        wallSnap = { x: Math.round(info.closest.x), y: Math.round(info.closest.y) };
        wallSnapDist = info.dist;
      }
    }
    if (wallSnap) return wallSnap;
    let sp = snapEnabled ? snapPoint(p, grid) : p;
    if (refFrom) sp = snapEnabled ? snapPoint(snapAngle(refFrom, sp, 15), grid) : sp;
    return sp;
  };

  const findWallNear = (p: Point) => {
    let best: { wall: Wall; t: number; d: number } | null = null;
    for (const w of plan.walls) {
      const info = pointOnWall(p, w);
      if (info.dist < w.thickness / 2 + 8 / scale) {
        if (!best || info.dist < best.d) best = { wall: w, t: info.t, d: info.dist };
      }
    }
    return best;
  };

  const findFurnitureAt = (p: Point) => {
    for (let i = plan.furniture.length - 1; i >= 0; i--) {
      const f = plan.furniture[i];
      const cos = Math.cos((-f.rotation * Math.PI) / 180);
      const sin = Math.sin((-f.rotation * Math.PI) / 180);
      const dx = p.x - f.x; const dy = p.y - f.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= f.width / 2 && Math.abs(ly) <= f.height / 2) return f;
    }
    return null;
  };

  const itemsInRect = (a: Point, b: Point): SelectionItem[] => {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const inside = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
    const items: SelectionItem[] = [];
    for (const wall of plan.walls) {
      if (inside(wall.a) || inside(wall.b) || inside({ x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 })) {
        items.push({ type: "wall", id: wall.id });
      }
    }
    for (const opening of plan.openings) {
      const wall = plan.walls.find((w) => w.id === opening.wallId);
      if (!wall) continue;
      const p = { x: wall.a.x + (wall.b.x - wall.a.x) * opening.t, y: wall.a.y + (wall.b.y - wall.a.y) * opening.t };
      if (inside(p)) items.push({ type: "opening", id: opening.id });
    }
    for (const f of plan.furniture) {
      if (f.x + f.width / 2 >= minX && f.x - f.width / 2 <= maxX && f.y + f.height / 2 >= minY && f.y - f.height / 2 <= maxY) {
        items.push({ type: "furniture", id: f.id });
      }
    }
    for (const label of plan.labels) if (inside(label)) items.push({ type: "label", id: label.id });
    for (const section of plan.sections) if (inside(section.a) || inside(section.b)) items.push({ type: "section", id: section.id });
    return items;
  };

  const snapWallMove = (a: Point, b: Point, ignoreIds: Set<string>) => {
    const threshold = 18 / scale;
    let best: { d: number; dx: number; dy: number } | null = null;
    for (const p of [a, b]) {
      for (const wall of plan.walls) {
        if (ignoreIds.has(wall.id)) continue;
        for (const end of [wall.a, wall.b]) {
          const d = dist(p, end);
          if (d < threshold && (!best || d < best.d)) best = { d, dx: end.x - p.x, dy: end.y - p.y };
        }
      }
    }
    return best ? { a: { x: a.x + best.dx, y: a.y + best.dy }, b: { x: b.x + best.dx, y: b.y + best.dy } } : { a, b };
  };

  const moveSelectedBy = (drag: NonNullable<typeof moveDrag>, dx: number, dy: number) => {
    const wallIds = new Set(drag.items.filter((item) => item.type === "wall").map((item) => item.id));
    for (const f of drag.furniture) {
      if (f.locked) continue;
      const target = { x: f.x + dx, y: f.y + dy };
      if (f.anchorToWall) {
        const snapped = snapFurnitureToWalls(target, f.width, f.height, f.rotation);
        updateFurniture(f.id, { x: snapped.x, y: snapped.y, rotation: snapped.rotation });
      } else {
        updateFurniture(f.id, { x: Math.round(target.x), y: Math.round(target.y) });
      }
    }
    for (const w of drag.walls) {
      const moved = snapWallMove(
        { x: Math.round(w.a.x + dx), y: Math.round(w.a.y + dy) },
        { x: Math.round(w.b.x + dx), y: Math.round(w.b.y + dy) },
        wallIds,
      );
      updateWall(w.id, moved);
    }
    for (const sec of drag.sections) {
      s.updateSection(sec.id, {
        a: { x: Math.round(sec.a.x + dx), y: Math.round(sec.a.y + dy) },
        b: { x: Math.round(sec.b.x + dx), y: Math.round(sec.b.y + dy) },
      });
    }
  };


  // Hit-test opening at world point — returns the opening + a hint whether the click is on an edge (for resize) or center (for move).
  // For doors, the hit-box includes the arc of debattement area so clicking the swing curve selects the door.
  const findOpeningAt = (p: Point): { opening: Opening; wall: Wall; mode: "move" | "resizeA" | "resizeB" } | null => {
    for (let i = plan.openings.length - 1; i >= 0; i--) {
      const o = plan.openings[i];
      const w = plan.walls.find((ww) => ww.id === o.wallId);
      if (!w) continue;
      const ang = wallAngle(w);
      const len = wallLength(w);
      const cx = w.a.x + Math.cos(ang) * len * o.t;
      const cy = w.a.y + Math.sin(ang) * len * o.t;
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      // Local coords along wall
      const rx = p.x - cx;
      const ry = p.y - cy;
      const along = rx * ux + ry * uy;
      const perp = -rx * uy + ry * ux;
      const halfW = o.width / 2;
      const halfT = w.thickness / 2 + 6 / scale;

      // Primary hit-box: wall cut area
      let hit = Math.abs(along) <= halfW + 4 && Math.abs(perp) <= halfT;

      // Extended hit-box for doors: include arc quadrant so users can click near the swing curve
      if (!hit && (o.type === "door") && (o.kind !== "door_slide" && o.kind !== "door_pocket")) {
        const hinge: "a" | "b" = o.hingeSide ?? "a";
        const swing: "p" | "n" = o.swingSide ?? "p";
        const swingSign = swing === "p" ? 1 : -1;
        // Hinge in local (along, perp) coords: (-halfW, 0) if hinge==a, else (+halfW, 0)
        const ha = hinge === "a" ? -halfW : halfW;
        const dAlong = along - ha;
        const dPerp = perp;
        const r = Math.hypot(dAlong, dPerp);
        // Point must be inside disc of radius = width, on the swing side, and on the leaf side (toward the far end)
        const onSwingSide = swingSign > 0 ? dPerp >= -halfT : dPerp <= halfT;
        const onLeafSide = hinge === "a" ? dAlong >= -6 : dAlong <= 6;
        if (r <= o.width + 6 / scale && onSwingSide && onLeafSide) hit = true;
      }

      if (!hit) continue;

      // Edge zones: outer 20% of the width acts as resize handles (only when on the cut itself)
      const edgeZone = Math.max(6, o.width * 0.2);
      let mode: "move" | "resizeA" | "resizeB" = "move";
      if (Math.abs(perp) <= halfT) {
        if (along < -halfW + edgeZone) mode = "resizeA";
        else if (along > halfW - edgeZone) mode = "resizeB";
      }
      return { opening: o, wall: w, mode };
    }
    return null;
  };

  // Endpoint zone check — returns "a", "b" or null based on cursor proximity to wall ends.
  const wallEndpointHit = (p: Point, w: Wall): "a" | "b" | null => {
    const zone = 22 / scale; // ~22 world cm at 1x zoom
    if (dist(p, w.a) < zone) return "a";
    if (dist(p, w.b) < zone) return "b";
    return null;
  };

  const findFurnitureHandleAt = (p: Point): { furniture: Furniture; mode: "nw" | "ne" | "se" | "sw" | "rotate" } | null => {
    for (let i = plan.furniture.length - 1; i >= 0; i--) {
      const f = plan.furniture[i];
      if (f.locked) continue;
      if (!isSelected("furniture", f.id)) continue;

      const cos = Math.cos((-f.rotation * Math.PI) / 180);
      const sin = Math.sin((-f.rotation * Math.PI) / 180);
      const dx = p.x - f.x, dy = p.y - f.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const hit = 10 / scale;
      const handles = [
        { mode: "nw" as const, x: -f.width / 2, y: -f.height / 2 },
        { mode: "ne" as const, x: f.width / 2, y: -f.height / 2 },
        { mode: "se" as const, x: f.width / 2, y: f.height / 2 },
        { mode: "sw" as const, x: -f.width / 2, y: f.height / 2 },
        { mode: "rotate" as const, x: 0, y: -f.height / 2 - 28 / scale },
      ];
      for (const h of handles) {
        if (Math.hypot(lx - h.x, ly - h.y) <= hit) return { furniture: f, mode: h.mode };
      }
    }
    return null;
  };


  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (spaceDown || e.evt.button === 1) return;
    const wp = getWorldPointer();
    if (!wp) return;

    if (tool === "wall") {
      const snapped = applySnap(wp, drawing?.[drawing.length - 1]);
      if (!drawing) setDrawing([snapped]);
      else {
        const prev = drawing[drawing.length - 1];
        if (dist(prev, snapped) < 5) return;
        addWall({ a: prev, b: snapped, thickness: s.wallSettings[s.currentWallType].thickness });
        setDrawing([...drawing, snapped]);
      }
      return;
    }
    if (tool === "rectangle") {
      const snapped = applySnap(wp);
      if (!rectStart) setRectStart(snapped);
      else {
        const a = rectStart, b = snapped;
        commit();
        const c1={x:a.x,y:a.y}, c2={x:b.x,y:a.y}, c3={x:b.x,y:b.y}, c4={x:a.x,y:b.y};
        addWall({ a: c1, b: c2, thickness: s.wallSettings[s.currentWallType].thickness });
        addWall({ a: c2, b: c3, thickness: s.wallSettings[s.currentWallType].thickness });
        addWall({ a: c3, b: c4, thickness: s.wallSettings[s.currentWallType].thickness });
        addWall({ a: c4, b: c1, thickness: s.wallSettings[s.currentWallType].thickness });
        setRectStart(null);
        setTool("select");
      }
      return;
    }
    if (tool === "section") {
      const snapped = applySnap(wp);
      if (!sectionStart) setSectionStart(snapped);
      else {
        addSection({ a: sectionStart, b: snapped, name: "" });
        setSectionStart(null);
        setTool("select");
      }
      return;
    }
    if (tool === "door" || tool === "window") {
      const hit = findWallNear(wp);
      if (hit) {
        addOpening({
          wallId: hit.wall.id,
          t: Math.max(0.08, Math.min(0.92, hit.t)),
          width: tool === "door" ? 80 : 100,
          type: tool,
        });
        setTool("select");
      }
      return;
    }
    if (tool === "eraser") {
      const f = findFurnitureAt(wp);
      if (f) { setSelection({ type: "furniture", id: f.id }); deleteSelected(); return; }
      const wh = findWallNear(wp);
      if (wh) { setSelection({ type: "wall", id: wh.wall.id }); deleteSelected(); }
      return;
    }
    if (tool === "select") {
      const additive = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      const fh = findFurnitureHandleAt(wp);
      if (fh) {
        commit();
        setSelection({ type: "furniture", id: fh.furniture.id });
        setFurnitureTransform({ furnitureId: fh.furniture.id, mode: fh.mode, orig: { ...fh.furniture } });
        return;
      }
      // Priority order: furniture → opening (edges then body) → wall endpoint → wall body → section
      const f = findFurnitureAt(wp);
      if (f) {
        const item: SelectionItem = { type: "furniture", id: f.id };
        selectItem(item, additive);
        if (!additive) {
          commit();
          const items = isSelected("furniture", f.id) && selectionItems.length > 1 ? selectionItems : [item];
          setMoveDrag({
            items,
            startPointer: wp,
            furniture: plan.furniture.filter((x) => items.some((it) => it.type === "furniture" && it.id === x.id)),
            walls: plan.walls.filter((x) => items.some((it) => it.type === "wall" && it.id === x.id)),
            sections: plan.sections.filter((x) => items.some((it) => it.type === "section" && it.id === x.id)),
          });
        }
        return;
      }

      const oh = findOpeningAt(wp);
      if (oh) {
        selectItem({ type: "opening", id: oh.opening.id }, additive);
        if (additive) return;
        commit();
        setOpeningDrag({
          openingId: oh.opening.id,
          origWallId: oh.wall.id,
          origT: oh.opening.t,
          origWidth: oh.opening.width,
          mode: oh.mode,
        });
        return;
      }

      const wh = findWallNear(wp);
      if (wh) {
        const item: SelectionItem = { type: "wall", id: wh.wall.id };
        const alreadySelected = isSelected("wall", wh.wall.id);
        selectItem(item, additive);
        if (additive) return;
        const endHit = wallEndpointHit(wp, wh.wall);
        if (!endHit && alreadySelected && selectionItems.length > 1) {
          commit();
          const items = selectionItems;
          setMoveDrag({
            items,
            startPointer: wp,
            furniture: plan.furniture.filter((x) => items.some((it) => it.type === "furniture" && it.id === x.id)),
            walls: plan.walls.filter((x) => items.some((it) => it.type === "wall" && it.id === x.id)),
            sections: plan.sections.filter((x) => items.some((it) => it.type === "section" && it.id === x.id)),
          });
          return;
        }
        if (endHit) {
          setDragHandle({
            wallId: wh.wall.id,
            end: endHit,
            origA: { ...wh.wall.a },
            origB: { ...wh.wall.b },
            startPointer: wp,
          });
        } else {
          setDragHandle({
            wallId: wh.wall.id,
            end: "mid",
            origA: { ...wh.wall.a },
            origB: { ...wh.wall.b },
            startPointer: wp,
          });
        }
        commit();
        return;
      }
      for (const sec of plan.sections) {
        const info = pointOnWall(wp, { ...sec, id: sec.id, thickness: 30 } as Wall);
        if (info.dist < 15 / scale) { selectItem({ type: "section", id: sec.id }, additive); return; }
      }
      if (e.evt.shiftKey) setSelectionRect({ start: wp, current: wp });
      else setSelection(null);
    }
  };

  const onMouseMove = () => {
    const wp = getWorldPointer();
    if (!wp) return;
    if (selectionRect) {
      setSelectionRect({ ...selectionRect, current: wp });
      setCursor(wp);
      return;
    }
    if (moveDrag) {
      moveSelectedBy(moveDrag, Math.round(wp.x - moveDrag.startPointer.x), Math.round(wp.y - moveDrag.startPointer.y));
      setCursor(wp);
      return;
    }
    if (furnitureTransform) {
      const f = furnitureTransform.orig;
      const ang = (f.rotation * Math.PI) / 180;
      const cos = Math.cos(-ang);
      const sin = Math.sin(-ang);
      const dx = wp.x - f.x;
      const dy = wp.y - f.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (furnitureTransform.mode === "rotate") {
        const deg = Math.round((Math.atan2(wp.y - f.y, wp.x - f.x) * 180) / Math.PI + 90);
        const snapped = Math.round(deg / 15) * 15;
        updateFurniture(f.id, { rotation: ((snapped % 360) + 360) % 360 });
      } else {
        const keepRatio = false;
        const leftFixed = furnitureTransform.mode === "ne" || furnitureTransform.mode === "se" ? -f.width / 2 : f.width / 2;
        const topFixed = furnitureTransform.mode === "sw" || furnitureTransform.mode === "se" ? -f.height / 2 : f.height / 2;
        let newW = Math.max(20, Math.round(Math.abs(lx - leftFixed)));
        let newH = Math.max(20, Math.round(Math.abs(ly - topFixed)));
        if (keepRatio) {
          const ratio = f.width / Math.max(1, f.height);
          if (newW / newH > ratio) newW = Math.round(newH * ratio);
          else newH = Math.round(newW / ratio);
        }
        const centerLocal = { x: (lx + leftFixed) / 2, y: (ly + topFixed) / 2 };
        const worldCenter = {
          x: f.x + centerLocal.x * Math.cos(ang) - centerLocal.y * Math.sin(ang),
          y: f.y + centerLocal.x * Math.sin(ang) + centerLocal.y * Math.cos(ang),
        };
        updateFurniture(f.id, { x: Math.round(worldCenter.x), y: Math.round(worldCenter.y), width: newW, height: newH });
      }
      setCursor(wp);
      return;
    }
    // Opening drag (move along wall, resize, or transfer to another wall)
    if (openingDrag) {
      const op = plan.openings.find((o) => o.id === openingDrag.openingId);
      const wall = plan.walls.find((w) => w.id === (op?.wallId ?? ""));
      if (!op || !wall) return;
      if (openingDrag.mode === "move") {
        // Check for wall transfer: is cursor closer to a different wall?
        const hit = findWallNear(wp);
        if (hit && hit.wall.id !== wall.id) {
          const wLen = wallLength(hit.wall);
          if (wLen >= op.width + 20) {
            const halfW = op.width / 2 / wLen + 0.02;
            const nt = Math.max(halfW, Math.min(1 - halfW, hit.t));
            s.updateOpening(op.id, { wallId: hit.wall.id, t: nt });
            setHoverWallForDrop(hit.wall.id);
            setCursor(wp);
            return;
          }
        }
        setHoverWallForDrop(null);
        // Project cursor onto wall centerline for t (fine 1 cm precision)
        const info = pointOnWall(wp, wall);
        const wLen = wallLength(wall);
        const halfW = op.width / 2 / wLen + 0.02;
        let nt = Math.max(halfW, Math.min(1 - halfW, info.t));
        // Always round to 1 cm along wall — no coarse 5 cm/grid snapping during drag
        const raw = nt * wLen;
        nt = Math.max(halfW, Math.min(1 - halfW, Math.round(raw) / wLen));
        s.updateOpening(op.id, { t: nt });
      } else {
        // Resize: project cursor along wall, compute new width from opposite anchor (1 cm step)
        const info = pointOnWall(wp, wall);
        const wLen = wallLength(wall);
        const anchorT = openingDrag.mode === "resizeA"
          ? openingDrag.origT + openingDrag.origWidth / 2 / wLen
          : openingDrag.origT - openingDrag.origWidth / 2 / wLen;
        const anchorDist = anchorT * wLen;
        const curDist = info.t * wLen;
        let newW = Math.abs(curDist - anchorDist);
        newW = Math.max(40, Math.min(wLen - 10, Math.round(newW)));
        const newCenter = openingDrag.mode === "resizeA" ? anchorDist - newW / 2 : anchorDist + newW / 2;
        const halfW = newW / 2 / wLen + 0.02;
        const newT = Math.max(halfW, Math.min(1 - halfW, newCenter / wLen));
        s.updateOpening(op.id, { width: newW, t: newT });
      }
      setCursor(wp);
      return;
    }
    // Wall handle drag
    if (dragHandle) {
      const w = plan.walls.find((ww) => ww.id === dragHandle.wallId);
      if (!w) return;
      if (dragHandle.end === "mid") {
        const dx = wp.x - dragHandle.startPointer.x;
        const dy = wp.y - dragHandle.startPointer.y;
        // Fine 1 cm translation (no coarse grid snap) — hold Shift on drop for grid alignment
        const na = { x: Math.round(dragHandle.origA.x + dx), y: Math.round(dragHandle.origA.y + dy) };
        const nb = { x: Math.round(dragHandle.origB.x + dx), y: Math.round(dragHandle.origB.y + dy) };
        updateWall(w.id, snapWallMove(na, nb, new Set([w.id])));
      } else {
        // Endpoint drag: 1 cm precision + snap to nearby wall corners for clean junctions
        const target = applySnap({ x: Math.round(wp.x), y: Math.round(wp.y) }, undefined, w.id);
        updateWall(w.id, { [dragHandle.end]: target } as Partial<Wall>);
      }
      setCursor(wp);
      return;
    }
    if (tool === "wall" && drawing?.length) setCursor(applySnap(wp, drawing[drawing.length - 1]));
    else if (tool === "rectangle" && rectStart) setCursor(applySnap(wp));
    else if (tool === "section" && sectionStart) setCursor(applySnap(wp));
    else setCursor(wp);
  };

  const onMouseUp = () => {
    if (selectionRect) {
      const items = itemsInRect(selectionRect.start, selectionRect.current);
      setSelection(items.length === 0 ? null : items.length === 1 ? items[0] : { type: "multi", items });
      setSelectionRect(null);
    }
    if (moveDrag) setMoveDrag(null);
    if (furnitureTransform) setFurnitureTransform(null);
    if (dragHandle) setDragHandle(null);
    if (openingDrag) setOpeningDrag(null);
    if (hoverWallForDrop) setHoverWallForDrop(null);
  };


  const onDblClick = () => { if (tool === "wall") { setDrawing(null); setTool("select"); } };

  const snapFurnitureToWalls = (pos: Point, w: number, h: number, rotation = 0): Point & { rotation: number } => {
    const threshold = 25 / scale;
    let best: { d: number; snap: Point & { rotation: number } } | null = null;
    for (const wall of plan.walls) {
      const info = pointOnWall(pos, wall);
      if (info.dist < threshold + Math.max(w, h) / 2) {
        // project the furniture so its closest edge touches the wall centerline offset by wall.thickness/2 + half furniture depth
        const ang = wallAngle(wall);
        const nx = Math.cos(ang - Math.PI / 2);
        const ny = Math.sin(ang - Math.PI / 2);
        const rel = { x: pos.x - info.closest.x, y: pos.y - info.closest.y };
        const side = rel.x * nx + rel.y * ny >= 0 ? 1 : -1;
        const offset = wall.thickness / 2 + Math.min(w, h) / 2;
        const snapped = {
          x: info.closest.x + nx * side * offset,
          y: info.closest.y + ny * side * offset,
          rotation: Math.round((ang * 180) / Math.PI),
        };
        const d = Math.hypot(pos.x - snapped.x, pos.y - snapped.y);
        if (!best || d < best.d) best = { d, snap: snapped };
      }
    }
    return best ? best.snap : { ...pos, rotation };
  };

  const onDropHtml = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = toWorld(screen);

    // Opening drag (door/window) — snap to nearest wall
    const openingRaw = e.dataTransfer.getData("application/x-opening");
    if (openingRaw) {
      try {
        const o = JSON.parse(openingRaw) as { kind: "door" | "window"; subKind?: import("@/lib/editor/types").OpeningKind; label: string; width: number; height: number; sillHeight: number };
        const hit = findWallNear(world);
        if (hit) {
          const id = addOpening({
            wallId: hit.wall.id,
            t: Math.max(0.08, Math.min(0.92, hit.t)),
            width: o.width,
            type: o.kind,
            kind: o.subKind ?? (o.kind === "door" ? "door_simple" : "window_1"),
            height: o.height,
            sillHeight: o.sillHeight,
          });
          setSelection({ type: "opening", id });
          setTool("select");
        }
      } catch { /* ignore */ }
      return;
    }

    const kind = e.dataTransfer.getData("application/x-furniture");
    if (!kind) return;
    const item = CATALOG.find((c) => c.kind === kind && c.label === e.dataTransfer.getData("application/x-furniture-label"))
      || CATALOG.find((c) => c.kind === kind);
    if (!item) return;
    const base = snapEnabled ? snapPoint(world, grid / 2) : world;
    const snapped = snapFurnitureToWalls(base, item.width, item.height);
    addFurniture({
      kind: item.kind, x: snapped.x, y: snapped.y,
      width: item.width, height: item.height, rotation: snapped.rotation, label: item.label,
    });
  };

  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const step = grid;
    const majorEvery = 5;
    const x0 = Math.floor(-pos.x / scale / step) * step - step;
    const y0 = Math.floor(-pos.y / scale / step) * step - step;
    const x1 = x0 + size.w / scale + step * 3;
    const y1 = y0 + size.h / scale + step * 3;
    const lines: React.ReactNode[] = [];
    for (let x = x0; x <= x1; x += step) {
      const major = Math.round(x / step) % majorEvery === 0;
      lines.push(<Line key={`v${x}`} points={[x, y0, x, y1]} stroke={major ? theme.gridMajor : theme.grid} strokeWidth={(major ? 1 : 0.5) / scale} listening={false} />);
    }
    for (let y = y0; y <= y1; y += step) {
      const major = Math.round(y / step) % majorEvery === 0;
      lines.push(<Line key={`h${y}`} points={[x0, y, x1, y]} stroke={major ? theme.gridMajor : theme.grid} strokeWidth={(major ? 1 : 0.5) / scale} listening={false} />);
    }
    lines.push(<Circle key="o" x={0} y={0} radius={3 / scale} fill={theme.dimension} listening={false} />);
    return lines;
  }, [showGrid, grid, pos, scale, size, theme]);

  // Floor polygon — union of enclosed area computed via bounding box of walls
  const floorRect = useMemo(() => {
    if (plan.walls.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const w of plan.walls) {
      minX = Math.min(minX, w.a.x, w.b.x);
      minY = Math.min(minY, w.a.y, w.b.y);
      maxX = Math.max(maxX, w.a.x, w.b.x);
      maxY = Math.max(maxY, w.a.y, w.b.y);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [plan.walls]);

  const renderWall = (w: Wall) => {
    const isSel = isSelected("wall", w.id);
    return (
      <Line
        key={w.id}
        points={[w.a.x, w.a.y, w.b.x, w.b.y]}
        stroke={isSel ? "#c9a961" : theme.wallFill}
        strokeWidth={w.thickness}
        lineCap="butt"
        listening={false}
      />
    );
  };

  const junctions = useMemo(() => collectJunctions(plan), [plan]);

  const renderOpening = (o: Opening) => {
    const w = plan.walls.find((ww) => ww.id === o.wallId);
    if (!w) return null;
    const ang = wallAngle(w);
    const len = wallLength(w);
    const cx = w.a.x + Math.cos(ang) * len * o.t;
    const cy = w.a.y + Math.sin(ang) * len * o.t;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const dx = ux * o.width / 2;
    const dy = uy * o.width / 2;
    const isSel = isSelected("opening", o.id);
    const hinge: "a" | "b" = o.hingeSide ?? "a";
    const swing: "p" | "n" = o.swingSide ?? "p";
    const swingSign = swing === "p" ? 1 : -1;
    // Perpendicular unit vector (rotated +90°)
    const nxP = -uy * swingSign;
    const nyP = ux * swingSign;
    // Hinge point and leaf tip
    const hx = hinge === "a" ? cx - dx : cx + dx;
    const hy = hinge === "a" ? cy - dy : cy + dy;
    const leafDir = hinge === "a" ? 1 : -1; // direction along wall from hinge to tip
    const lx = hx + ux * o.width * leafDir;
    const ly = hy + uy * o.width * leafDir;
    // Tip of the arc: swing perpendicular from hinge
    const tipX = hx + nxP * o.width;
    const tipY = hy + nyP * o.width;

    const stroke = isSel ? "#c9a961" : theme.openingStroke;
    const sw = 1.5 / scale;
    const kind = o.kind ?? (o.type === "door" ? "door_simple" : "window_1");

    // Path helpers
    // Arc from (hx,hy) → sweep by 90° toward perp side, radius = o.width
    // Konva Path arc: A rx ry x-axis-rot large-arc sweep x y
    const sweep = (hinge === "a" ? 1 : 0) ^ (swing === "p" ? 0 : 1); // choose correct arc side
    const arcOnly = `M ${hx} ${hy} A ${o.width} ${o.width} 0 0 ${sweep} ${tipX} ${tipY}`;

    const wallCut = (
      <Line
        points={[cx - dx, cy - dy, cx + dx, cy + dy]}
        stroke={theme.background}
        strokeWidth={w.thickness + 2}
        lineCap="butt"
        listening={false}
      />
    );

    // Door-family renderers
    // Jambages (short perpendicular ticks at both ends of the cut), typical architectural convention.
    const jambageLen = w.thickness * 0.9;
    const jambages = (kind === "door_simple" || kind === "door_double" || kind === "entrance" || kind === "door_slide" || kind === "door_pocket") ? (
      <>
        <Line points={[cx - dx - (-uy) * jambageLen / 2, cy - dy - ux * jambageLen / 2, cx - dx + (-uy) * jambageLen / 2, cy - dy + ux * jambageLen / 2]} stroke={stroke} strokeWidth={sw * 0.7} listening={false} />
        <Line points={[cx + dx - (-uy) * jambageLen / 2, cy + dy - ux * jambageLen / 2, cx + dx + (-uy) * jambageLen / 2, cy + dy + ux * jambageLen / 2]} stroke={stroke} strokeWidth={sw * 0.7} listening={false} />
      </>
    ) : null;

    let symbol: React.ReactNode = null;
    if (kind === "door_simple" || kind === "entrance") {
      symbol = (
        <>
          {jambages}
          <Path data={arcOnly} stroke={stroke} strokeWidth={sw * 0.7} fill="transparent" />
          <Line points={[hx, hy, tipX, tipY]} stroke={stroke} strokeWidth={sw * 1.6} lineCap="round" />
          {kind === "entrance" && (
            <Rect x={cx - dx} y={cy - dy - w.thickness / 3} width={o.width} height={w.thickness / 1.5} rotation={(ang * 180) / Math.PI} stroke={stroke} strokeWidth={sw * 0.6} fill="transparent" />
          )}
        </>
      );
    } else if (kind === "door_double") {
      const midX = (hx + lx) / 2;
      const midY = (hy + ly) / 2;
      const tipL = { x: hx + nxP * (o.width / 2), y: hy + nyP * (o.width / 2) };
      const tipR = { x: lx + nxP * (o.width / 2), y: ly + nyP * (o.width / 2) };
      const swA = (hinge === "a" ? 1 : 0) ^ (swing === "p" ? 0 : 1);
      const swB = (hinge === "a" ? 0 : 1) ^ (swing === "p" ? 0 : 1);
      symbol = (
        <>
          {jambages}
          <Path data={`M ${hx} ${hy} A ${o.width / 2} ${o.width / 2} 0 0 ${swA} ${tipL.x} ${tipL.y}`} stroke={stroke} strokeWidth={sw * 0.7} fill="transparent" />
          <Path data={`M ${lx} ${ly} A ${o.width / 2} ${o.width / 2} 0 0 ${swB} ${tipR.x} ${tipR.y}`} stroke={stroke} strokeWidth={sw * 0.7} fill="transparent" />
          <Line points={[hx, hy, midX, midY]} stroke={stroke} strokeWidth={sw * 1.6} lineCap="round" />
          <Line points={[midX, midY, lx, ly]} stroke={stroke} strokeWidth={sw * 1.6} lineCap="round" />
        </>
      );
    } else if (kind === "door_slide") {
      const off = w.thickness / 3 * swingSign;
      const offx = -uy * off;
      const offy = ux * off;
      symbol = (
        <>
          <Line points={[cx - dx + offx, cy - dy + offy, cx + dx + offx, cy + dy + offy]} stroke={stroke} strokeWidth={sw} />
          <Rect
            x={cx - dx + offx} y={cy - dy + offy}
            width={o.width} height={4 / scale}
            rotation={(ang * 180) / Math.PI}
            stroke={stroke} strokeWidth={sw * 0.7} fill="transparent"
          />
          <Line points={[cx - dx + offx, cy - dy + offy - 3 / scale, cx - dx + offx + ux * 8 / scale, cy - dy + offy - 3 / scale + uy * 8 / scale]} stroke={stroke} strokeWidth={sw * 0.7} />
        </>
      );
    } else if (kind === "door_pocket") {
      symbol = (
        <>
          <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw} dash={[3 / scale, 3 / scale]} />
        </>
      );
    } else if (kind === "window_1") {
      const off = w.thickness / 3;
      const p1x = -uy * off, p1y = ux * off;
      symbol = (
        <>
          <Line points={[cx - dx + p1x, cy - dy + p1y, cx + dx + p1x, cy + dy + p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx - p1x, cy - dy - p1y, cx + dx - p1x, cy + dy - p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw} />
        </>
      );
    } else if (kind === "window_2") {
      const off = w.thickness / 3;
      const p1x = -uy * off, p1y = ux * off;
      const midX = cx, midY = cy;
      symbol = (
        <>
          <Line points={[cx - dx + p1x, cy - dy + p1y, cx + dx + p1x, cy + dy + p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx - p1x, cy - dy - p1y, cx + dx - p1x, cy + dy - p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw} />
          <Line points={[midX - uy * (w.thickness / 2), midY + ux * (w.thickness / 2), midX + uy * (w.thickness / 2), midY - ux * (w.thickness / 2)]} stroke={stroke} strokeWidth={sw * 0.6} />
        </>
      );
    } else if (kind === "window_oscillo") {
      const off = w.thickness / 3;
      const p1x = -uy * off, p1y = ux * off;
      symbol = (
        <>
          <Line points={[cx - dx + p1x, cy - dy + p1y, cx + dx + p1x, cy + dy + p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx - p1x, cy - dy - p1y, cx + dx - p1x, cy + dy - p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw} />
          {/* triangle oscillo symbol */}
          <Line points={[cx - dx, cy - dy, cx, cy + nyP * w.thickness / 2, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw * 0.7} />
        </>
      );
    } else if (kind === "bay" || kind === "bay_slide") {
      const off = w.thickness / 4;
      const p1x = -uy * off, p1y = ux * off;
      symbol = (
        <>
          <Line points={[cx - dx + p1x, cy - dy + p1y, cx + dx + p1x, cy + dy + p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx - p1x, cy - dy - p1y, cx + dx - p1x, cy + dy - p1y]} stroke={stroke} strokeWidth={sw * 0.6} />
          <Line points={[cx - dx, cy - dy, cx, cy]} stroke={stroke} strokeWidth={sw} />
          <Line points={[cx + ux * 2 / scale, cy + uy * 2 / scale, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw} />
          {kind === "bay_slide" && (
            <Line
              points={[cx - dx + ux * 4 / scale, cy - dy + uy * 4 / scale - 4 / scale, cx + dx - ux * 4 / scale, cy + dy - uy * 4 / scale - 4 / scale]}
              stroke={stroke} strokeWidth={sw * 0.5} dash={[3 / scale, 2 / scale]}
            />
          )}
        </>
      );
    } else if (kind === "fixed") {
      symbol = (
        <>
          <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={stroke} strokeWidth={sw} />
          <Line points={[cx - dx + ux * 4 / scale, cy - dy + uy * 4 / scale, cx + dx - ux * 4 / scale, cy + dy - uy * 4 / scale]} stroke={stroke} strokeWidth={sw * 0.5} dash={[2 / scale, 2 / scale]} />
        </>
      );
    }

    return (
      <Group key={o.id}>
        {wallCut}
        {symbol}
        {isSel && (kind === "door_simple" || kind === "door_double" || kind === "entrance") && (
          <>
            {/* Flip hinge handle — near hinge end */}
            <Group
              x={hx + nxP * (w.thickness / 2 + 14 / scale)}
              y={hy + nyP * (w.thickness / 2 + 14 / scale)}
              onMouseDown={(e) => { e.cancelBubble = true; s.flipOpeningHinge(o.id); }}
              onTap={(e) => { e.cancelBubble = true; s.flipOpeningHinge(o.id); }}
            >
              <Circle radius={11 / scale} fill="#ffffff" stroke="#c9a961" strokeWidth={2 / scale} shadowColor="rgba(0,0,0,0.25)" shadowBlur={4 / scale} />
              <Text text="⇄" fontSize={13 / scale} fill="#3d2f22" offsetX={4 / scale} offsetY={7 / scale} listening={false} />
            </Group>
            {/* Flip swing handle — opposite side */}
            <Group
              x={cx - nxP * (w.thickness / 2 + 14 / scale)}
              y={cy - nyP * (w.thickness / 2 + 14 / scale)}
              onMouseDown={(e) => { e.cancelBubble = true; s.flipOpeningSwing(o.id); }}
              onTap={(e) => { e.cancelBubble = true; s.flipOpeningSwing(o.id); }}
            >
              <Circle radius={11 / scale} fill="#ffffff" stroke="#c9a961" strokeWidth={2 / scale} shadowColor="rgba(0,0,0,0.25)" shadowBlur={4 / scale} />
              <Text text="⇅" fontSize={13 / scale} fill="#3d2f22" offsetX={4 / scale} offsetY={7 / scale} listening={false} />
            </Group>
          </>
        )}
        {isSel && (
          <>
            <Rect
              x={cx - dx - 2 / scale} y={cy - dy - w.thickness / 2 - 2 / scale}
              width={o.width + 4 / scale} height={w.thickness + 4 / scale}
              rotation={(ang * 180) / Math.PI}
              stroke="#c9a961" strokeWidth={1 / scale} dash={[4 / scale, 3 / scale]} fill="transparent" listening={false}
            />
            {/* End resize handles — chevron arrows aligned with the wall axis */}
            {(["a", "b"] as const).map((end) => {
              const ex = end === "a" ? cx - dx : cx + dx;
              const ey = end === "a" ? cy - dy : cy + dy;
              return (
                <Group key={`h${end}`} x={ex} y={ey} listening={false}>
                  <Circle radius={9 / scale} fill="#ffffff" stroke="#c9a961" strokeWidth={1.5 / scale} shadowColor="rgba(0,0,0,0.25)" shadowBlur={4 / scale} />
                  <Text text="↔" fontSize={12 / scale} fontStyle="bold" fill="#3d2f22" offsetX={5 / scale} offsetY={6 / scale} rotation={(ang * 180) / Math.PI} />
                </Group>
              );
            })}
          </>
        )}
      </Group>
    );
  };

  const renderDim = (w: Wall) => {
    if (!showDimensions) return null;
    const len = wallLength(w);
    if (len < 20) return null;
    const ang = wallAngle(w);
    const off = w.thickness / 2 + 18 / scale + 6;
    const nx = Math.cos(ang - Math.PI / 2);
    const ny = Math.sin(ang - Math.PI / 2);
    // Endpoints on the dimension line (parallel to wall, offset outward)
    const ax = w.a.x + nx * off;
    const ay = w.a.y + ny * off;
    const bx = w.b.x + nx * off;
    const by = w.b.y + ny * off;
    // Tick marks (perpendicular short segments)
    const tick = 5 / scale;
    // Extension lines from wall face to dim line
    const extFrom = w.thickness / 2 + 2 / scale;
    const label = len >= 100 ? `${(len / 100).toFixed(2)} m` : `${Math.round(len)} cm`;
    let deg = (ang * 180) / Math.PI;
    let flipped = false;
    if (deg > 90 || deg < -90) { deg += 180; flipped = true; }
    const strokeCol = theme.dimension;
    // Label anchored near "start" end (leftmost when reading) — use a-side
    // Position label offset slightly outside from dim line
    const labelOffset = 8 / scale;
    const lx = ax + nx * labelOffset + Math.cos(ang) * 6 / scale;
    const ly = ay + ny * labelOffset + Math.sin(ang) * 6 / scale;
    return (
      <Group key={`d${w.id}`} listening={false}>
        {/* extension lines */}
        <Line points={[w.a.x + nx * extFrom, w.a.y + ny * extFrom, ax + nx * (2 / scale), ay + ny * (2 / scale)]} stroke={strokeCol} strokeWidth={0.6 / scale} />
        <Line points={[w.b.x + nx * extFrom, w.b.y + ny * extFrom, bx + nx * (2 / scale), by + ny * (2 / scale)]} stroke={strokeCol} strokeWidth={0.6 / scale} />
        {/* dim line */}
        <Line points={[ax, ay, bx, by]} stroke={strokeCol} strokeWidth={0.8 / scale} />
        {/* end ticks (short 45° slashes typical of architectural drawings) */}
        <Line points={[ax - Math.cos(ang) * tick + nx * tick, ay - Math.sin(ang) * tick + ny * tick, ax + Math.cos(ang) * tick - nx * tick, ay + Math.sin(ang) * tick - ny * tick]} stroke={strokeCol} strokeWidth={1 / scale} />
        <Line points={[bx - Math.cos(ang) * tick + nx * tick, by - Math.sin(ang) * tick + ny * tick, bx + Math.cos(ang) * tick - nx * tick, by + Math.sin(ang) * tick - ny * tick]} stroke={strokeCol} strokeWidth={1 / scale} />
        {/* label */}
        <Text
          x={flipped ? bx - Math.cos(ang) * 6 / scale + nx * labelOffset : lx}
          y={flipped ? by - Math.sin(ang) * 6 / scale + ny * labelOffset : ly}
          text={label}
          fontSize={11 / scale}
          fontFamily="JetBrains Mono"
          fill={strokeCol}
          rotation={deg}
          offsetY={13 / scale}
        />
      </Group>
    );
  };

  // Overall perimeter dimensions — aligned on real wall faces (outer for "extérieur", inner for "intérieur")
  const perimeterDims = useMemo(() => {
    if (!showExteriorDims && !showInteriorDims) return null;
    if (plan.walls.length === 0) return null;

    let outMinX = Infinity, outMinY = Infinity, outMaxX = -Infinity, outMaxY = -Infinity;
    let cenMinX = Infinity, cenMinY = Infinity, cenMaxX = -Infinity, cenMaxY = -Infinity;
    let maxT = 0;
    for (const w of plan.walls) {
      const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const h = w.thickness / 2;
      const corners: Point[] = [
        { x: w.a.x + nx * h, y: w.a.y + ny * h },
        { x: w.a.x - nx * h, y: w.a.y - ny * h },
        { x: w.b.x + nx * h, y: w.b.y + ny * h },
        { x: w.b.x - nx * h, y: w.b.y - ny * h },
      ];
      for (const c of corners) {
        outMinX = Math.min(outMinX, c.x); outMinY = Math.min(outMinY, c.y);
        outMaxX = Math.max(outMaxX, c.x); outMaxY = Math.max(outMaxY, c.y);
      }
      cenMinX = Math.min(cenMinX, w.a.x, w.b.x);
      cenMinY = Math.min(cenMinY, w.a.y, w.b.y);
      cenMaxX = Math.max(cenMaxX, w.a.x, w.b.x);
      cenMaxY = Math.max(cenMaxY, w.a.y, w.b.y);
      if (w.thickness > maxT) maxT = w.thickness;
    }
    const inMinX = cenMinX + maxT / 2;
    const inMaxX = cenMaxX - maxT / 2;
    const inMinY = cenMinY + maxT / 2;
    const inMaxY = cenMaxY - maxT / 2;

    const col = theme.dimension;
    const nodes: React.ReactNode[] = [];
    const tick = 5 / scale;
    const gap = 3 / scale;

    const drawH = (x0: number, x1: number, yFace: number, yDim: number, key: string) => {
      const len = Math.abs(x1 - x0);
      const label = `${Math.round(len)}`;

      const dir = yDim >= yFace ? 1 : -1;
      // extension lines stop exactly at the dim line (no overshoot)
      nodes.push(<Line key={`e1${key}`} points={[x0, yFace + dir * gap, x0, yDim]} stroke={col} strokeWidth={0.5 / scale} listening={false} />);
      nodes.push(<Line key={`e2${key}`} points={[x1, yFace + dir * gap, x1, yDim]} stroke={col} strokeWidth={0.5 / scale} listening={false} />);
      nodes.push(<Line key={`d${key}`} points={[x0, yDim, x1, yDim]} stroke={col} strokeWidth={0.8 / scale} listening={false} />);
      nodes.push(<Line key={`t1${key}`} points={[x0 - tick, yDim - tick, x0 + tick, yDim + tick]} stroke={col} strokeWidth={1 / scale} listening={false} />);
      nodes.push(<Line key={`t2${key}`} points={[x1 - tick, yDim - tick, x1 + tick, yDim + tick]} stroke={col} strokeWidth={1 / scale} listening={false} />);
      // centered label placed just OUTSIDE the dim line (opposite side from the wall)
      const labelY = dir > 0 ? yDim + 5 / scale : yDim - 17 / scale;
      nodes.push(
        <Text key={`x${key}`}
          x={(x0 + x1) / 2 - 80 / scale}
          y={labelY}
          width={160 / scale} align="center" text={label}
          fontSize={11 / scale} fontFamily="JetBrains Mono" fill={col} listening={false} />
      );
    };

    const drawV = (y0: number, y1: number, xFace: number, xDim: number, key: string) => {
      const len = Math.abs(y1 - y0);
      const label = `${Math.round(len)}`;

      const dir = xDim >= xFace ? 1 : -1;
      nodes.push(<Line key={`e1${key}`} points={[xFace + dir * gap, y0, xDim, y0]} stroke={col} strokeWidth={0.5 / scale} listening={false} />);
      nodes.push(<Line key={`e2${key}`} points={[xFace + dir * gap, y1, xDim, y1]} stroke={col} strokeWidth={0.5 / scale} listening={false} />);
      nodes.push(<Line key={`d${key}`} points={[xDim, y0, xDim, y1]} stroke={col} strokeWidth={0.8 / scale} listening={false} />);
      nodes.push(<Line key={`t1${key}`} points={[xDim - tick, y0 - tick, xDim + tick, y0 + tick]} stroke={col} strokeWidth={1 / scale} listening={false} />);
      nodes.push(<Line key={`t2${key}`} points={[xDim - tick, y1 - tick, xDim + tick, y1 + tick]} stroke={col} strokeWidth={1 / scale} listening={false} />);
      // rotated -90° text placed just OUTSIDE the dim line
      const labelX = dir > 0 ? xDim + 5 / scale : xDim - 17 / scale;
      nodes.push(
        <Text key={`x${key}`}
          x={labelX}
          y={(y0 + y1) / 2 + 80 / scale}
          rotation={-90}
          width={160 / scale} align="center" text={label}
          fontSize={11 / scale} fontFamily="JetBrains Mono" fill={col} listening={false} />
      );
    };

    const OFF1 = 40 / scale;
    const OFF2 = 40 / scale;

    if (showExteriorDims) {
      drawH(outMinX, outMaxX, outMaxY, outMaxY + OFF1, "extH_bot");
      drawV(outMinY, outMaxY, outMinX, outMinX - OFF1, "extV_left");
    }
    if (showInteriorDims) {
      drawH(inMinX, inMaxX, outMinY, outMinY - OFF2, "intH_top");
      drawV(inMinY, inMaxY, outMaxX, outMaxX + OFF2, "intV_right");
    }
    return nodes;
  }, [plan.walls, scale, theme.dimension, showExteriorDims, showInteriorDims]);

  const renderFurniture = (f: Furniture) => {
    const isSel = isSelected("furniture", f.id);
    const strokeColor = isSel ? "#c9a961" : theme.furnitureStroke;
    return (
      <Group
        key={f.id} x={f.x} y={f.y} rotation={f.rotation}
        listening={false}
      >
        <FurnitureShape2D f={f} strokeColor={strokeColor} />
        {isSel && (
          <>
            <Rect
              x={-f.width / 2 - 2 / scale} y={-f.height / 2 - 2 / scale} width={f.width + 4 / scale} height={f.height + 4 / scale}
              stroke="#c9a961" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false}
            />
            {([[-1, -1, "nw"], [1, -1, "ne"], [1, 1, "se"], [-1, 1, "sw"]] as const).map(([sx, sy, key]) => (
              <Rect
                key={key}
                x={sx * f.width / 2 - 5 / scale}
                y={sy * f.height / 2 - 5 / scale}
                width={10 / scale}
                height={10 / scale}
                fill="#ffffff"
                stroke="#c9a961"
                strokeWidth={1.5 / scale}
                cornerRadius={1 / scale}
                listening={false}
              />
            ))}
            <Line points={[0, -f.height / 2, 0, -f.height / 2 - 22 / scale]} stroke="#c9a961" strokeWidth={1 / scale} listening={false} />
            <Circle x={0} y={-f.height / 2 - 28 / scale} radius={6 / scale} fill="#ffffff" stroke="#c9a961" strokeWidth={1.5 / scale} listening={false} />
          </>
        )}
      </Group>
    );
  };

  const renderSection = (sec: SectionLine) => {
    const isSel = isSelected("section", sec.id);
    const ang = Math.atan2(sec.b.y - sec.a.y, sec.b.x - sec.a.x);
    const nx = Math.cos(ang - Math.PI / 2);
    const ny = Math.sin(ang - Math.PI / 2);
    const off = 18 / scale;
    return (
      <Group key={sec.id}>
        <Line
          points={[sec.a.x, sec.a.y, sec.b.x, sec.b.y]}
          stroke={isSel ? "#c9a961" : "#d94747"}
          strokeWidth={2 / scale}
          dash={[18 / scale, 6 / scale, 2 / scale, 6 / scale]}
          onClick={(e) => tool === "select" && selectItem({ type: "section", id: sec.id }, e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey)}
          hitStrokeWidth={20 / scale}
        />
        {[sec.a, sec.b].map((p, i) => (
          <Group key={i} x={p.x + nx * off} y={p.y + ny * off}>
            <Circle radius={9 / scale} fill="#d94747" stroke="#fff" strokeWidth={1 / scale} />
            <Text text={sec.name + (i === 0 ? "" : "'")} fontSize={11 / scale} fontFamily="Inter" fontStyle="bold" fill="#fff" offsetX={4 / scale} offsetY={5.5 / scale} listening={false} />
          </Group>
        ))}
      </Group>
    );
  };

  const previewLine =
    tool === "wall" && drawing?.length && cursor
      ? (<Line points={[drawing[drawing.length - 1].x, drawing[drawing.length - 1].y, cursor.x, cursor.y]} stroke="#c9a961" strokeWidth={s.wallSettings[s.currentWallType].thickness} opacity={0.4} dash={[8, 6]} listening={false} />)
      : null;
  const previewRect =
    tool === "rectangle" && rectStart && cursor
      ? (<Rect x={Math.min(rectStart.x, cursor.x)} y={Math.min(rectStart.y, cursor.y)} width={Math.abs(cursor.x - rectStart.x)} height={Math.abs(cursor.y - rectStart.y)} stroke="#c9a961" strokeWidth={2 / scale} dash={[6 / scale, 4 / scale]} fill="rgba(201,169,97,0.06)" listening={false} />)
      : null;
  const previewSection =
    tool === "section" && sectionStart && cursor
      ? (<Line points={[sectionStart.x, sectionStart.y, cursor.x, cursor.y]} stroke="#d94747" strokeWidth={2 / scale} dash={[18 / scale, 6 / scale, 2 / scale, 6 / scale]} listening={false} />)
      : null;

  useEffect(() => {
    if (!onExportRef) return;
    onExportRef(() => {
      const stage = stageRef.current;
      if (!stage) return null;
      return stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
    });
  }, [onExportRef]);

  const selectedWall = selection?.type === "wall" ? plan.walls.find((w) => w.id === selection.id) : null;

  // Cursor hint based on what's under the pointer (select mode only).
  const cursorStyle = (() => {
    if (spaceDown) return "grab";
    if (tool !== "select") return "crosshair";
    if (dragHandle || openingDrag || moveDrag || furnitureTransform) return "grabbing";
    if (selectionRect) return "crosshair";
    if (!cursor) return "default";
    // Hover checks
    const fh = findFurnitureHandleAt(cursor);
    if (fh) {
      if (fh.mode === "rotate") return "grab";
      return fh.mode === "nw" || fh.mode === "se" ? "nwse-resize" : "nesw-resize";
    }
    if (findFurnitureAt(cursor)) return "move";
    const oh = findOpeningAt(cursor);
    if (oh) return oh.mode === "move" ? "move" : "ew-resize";
    const wh = findWallNear(cursor);
    if (wh) {
      const end = wallEndpointHit(cursor, wh.wall);
      if (end) {
        // Direction hint based on wall orientation.
        const ang = wallAngle(wh.wall);
        const deg = Math.abs((ang * 180) / Math.PI) % 180;
        return deg < 22 || deg > 158 ? "ew-resize" : deg > 68 && deg < 112 ? "ns-resize" : "nwse-resize";
      }
      return "move";
    }
    return "default";
  })();

  const stageDraggable = (spaceDown || tool === "select") && !dragHandle && !openingDrag && !moveDrag && !furnitureTransform && !selectionRect;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: theme.background, cursor: cursorStyle }}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const world = toWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const types = e.dataTransfer.types;
        if (types.includes("application/x-opening")) {
          const hit = findWallNear(world);
          if (hit) {
            const ang = wallAngle(hit.wall);
            const cx = hit.wall.a.x + Math.cos(ang) * wallLength(hit.wall) * hit.t;
            const cy = hit.wall.a.y + Math.sin(ang) * wallLength(hit.wall) * hit.t;
            setDragPreview({ kind: "opening", pos: { x: cx, y: cy }, width: 100, height: hit.wall.thickness, wallId: hit.wall.id });
          } else {
            setDragPreview({ kind: "opening", pos: world, width: 100, height: 30 });
          }
        } else if (types.includes("application/x-furniture")) {
          setDragPreview({ kind: "furniture", pos: snapFurnitureToWalls(world, 60, 60), width: 60, height: 60 });
        }
      }}
      onDragLeave={() => setDragPreview(null)}
      onDrop={(e) => { setDragPreview(null); onDropHtml(e); }}
      onContextMenu={(e) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const world = toWorld(screen);
        let target: SelectionItem | null = null;
        const f = findFurnitureAt(world);
        if (f) target = { type: "furniture", id: f.id };
        else {
          const oh = findOpeningAt(world);
          if (oh) target = { type: "opening", id: oh.opening.id };
          else {
            const wh = findWallNear(world);
            if (wh) target = { type: "wall", id: wh.wall.id };
          }
        }
        if (target) setSelection(target);
        setContextMenu({ screen, target });
      }}
    >
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
        draggable={stageDraggable}
        onDragStart={(e) => {
          if (e.target !== e.target.getStage() || e.evt.shiftKey) {
            e.target.stopDrag();
          }
        }}
        onDragEnd={(e) => { if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() }); }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onDblClick={onDblClick}
      >

        <Layer listening={false}>{gridLines}</Layer>
        <Layer>
          {floorRect && (
            <Rect x={floorRect.x} y={floorRect.y} width={floorRect.w} height={floorRect.h} fill={theme.floor} listening={false} />
          )}
          {plan.furniture.map(renderFurniture)}
          {plan.walls.map(renderWall)}
          {/* square junction patches: clean architectural corners, no rounded wall caps */}
          {junctions.map((j, i) => (
            <Rect key={`j${i}`} x={j.p.x - j.radius} y={j.p.y - j.radius} width={j.radius * 2} height={j.radius * 2} fill={theme.wallFill} listening={false} />
          ))}
          {plan.openings.map(renderOpening)}
          {/* per-wall dims removed — only overall exterior/interior perimeter dims are shown */}
          {perimeterDims}
          {plan.sections.map(renderSection)}
          {previewLine}{previewRect}{previewSection}
          {plan.labels.map((l) => (
            <Text key={l.id} x={l.x} y={l.y} text={l.text} fontSize={16} fontFamily="Fraunces" fill={theme.dimension} listening={false} />
          ))}
          {drawing?.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={4 / scale} fill="#c9a961" listening={false} />
          ))}
          {/* Wall endpoint indicators (visual only, not interactive — drag is direct on the wall body). */}
          {selectedWall && tool === "select" && !dragHandle && (
            <>
              {(["a", "b"] as const).map((end) => {
                const pt = selectedWall[end];
                return (
                  <Circle
                    key={end}
                    x={pt.x} y={pt.y}
                    radius={5 / scale}
                    fill="#c9a961"
                    stroke="#ffffff" strokeWidth={1.5 / scale}
                    listening={false}
                  />
                );
              })}
            </>
          )}
          {/* Live length badge during wall drag */}
          {selectedWall && dragHandle && (
            <Group
              x={(selectedWall.a.x + selectedWall.b.x) / 2}
              y={(selectedWall.a.y + selectedWall.b.y) / 2 - 24 / scale}
              listening={false}
            >
              <Rect
                x={-32 / scale} y={-9 / scale}
                width={64 / scale} height={18 / scale}
                fill="#1a1a1a" cornerRadius={3 / scale}
              />
              <Text
                text={`${(wallLength(selectedWall) / 100).toFixed(2)} m`}
                fontSize={11 / scale} fontFamily="JetBrains Mono"
                fill="#ffffff" width={64 / scale} align="center"
                x={-32 / scale} y={-6 / scale}
              />
            </Group>
          )}
          {/* Live width badge during opening drag */}
          {openingDrag && (() => {
            const op = plan.openings.find((o) => o.id === openingDrag.openingId);
            const w = plan.walls.find((ww) => ww.id === (op?.wallId ?? ""));
            if (!op || !w) return null;
            const len = wallLength(w);
            const cx = w.a.x + (w.b.x - w.a.x) * op.t;
            const cy = w.a.y + (w.b.y - w.a.y) * op.t;
            const label = openingDrag.mode === "move"
              ? `${Math.round(op.t * len)} / ${Math.round(len)} cm`
              : `${Math.round(op.width)} cm`;
            return (
              <Group x={cx} y={cy - 30 / scale} listening={false}>
                <Rect x={-42 / scale} y={-9 / scale} width={84 / scale} height={18 / scale} fill="#1a1a1a" cornerRadius={3 / scale} />
                <Text text={label} fontSize={11 / scale} fontFamily="JetBrains Mono" fill="#ffffff" width={84 / scale} align="center" x={-42 / scale} y={-6 / scale} />
              </Group>
            );
          })()}
          {/* Drag preview overlay — shows where the item will land */}
          {dragPreview && dragPreview.kind === "opening" && dragPreview.wallId && (() => {
            const w = plan.walls.find((ww) => ww.id === dragPreview.wallId);
            if (!w) return null;
            const ang = wallAngle(w);
            return (
              <>
                <Line
                  points={[w.a.x, w.a.y, w.b.x, w.b.y]}
                  stroke="#c9a961" strokeWidth={w.thickness + 4 / scale}
                  opacity={0.28} lineCap="butt" listening={false}
                />
                <Rect
                  x={dragPreview.pos.x - dragPreview.width / 2}
                  y={dragPreview.pos.y - w.thickness / 2}
                  width={dragPreview.width} height={w.thickness}
                  rotation={(ang * 180) / Math.PI}
                  offsetX={0} offsetY={0}
                  stroke="#c9a961" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]}
                  fill="rgba(201,169,97,0.15)" listening={false}
                />
              </>
            );
          })()}
          {dragPreview && dragPreview.kind === "furniture" && (
            <Rect
              x={dragPreview.pos.x - dragPreview.width / 2}
              y={dragPreview.pos.y - dragPreview.height / 2}
              width={dragPreview.width} height={dragPreview.height}
              stroke="#c9a961" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]}
              fill="rgba(201,169,97,0.12)" listening={false}
            />
          )}

          {selectionRect && (
            <Rect
              x={Math.min(selectionRect.start.x, selectionRect.current.x)}
              y={Math.min(selectionRect.start.y, selectionRect.current.y)}
              width={Math.abs(selectionRect.current.x - selectionRect.start.x)}
              height={Math.abs(selectionRect.current.y - selectionRect.start.y)}
              fill="rgba(201,169,97,0.10)"
              stroke="#c9a961"
              strokeWidth={1.2 / scale}
              dash={[6 / scale, 4 / scale]}
              listening={false}
            />
          )}

          {/* Wall highlight during opening transfer */}
          {hoverWallForDrop && (() => {
            const w = plan.walls.find((ww) => ww.id === hoverWallForDrop);
            if (!w) return null;
            return (
              <Line
                points={[w.a.x, w.a.y, w.b.x, w.b.y]}
                stroke="#c9a961"
                strokeWidth={w.thickness + 4 / scale}
                opacity={0.35}
                lineCap="butt"
                listening={false}
              />
            );
          })()}

        </Layer>
      </Stage>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-2.5 py-1 font-mono-tab text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        {cursor ? `${Math.round(cursor.x)}, ${Math.round(cursor.y)} cm` : "—"}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-card/90 px-2.5 py-1 font-mono-tab text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        {Math.round(scale * 100)}% · échelle 1:{Math.round(100 / scale)}
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="absolute z-50 min-w-[200px] rounded-md border border-border bg-card/95 py-1 text-xs shadow-panel backdrop-blur"
            style={{ left: contextMenu.screen.x, top: contextMenu.screen.y }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {contextMenu.target ? (() => {
              const t = contextMenu.target;
              const furn = t.type === "furniture" ? plan.furniture.find((x) => x.id === t.id) : null;
              const op = t.type === "opening" ? plan.openings.find((x) => x.id === t.id) : null;
              const close = () => setContextMenu(null);
              const Item = ({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) => (
                <button
                  onClick={() => { onClick(); close(); }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-brass/10 ${danger ? "text-destructive" : ""}`}
                >{label}</button>
              );
              return (
                <>
                  <Item label="Dupliquer" onClick={() => s.duplicateItems([t])} />
                  <Item label="Copier" onClick={() => { clipboardRef.current = [t]; }} />
                  {furn && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <Item label="Pivoter 90°" onClick={() => updateFurniture(furn.id, { rotation: (furn.rotation + 90) % 360 })} />
                      <Item label="Retourner 180°" onClick={() => updateFurniture(furn.id, { rotation: (furn.rotation + 180) % 360 })} />
                      <Item label={furn.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => updateFurniture(furn.id, { locked: !furn.locked })} />
                      <Item label={furn.anchorToWall ? "Détacher du mur" : "Ancrer au mur"} onClick={() => updateFurniture(furn.id, { anchorToWall: !furn.anchorToWall })} />
                    </>
                  )}
                  {op && op.type === "door" && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <Item label="Inverser charnière" onClick={() => s.flipOpeningHinge(op.id)} />
                      <Item label="Inverser sens" onClick={() => s.flipOpeningSwing(op.id)} />
                    </>
                  )}
                  <div className="my-1 h-px bg-border" />
                  <Item label="Supprimer" danger onClick={() => deleteSelected()} />
                </>
              );
            })() : (
              <>
                <button onClick={() => { setTool("wall"); setContextMenu(null); }} className="flex w-full px-3 py-1.5 text-left hover:bg-brass/10">Tracer un mur</button>
                <button onClick={() => { setTool("rectangle"); setContextMenu(null); }} className="flex w-full px-3 py-1.5 text-left hover:bg-brass/10">Créer une pièce</button>
                <button onClick={() => { setTool("section"); setContextMenu(null); }} className="flex w-full px-3 py-1.5 text-left hover:bg-brass/10">Ligne de coupe</button>
                {clipboardRef.current.length > 0 && (
                  <>
                    <div className="my-1 h-px bg-border" />
                    <button onClick={() => { s.duplicateItems(clipboardRef.current); setContextMenu(null); }} className="flex w-full px-3 py-1.5 text-left hover:bg-brass/10">Coller</button>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
