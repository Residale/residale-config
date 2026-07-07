import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Circle, Group, Text, Path } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import type { Furniture, Opening, Point, Wall } from "@/lib/editor/types";
import {
  dist,
  pointOnWall,
  snapAngle,
  snapPoint,
  uid,
  wallAngle,
  wallLength,
} from "@/lib/editor/geometry";

const WORLD_UNIT = 1; // 1 unit == 1 cm
const DEFAULT_WALL_THICKNESS = 15;

type Props = {
  onExportRef?: (fn: () => string | null) => void;
};

export function Canvas2D({ onExportRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1.2);
  const [pos, setPos] = useState({ x: 400, y: 300 });
  const [cursor, setCursor] = useState<Point | null>(null);
  const [drawing, setDrawing] = useState<Point[] | null>(null);
  const [rectStart, setRectStart] = useState<Point | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const {
    plan,
    tool,
    selection,
    grid,
    snapEnabled,
    showGrid,
    showDimensions,
    setSelection,
    addWall,
    addOpening,
    addFurniture,
    updateFurniture,
    updateWall,
    commit,
    deleteSelected,
    undo,
    redo,
  } = useEditor();

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Keyboard
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(true);
      if (e.key === "Escape") {
        setDrawing(null);
        setRectStart(null);
        setSelection(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [selection, deleteSelected, undo, redo, setSelection]);

  // Coord conversions
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

  // Wheel zoom
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
    const mousePointTo = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    };
    setScale(newScale);
    setPos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  // Snap helpers
  const applySnap = (p: Point, refFrom?: Point): Point => {
    let sp = snapEnabled ? snapPoint(p, grid) : p;
    if (refFrom) sp = snapEnabled ? snapPoint(snapAngle(refFrom, sp, 15), grid) : sp;
    // snap to existing endpoints
    const threshold = 15 / scale;
    for (const w of plan.walls) {
      for (const end of [w.a, w.b]) {
        if (dist(end, sp) < threshold) return { ...end };
      }
    }
    return sp;
  };

  // Wall/opening hit test
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
      // AABB (ignore rotation for hit test simplicity when 0)
      const cos = Math.cos((-f.rotation * Math.PI) / 180);
      const sin = Math.sin((-f.rotation * Math.PI) / 180);
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= f.width / 2 && Math.abs(ly) <= f.height / 2) return f;
    }
    return null;
  };

  // Stage events
  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (spaceDown || e.evt.button === 1) return; // pan handled by draggable
    const wp = getWorldPointer();
    if (!wp) return;

    if (tool === "wall") {
      const snapped = applySnap(wp, drawing?.[drawing.length - 1]);
      if (!drawing) {
        setDrawing([snapped]);
      } else {
        const prev = drawing[drawing.length - 1];
        if (dist(prev, snapped) < 5) return;
        addWall({ a: prev, b: snapped, thickness: DEFAULT_WALL_THICKNESS });
        // continue chain
        setDrawing([...drawing, snapped]);
      }
      return;
    }

    if (tool === "rectangle") {
      const snapped = applySnap(wp);
      if (!rectStart) {
        setRectStart(snapped);
      } else {
        const a = rectStart;
        const b = snapped;
        commit();
        const c1 = { x: a.x, y: a.y };
        const c2 = { x: b.x, y: a.y };
        const c3 = { x: b.x, y: b.y };
        const c4 = { x: a.x, y: b.y };
        addWall({ a: c1, b: c2, thickness: DEFAULT_WALL_THICKNESS });
        addWall({ a: c2, b: c3, thickness: DEFAULT_WALL_THICKNESS });
        addWall({ a: c3, b: c4, thickness: DEFAULT_WALL_THICKNESS });
        addWall({ a: c4, b: c1, thickness: DEFAULT_WALL_THICKNESS });
        setRectStart(null);
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
      if (f) {
        setSelection({ type: "furniture", id: f.id });
        deleteSelected();
        return;
      }
      const wh = findWallNear(wp);
      if (wh) {
        setSelection({ type: "wall", id: wh.wall.id });
        deleteSelected();
      }
      return;
    }

    if (tool === "select") {
      const f = findFurnitureAt(wp);
      if (f) {
        setSelection({ type: "furniture", id: f.id });
        return;
      }
      const wh = findWallNear(wp);
      if (wh) {
        setSelection({ type: "wall", id: wh.wall.id });
        return;
      }
      setSelection(null);
    }
  };

  const onMouseMove = () => {
    const wp = getWorldPointer();
    if (!wp) return;
    if (tool === "wall" && drawing?.length) {
      setCursor(applySnap(wp, drawing[drawing.length - 1]));
    } else if (tool === "rectangle" && rectStart) {
      setCursor(applySnap(wp));
    } else {
      setCursor(wp);
    }
  };

  const onDblClick = () => {
    if (tool === "wall") setDrawing(null);
  };

  // Drop furniture from palette
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
    const snapped = snapEnabled ? snapPoint(world, grid / 2) : world;
    addFurniture({
      kind: item.kind,
      x: snapped.x,
      y: snapped.y,
      width: item.width,
      height: item.height,
      rotation: 0,
      label: item.label,
    });
  };

  // Grid visible bounds
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
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, y0, x, y1]}
          stroke={major ? "#d9d1bf" : "#e8e2d1"}
          strokeWidth={(major ? 1 : 0.5) / scale}
          listening={false}
        />
      );
    }
    for (let y = y0; y <= y1; y += step) {
      const major = Math.round(y / step) % majorEvery === 0;
      lines.push(
        <Line
          key={`h${y}`}
          points={[x0, y, x1, y]}
          stroke={major ? "#d9d1bf" : "#e8e2d1"}
          strokeWidth={(major ? 1 : 0.5) / scale}
          listening={false}
        />
      );
    }
    // origin
    lines.push(
      <Circle key="o" x={0} y={0} radius={4 / scale} fill="#c9a961" listening={false} />
    );
    return lines;
  }, [showGrid, grid, pos, scale, size]);

  // Wall shape helpers
  const renderWall = (w: Wall) => {
    const isSel = selection?.type === "wall" && selection.id === w.id;
    return (
      <Line
        key={w.id}
        points={[w.a.x, w.a.y, w.b.x, w.b.y]}
        stroke={isSel ? "#c9a961" : "#1a1a1a"}
        strokeWidth={w.thickness}
        lineCap="butt"
        onClick={() => tool === "select" && setSelection({ type: "wall", id: w.id })}
      />
    );
  };

  const renderOpening = (o: Opening) => {
    const w = plan.walls.find((ww) => ww.id === o.wallId);
    if (!w) return null;
    const ang = wallAngle(w);
    const len = wallLength(w);
    const cx = w.a.x + Math.cos(ang) * len * o.t;
    const cy = w.a.y + Math.sin(ang) * len * o.t;
    const dx = Math.cos(ang) * o.width / 2;
    const dy = Math.sin(ang) * o.width / 2;
    // gap in wall
    return (
      <Group key={o.id}>
        {/* white gap covering the wall */}
        <Line
          points={[cx - dx, cy - dy, cx + dx, cy + dy]}
          stroke="#fafaf7"
          strokeWidth={w.thickness + 1}
          lineCap="butt"
        />
        {o.type === "door" ? (
          <>
            {/* door leaf arc */}
            <Path
              data={`M ${cx - dx} ${cy - dy} A ${o.width} ${o.width} 0 0 1 ${cx - dx + Math.cos(ang + Math.PI / 2) * o.width} ${cy - dy + Math.sin(ang + Math.PI / 2) * o.width}`}
              stroke="#8b7355"
              strokeWidth={1.5 / scale}
              fill="transparent"
              dash={[4 / scale, 3 / scale]}
            />
            <Line
              points={[cx - dx, cy - dy, cx - dx + Math.cos(ang + Math.PI / 2) * o.width, cy - dy + Math.sin(ang + Math.PI / 2) * o.width]}
              stroke="#8b7355"
              strokeWidth={2 / scale}
            />
          </>
        ) : (
          <>
            {/* window: three parallel lines */}
            <Line
              points={[cx - dx, cy - dy, cx + dx, cy + dy]}
              stroke="#4a6b8a"
              strokeWidth={2 / scale}
            />
            <Line
              points={[
                cx - dx + Math.cos(ang + Math.PI / 2) * (w.thickness / 3),
                cy - dy + Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
                cx + dx + Math.cos(ang + Math.PI / 2) * (w.thickness / 3),
                cy + dy + Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
              ]}
              stroke="#4a6b8a"
              strokeWidth={1 / scale}
            />
            <Line
              points={[
                cx - dx - Math.cos(ang + Math.PI / 2) * (w.thickness / 3),
                cy - dy - Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
                cx + dx - Math.cos(ang + Math.PI / 2) * (w.thickness / 3),
                cy + dy - Math.sin(ang + Math.PI / 2) * (w.thickness / 3),
              ]}
              stroke="#4a6b8a"
              strokeWidth={1 / scale}
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
    const off = (w.thickness / 2 + 14) ;
    const nx = Math.cos(ang - Math.PI / 2) * off;
    const ny = Math.sin(ang - Math.PI / 2) * off;
    const label = len >= 100 ? `${(len / 100).toFixed(2)} m` : `${Math.round(len)} cm`;
    let deg = (ang * 180) / Math.PI;
    if (deg > 90 || deg < -90) deg += 180;
    return (
      <Text
        key={`d${w.id}`}
        x={cx + nx}
        y={cy + ny}
        text={label}
        fontSize={11 / scale}
        fontFamily="JetBrains Mono"
        fill="#6b5842"
        rotation={deg}
        offsetX={20 / scale}
        offsetY={5 / scale}
        listening={false}
      />
    );
  };

  const renderFurniture = (f: Furniture) => {
    const item = CATALOG.find((c) => c.kind === f.kind);
    const color = item?.color ?? "#c9b89a";
    const isSel = selection?.type === "furniture" && selection.id === f.id;
    return (
      <Group
        key={f.id}
        x={f.x}
        y={f.y}
        rotation={f.rotation}
        draggable={tool === "select"}
        onClick={() => tool === "select" && setSelection({ type: "furniture", id: f.id })}
        onDragStart={() => commit()}
        onDragMove={(e) => {
          const node = e.target;
          let nx = node.x();
          let ny = node.y();
          if (snapEnabled) {
            nx = Math.round(nx / (grid / 2)) * (grid / 2);
            ny = Math.round(ny / (grid / 2)) * (grid / 2);
            node.x(nx);
            node.y(ny);
          }
          updateFurniture(f.id, { x: nx, y: ny });
        }}
      >
        <Rect
          x={-f.width / 2}
          y={-f.height / 2}
          width={f.width}
          height={f.height}
          fill={color}
          stroke={isSel ? "#c9a961" : "#6b5842"}
          strokeWidth={isSel ? 2 : 1}
          cornerRadius={f.kind === "rug" ? 4 : 2}
          opacity={f.kind === "rug" ? 0.5 : 0.92}
          dash={f.kind === "rug" ? [6, 4] : undefined}
        />
        {/* simple pictogram: label */}
        {f.width > 40 && (
          <Text
            text={item?.label ?? ""}
            fontSize={10}
            fontFamily="Inter"
            fill="#3d2f1f"
            width={f.width - 8}
            align="center"
            x={-f.width / 2 + 4}
            y={-6}
            listening={false}
          />
        )}
      </Group>
    );
  };

  // Preview walls while drawing
  const previewLine =
    tool === "wall" && drawing?.length && cursor
      ? (
        <Line
          points={[drawing[drawing.length - 1].x, drawing[drawing.length - 1].y, cursor.x, cursor.y]}
          stroke="#c9a961"
          strokeWidth={DEFAULT_WALL_THICKNESS}
          opacity={0.4}
          dash={[8, 6]}
          listening={false}
        />
      )
      : null;

  const previewRect =
    tool === "rectangle" && rectStart && cursor
      ? (
        <Rect
          x={Math.min(rectStart.x, cursor.x)}
          y={Math.min(rectStart.y, cursor.y)}
          width={Math.abs(cursor.x - rectStart.x)}
          height={Math.abs(cursor.y - rectStart.y)}
          stroke="#c9a961"
          strokeWidth={2 / scale}
          dash={[6 / scale, 4 / scale]}
          fill="rgba(201,169,97,0.06)"
          listening={false}
        />
      )
      : null;

  // Expose export
  useEffect(() => {
    if (!onExportRef) return;
    onExportRef(() => {
      const stage = stageRef.current;
      if (!stage) return null;
      return stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
    });
  }, [onExportRef]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-paper"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropHtml}
      style={{ cursor: spaceDown ? "grab" : tool === "select" ? "default" : "crosshair" }}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        draggable={spaceDown}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setPos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onDblClick={onDblClick}
      >
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>
          {plan.furniture.map(renderFurniture)}
          {plan.walls.map(renderWall)}
          {plan.openings.map(renderOpening)}
          {plan.walls.map(renderDim)}
          {previewLine}
          {previewRect}
          {plan.labels.map((l) => (
            <Text
              key={l.id}
              x={l.x}
              y={l.y}
              text={l.text}
              fontSize={16}
              fontFamily="Fraunces"
              fill="#3d2f1f"
              listening={false}
            />
          ))}
          {/* endpoints highlight while drawing */}
          {drawing?.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={4 / scale} fill="#c9a961" listening={false} />
          ))}
        </Layer>
      </Stage>

      {/* Coordinate readout */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-2.5 py-1 font-mono-tab text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        {cursor ? `${Math.round(cursor.x)}, ${Math.round(cursor.y)} cm` : "—"}
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-card/90 px-2.5 py-1 font-mono-tab text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
}
