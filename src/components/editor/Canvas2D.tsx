import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Circle, Group, Text, Path } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import type { Furniture, Opening, Point, SectionLine, Wall } from "@/lib/editor/types";
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

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); }
      if (e.key === "Escape") { if (drawing) setTool("select"); setDrawing(null); setRectStart(null); setSectionStart(null); setSelection(null); }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) { e.preventDefault(); deleteSelected(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }

      // Tool shortcuts (no modifier)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const map: Record<string, typeof tool> = {
          v: "select", w: "wall", r: "rectangle", d: "door", f: "window",
          s: "section", e: "eraser",
        };
        const t = map[e.key.toLowerCase()];
        if (t) { e.preventDefault(); setTool(t); return; }
        // Views
        if (e.key === "1") { s.setView("2d"); return; }
        if (e.key === "2") { s.setView("3d"); return; }
        if (e.key === "3") { s.setView("section"); return; }
      }

      // Opening-specific shortcuts when an opening is selected
      if (selection?.type === "opening") {
        const op = s.plan.openings.find((o) => o.id === selection.id);
        if (!op) return;
        if (e.key === "Tab") {
          e.preventDefault();
          // Cycle 4 combos: a/p → b/p → b/n → a/n → a/p
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
  }, [selection, deleteSelected, undo, redo, setSelection, setTool, drawing, s, tool]);

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
    let sp = snapEnabled ? snapPoint(p, grid) : p;
    if (refFrom) sp = snapEnabled ? snapPoint(snapAngle(refFrom, sp, 15), grid) : sp;
    const threshold = 15 / scale;
    for (const w of plan.walls) {
      if (w.id === ignoreWallId) continue;
      for (const end of [w.a, w.b]) {
        if (dist(end, sp) < threshold) return { ...end };
      }
    }
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
      const f = findFurnitureAt(wp);
      if (f) { setSelection({ type: "furniture", id: f.id }); return; }
      const wh = findWallNear(wp);
      if (wh) { setSelection({ type: "wall", id: wh.wall.id }); return; }
      // section click
      for (const sec of plan.sections) {
        const info = pointOnWall(wp, { ...sec, id: sec.id, thickness: 30 } as Wall);
        if (info.dist < 15 / scale) { setSelection({ type: "section", id: sec.id }); return; }
      }
      setSelection(null);
    }
  };

  const onMouseMove = () => {
    const wp = getWorldPointer();
    if (!wp) return;
    // handle drag
    if (dragHandle) {
      const w = plan.walls.find((ww) => ww.id === dragHandle.wallId);
      if (!w) return;
      if (dragHandle.end === "mid") {
        const dx = wp.x - dragHandle.startPointer.x;
        const dy = wp.y - dragHandle.startPointer.y;
        let na = { x: dragHandle.origA.x + dx, y: dragHandle.origA.y + dy };
        let nb = { x: dragHandle.origB.x + dx, y: dragHandle.origB.y + dy };
        if (snapEnabled) { na = snapPoint(na, grid); nb = snapPoint(nb, grid); }
        updateWall(w.id, { a: na, b: nb });
      } else {
        const snapped = applySnap(wp, dragHandle.end === "a" ? w.b : w.a, w.id);
        updateWall(w.id, { [dragHandle.end]: snapped } as Partial<Wall>);
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
    if (dragHandle) setDragHandle(null);
  };

  const onDblClick = () => { if (tool === "wall") { setDrawing(null); setTool("select"); } };

  const snapFurnitureToWalls = (pos: Point, w: number, h: number): Point => {
    const threshold = 25 / scale;
    let best: { d: number; snap: Point } | null = null;
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
        };
        const d = Math.hypot(pos.x - snapped.x, pos.y - snapped.y);
        if (!best || d < best.d) best = { d, snap: snapped };
      }
    }
    return best ? best.snap : pos;
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
    let snapped = snapEnabled ? snapPoint(world, grid / 2) : world;
    snapped = snapFurnitureToWalls(snapped, item.width, item.height);
    addFurniture({
      kind: item.kind, x: snapped.x, y: snapped.y,
      width: item.width, height: item.height, rotation: 0, label: item.label,
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
    const isSel = selection?.type === "wall" && selection.id === w.id;
    return (
      <Line
        key={w.id}
        points={[w.a.x, w.a.y, w.b.x, w.b.y]}
        stroke={isSel ? "#c9a961" : theme.wallFill}
        strokeWidth={w.thickness}
        lineCap="butt"
        onClick={() => tool === "select" && setSelection({ type: "wall", id: w.id })}
        onTap={() => tool === "select" && setSelection({ type: "wall", id: w.id })}
        hitStrokeWidth={Math.max(w.thickness, 16 / scale)}
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
    const isSel = selection?.type === "opening" && selection.id === o.id;
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
    let symbol: React.ReactNode = null;
    if (kind === "door_simple" || kind === "entrance") {
      symbol = (
        <>
          <Path data={arcOnly} stroke={stroke} strokeWidth={sw * 0.6} fill="transparent" dash={[4 / scale, 3 / scale]} />
          <Line points={[hx, hy, tipX, tipY]} stroke={stroke} strokeWidth={sw} />
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
          <Path data={`M ${hx} ${hy} A ${o.width / 2} ${o.width / 2} 0 0 ${swA} ${tipL.x} ${tipL.y}`} stroke={stroke} strokeWidth={sw * 0.6} fill="transparent" dash={[4 / scale, 3 / scale]} />
          <Path data={`M ${lx} ${ly} A ${o.width / 2} ${o.width / 2} 0 0 ${swB} ${tipR.x} ${tipR.y}`} stroke={stroke} strokeWidth={sw * 0.6} fill="transparent" dash={[4 / scale, 3 / scale]} />
          <Line points={[hx, hy, midX, midY]} stroke={stroke} strokeWidth={sw} />
          <Line points={[midX, midY, lx, ly]} stroke={stroke} strokeWidth={sw} />
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
      <Group key={o.id} onClick={() => tool === "select" && setSelection({ type: "opening", id: o.id })} onTap={() => tool === "select" && setSelection({ type: "opening", id: o.id })}>
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
          <Rect
            x={cx - dx - 2 / scale} y={cy - dy - w.thickness / 2 - 2 / scale}
            width={o.width + 4 / scale} height={w.thickness + 4 / scale}
            rotation={(ang * 180) / Math.PI}
            stroke="#c9a961" strokeWidth={1 / scale} dash={[4 / scale, 3 / scale]} fill="transparent" listening={false}
          />
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
      const label = len >= 100 ? `${(len / 100).toFixed(2)} m` : `${Math.round(len)} cm`;
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
      const label = len >= 100 ? `${(len / 100).toFixed(2)} m` : `${Math.round(len)} cm`;
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
    const isSel = selection?.type === "furniture" && selection.id === f.id;
    const strokeColor = isSel ? "#c9a961" : theme.furnitureStroke;
    return (
      <Group
        key={f.id} x={f.x} y={f.y} rotation={f.rotation}
        draggable={tool === "select"}
        onClick={() => tool === "select" && setSelection({ type: "furniture", id: f.id })}
        onDragStart={() => commit()}
        onDragMove={(e) => {
          const node = e.target;
          let nx = node.x(); let ny = node.y();
          if (snapEnabled) {
            nx = Math.round(nx / (grid / 2)) * (grid / 2);
            ny = Math.round(ny / (grid / 2)) * (grid / 2);
            node.x(nx); node.y(ny);
          }
          updateFurniture(f.id, { x: nx, y: ny });
        }}
      >
        <FurnitureShape2D f={f} strokeColor={strokeColor} />
        {isSel && (
          <Rect
            x={-f.width / 2 - 2} y={-f.height / 2 - 2} width={f.width + 4} height={f.height + 4}
            stroke="#c9a961" strokeWidth={1.5 / scale} dash={[6 / scale, 4 / scale]} listening={false}
          />
        )}
      </Group>
    );
  };

  const renderSection = (sec: SectionLine) => {
    const isSel = selection?.type === "section" && selection.id === sec.id;
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
          onClick={() => tool === "select" && setSelection({ type: "section", id: sec.id })}
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background: theme.background, cursor: spaceDown ? "grab" : tool === "select" ? "grab" : "crosshair" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHtml}
    >
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
        draggable={spaceDown || tool === "select"}
        onDragStart={(e) => {
          // Only allow stage panning when the drag originated from the stage itself
          // (not from a shape). Otherwise cancel so shape drag/select works.
          if (e.target !== e.target.getStage() && !spaceDown) {
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
          {/* corner disks to seal wall junctions */}
          {junctions.map((j, i) => (
            <Circle key={`j${i}`} x={j.p.x} y={j.p.y} radius={j.radius} fill={theme.wallFill} listening={false} />
          ))}
          {plan.openings.map(renderOpening)}
          {!(showExteriorDims || showInteriorDims) && plan.walls.map(renderDim)}
          {perimeterDims}
          {plan.sections.map(renderSection)}
          {previewLine}{previewRect}{previewSection}
          {plan.labels.map((l) => (
            <Text key={l.id} x={l.x} y={l.y} text={l.text} fontSize={16} fontFamily="Fraunces" fill={theme.dimension} listening={false} />
          ))}
          {drawing?.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={4 / scale} fill="#c9a961" listening={false} />
          ))}
          {/* wall handles when selected */}
          {selectedWall && tool === "select" && (
            <>
              {(["a", "b", "mid"] as const).map((end) => {
                const pt = end === "mid" ? { x: (selectedWall.a.x + selectedWall.b.x) / 2, y: (selectedWall.a.y + selectedWall.b.y) / 2 } : selectedWall[end];
                const isMid = end === "mid";
                return (
                  <Group key={end}>
                    <Circle
                      x={pt.x} y={pt.y}
                      radius={(isMid ? 9 : 13) / scale}
                      fill="#ffffff" stroke="#c9a961"
                      strokeWidth={2.5 / scale}
                      shadowColor="rgba(0,0,0,0.25)" shadowBlur={4 / scale} shadowOffset={{ x: 0, y: 1 / scale }}
                      onMouseDown={(e) => {
                        e.cancelBubble = true;
                        const wp = getWorldPointer();
                        if (!wp) return;
                        setDragHandle({ wallId: selectedWall.id, end, origA: { ...selectedWall.a }, origB: { ...selectedWall.b }, startPointer: wp });
                        commit();
                      }}
                    />
                    {!isMid && (
                      <Line
                        points={[pt.x - 4 / scale, pt.y, pt.x + 4 / scale, pt.y]}
                        stroke="#c9a961" strokeWidth={1.5 / scale} listening={false}
                      />
                    )}
                    {!isMid && (
                      <Line
                        points={[pt.x, pt.y - 4 / scale, pt.x, pt.y + 4 / scale]}
                        stroke="#c9a961" strokeWidth={1.5 / scale} listening={false}
                      />
                    )}
                  </Group>
                );
              })}
              {/* live length badge during drag */}
              {dragHandle && (
                <Group
                  x={(selectedWall.a.x + selectedWall.b.x) / 2}
                  y={(selectedWall.a.y + selectedWall.b.y) / 2 - 24 / scale}
                >
                  <Rect
                    x={-30 / scale} y={-9 / scale}
                    width={60 / scale} height={18 / scale}
                    fill="#1a1a1a" cornerRadius={3 / scale} listening={false}
                  />
                  <Text
                    text={`${(wallLength(selectedWall) / 100).toFixed(2)} m`}
                    fontSize={11 / scale} fontFamily="JetBrains Mono"
                    fill="#ffffff" width={60 / scale} align="center"
                    x={-30 / scale} y={-6 / scale} listening={false}
                  />
                </Group>
              )}
            </>
          )}
        </Layer>
      </Stage>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-2.5 py-1 font-mono-tab text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        {cursor ? `${Math.round(cursor.x)}, ${Math.round(cursor.y)} cm` : "—"}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-card/90 px-2.5 py-1 font-mono-tab text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        {Math.round(scale * 100)}% · échelle 1:{Math.round(100 / scale)}
      </div>
    </div>
  );
}
