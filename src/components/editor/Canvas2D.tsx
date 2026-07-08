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
    theme, setSelection, addWall, addOpening, addFurniture, addSection,
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
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.code === "Space") setSpaceDown(true);
      if (e.key === "Escape") { setDrawing(null); setRectStart(null); setSectionStart(null); setSelection(null); }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) { e.preventDefault(); deleteSelected(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [selection, deleteSelected, undo, redo, setSelection]);

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
    const factor = 1.12;
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
      }
      return;
    }
    if (tool === "section") {
      const snapped = applySnap(wp);
      if (!sectionStart) setSectionStart(snapped);
      else {
        addSection({ a: sectionStart, b: snapped, name: "" });
        setSectionStart(null);
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

  const onDblClick = () => { if (tool === "wall") setDrawing(null); };

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
    const kind = e.dataTransfer.getData("application/x-furniture");
    if (!kind) return;
    const item = CATALOG.find((c) => c.kind === kind && c.label === e.dataTransfer.getData("application/x-furniture-label"))
      || CATALOG.find((c) => c.kind === kind);
    if (!item) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = toWorld(screen);
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
        lineCap="square"
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
    const dx = Math.cos(ang) * o.width / 2;
    const dy = Math.sin(ang) * o.width / 2;
    const isSel = selection?.type === "opening" && selection.id === o.id;
    return (
      <Group key={o.id} onClick={() => tool === "select" && setSelection({ type: "opening", id: o.id })}>
        <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={theme.background} strokeWidth={w.thickness + 2} lineCap="butt" />
        {o.type === "door" ? (
          <>
            <Path
              data={`M ${cx - dx} ${cy - dy} A ${o.width} ${o.width} 0 0 1 ${cx - dx + Math.cos(ang + Math.PI / 2) * o.width} ${cy - dy + Math.sin(ang + Math.PI / 2) * o.width}`}
              stroke={isSel ? "#c9a961" : theme.openingStroke}
              strokeWidth={1.2 / scale}
              fill="transparent"
              dash={[4 / scale, 3 / scale]}
            />
            <Line
              points={[cx - dx, cy - dy, cx - dx + Math.cos(ang + Math.PI / 2) * o.width, cy - dy + Math.sin(ang + Math.PI / 2) * o.width]}
              stroke={isSel ? "#c9a961" : theme.openingStroke}
              strokeWidth={1.8 / scale}
            />
          </>
        ) : (
          <>
            <Line points={[cx - dx, cy - dy, cx + dx, cy + dy]} stroke={isSel ? "#c9a961" : theme.openingStroke} strokeWidth={2 / scale} />
            <Line
              points={[
                cx - dx + Math.cos(ang + Math.PI / 2) * (w.thickness / 3), cy - dy + Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
                cx + dx + Math.cos(ang + Math.PI / 2) * (w.thickness / 3), cy + dy + Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
              ]}
              stroke={theme.openingStroke} strokeWidth={1 / scale}
            />
            <Line
              points={[
                cx - dx - Math.cos(ang + Math.PI / 2) * (w.thickness / 3), cy - dy - Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
                cx + dx - Math.cos(ang + Math.PI / 2) * (w.thickness / 3), cy + dy - Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
              ]}
              stroke={theme.openingStroke} strokeWidth={1 / scale}
            />
          </>
        )}
      </Group>
    );
  };

  const renderDim = (w: Wall) => {
    if (!showDimensions) return null;
    const len = wallLength(w);
    if (len < 20) return null;
    const cx = (w.a.x + w.b.x) / 2;
    const cy = (w.a.y + w.b.y) / 2;
    const ang = wallAngle(w);
    const off = w.thickness / 2 + 14;
    const nx = Math.cos(ang - Math.PI / 2) * off;
    const ny = Math.sin(ang - Math.PI / 2) * off;
    const label = len >= 100 ? `${(len / 100).toFixed(2)} m` : `${Math.round(len)} cm`;
    let deg = (ang * 180) / Math.PI;
    if (deg > 90 || deg < -90) deg += 180;
    return (
      <Text
        key={`d${w.id}`} x={cx + nx} y={cy + ny} text={label}
        fontSize={11 / scale} fontFamily="JetBrains Mono"
        fill={theme.dimension} rotation={deg}
        offsetX={20 / scale} offsetY={5 / scale} listening={false}
      />
    );
  };

  const renderFurniture = (f: Furniture) => {
    const item = CATALOG.find((c) => c.kind === f.kind);
    const color = theme.furnitureFill === "transparent" ? "transparent" : (item?.color ?? theme.furnitureFill);
    const isSel = selection?.type === "furniture" && selection.id === f.id;
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
        <Rect
          x={-f.width / 2} y={-f.height / 2} width={f.width} height={f.height}
          fill={color} stroke={isSel ? "#c9a961" : theme.furnitureStroke}
          strokeWidth={isSel ? 2 : 1}
          cornerRadius={f.kind === "rug" ? 4 : 2}
          opacity={f.kind === "rug" ? 0.5 : 0.92}
          dash={f.kind === "rug" ? [6, 4] : undefined}
        />
        {f.width > 40 && (
          <Text
            text={item?.label ?? ""} fontSize={10} fontFamily="Inter"
            fill={theme.furnitureStroke} width={f.width - 8} align="center"
            x={-f.width / 2 + 4} y={-6} listening={false}
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
      style={{ background: theme.background, cursor: spaceDown ? "grab" : tool === "select" ? "default" : "crosshair" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHtml}
    >
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        scaleX={scale} scaleY={scale} x={pos.x} y={pos.y}
        draggable={spaceDown}
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
          {plan.walls.map(renderDim)}
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
                return (
                  <Circle
                    key={end}
                    x={pt.x} y={pt.y}
                    radius={(end === "mid" ? 6 : 8) / scale}
                    fill="#ffffff" stroke="#c9a961" strokeWidth={2 / scale}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      const wp = getWorldPointer();
                      if (!wp) return;
                      setDragHandle({ wallId: selectedWall.id, end, origA: { ...selectedWall.a }, origB: { ...selectedWall.b }, startPointer: wp });
                      commit();
                    }}
                  />
                );
              })}
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
