import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Stage, Layer, Line, Rect, Group, Text } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/lib/editor/store";
import { autoSectionsFromPlan, computeSection } from "@/lib/editor/sections";
import type { SectionLine } from "@/lib/editor/types";

const NAME_MAP: Record<string, string> = {
  N: "Coupe — Façade Nord",
  S: "Coupe — Façade Sud",
  E: "Coupe — Façade Est",
  O: "Coupe — Façade Ouest",
};

function m(cm: number) {
  return `${(cm / 100).toFixed(2)} m`;
}

function roofThickness(roof: NonNullable<ReturnType<typeof useEditor.getState>["plan"]["roof"]>) {
  return Math.max(1, roof.thickness ?? 20);
}

function sectionAxis(section: SectionLine): "x" | "y" {
  return Math.abs(section.b.x - section.a.x) >= Math.abs(section.b.y - section.a.y) ? "x" : "y";
}

function sectionDirection(section: SectionLine, axis: "x" | "y") {
  const delta = axis === "x" ? section.b.x - section.a.x : section.b.y - section.a.y;
  return delta >= 0 ? 1 : -1;
}

export function CanvasSection() {
  const { plan, theme } = useEditor();
  const sections = useMemo(() => {
    const user = plan.sections;
    return user.length ? user : autoSectionsFromPlan(plan);
  }, [plan]);
  const [expanded, setExpanded] = useState<SectionLine | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (sections.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ background: theme.background }}
      >
        <div className="max-w-md rounded-md border border-dashed border-border bg-card/70 p-6 text-center">
          <div className="mb-2 font-display text-lg">Aucun plan à couper</div>
          <p className="text-sm text-muted-foreground">
            Dessinez d'abord quelques murs pour générer automatiquement les coupes.
          </p>
        </div>
      </div>
    );
  }

  const cols = sections.length <= 2 ? sections.length : 2;
  return (
    <>
      <div
        className="grid h-full w-full gap-2 p-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridAutoRows: sections.length <= 2 ? "1fr" : "minmax(0, 1fr)",
          background: theme.background,
        }}
      >
        {sections.map((sec) => (
          <SectionPanel key={sec.id} section={sec} onExpand={() => setExpanded(sec)} />
        ))}
      </div>
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setExpanded(null)}
        >
          <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpanded(null)}
              className="absolute right-2 top-2 z-[60] rounded border border-border bg-card px-3 py-1 text-xs font-medium hover:border-ring/40"
            >
              Fermer (Échap)
            </button>
            <SectionPanel section={expanded} fullscreen />
          </div>
        </div>
      )}
    </>
  );
}

function SectionPanel({
  section,
  fullscreen = false,
  onExpand,
}: {
  section: SectionLine;
  fullscreen?: boolean;
  onExpand?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const { plan, theme, sectionDisplay } = useEditor();

  useEffect(() => {
    if (!containerRef.current) return;
    // Sync initial size synchronously to avoid the "empty at first render" flash.
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height });
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0 && e.contentRect.height > 0) {
          setSize({ w: e.contentRect.width, h: e.contentRect.height });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => computeSection(plan, section), [plan, section]);

  // Fit to view
  const layout = useMemo(() => {
    const totalLen = data.length;
    const cuts = [...data.cuts].sort((a, b) => a.start - b.start || a.end - b.end);
    const wallCuts = cuts.filter((c) => c.type === "wall");
    const roofMaxH = (() => {
      const maxWallH = wallCuts.length
        ? Math.max(...wallCuts.map((c) => c.height), data.ceilingH)
        : data.ceilingH;
      if (!plan.roof || !wallCuts.length) return maxWallH;
      const roofAxis = plan.roof.slopeAxis ?? "x";
      const axis = sectionAxis(section);
      const spanStart = Math.min(...wallCuts.map((c) => c.start));
      const spanEnd = Math.max(...wallCuts.map((c) => c.end));
      const run = axis === roofAxis ? spanEnd - spanStart + 2 * plan.roof.overhang : 0;
      const rise =
        plan.roof.kind === "flat" || plan.roof.kind === "mono"
          ? Math.tan((plan.roof.pitch * Math.PI) / 180) * Math.max(0, run)
          : Math.tan((plan.roof.pitch * Math.PI) / 180) * Math.max(0, run / 2);
      return Math.max(
        maxWallH,
        (plan.roof.eaveHeight ?? maxWallH) + rise + roofThickness(plan.roof),
      );
    })();
    const belowGround = 60;
    const totalH = roofMaxH + belowGround;
    const marginX = 60,
      marginY = 40;
    const availW = Math.max(100, size.w - marginX * 2);
    const availH = Math.max(100, size.h - marginY * 2);
    const fitScale = Math.min(availW / Math.max(1, totalLen), availH / Math.max(1, totalH));
    const originX = marginX;
    const originY = marginY + roofMaxH * fitScale;
    return { totalLen, cuts, wallCuts, roofMaxH, fitScale, originX, originY };
  }, [data, plan.roof, section, size.w, size.h]);

  const s = scale * layout.fitScale;
  const originX = layout.originX + pos.x;
  const originY = layout.originY + pos.y;
  const toX = useCallback((cm: number) => originX + cm * s, [originX, s]);
  const toY = useCallback((heightCm: number) => originY - heightCm * s, [originY, s]);

  const onWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      const oldScale = scale;
      const newScale = Math.max(
        0.3,
        Math.min(8, direction > 0 ? oldScale * factor : oldScale / factor),
      );
      // Zoom around pointer
      const oldS = oldScale * layout.fitScale;
      const worldPt = { x: (pointer.x - originX) / oldS, y: -(pointer.y - originY) / oldS };
      const newS = newScale * layout.fitScale;
      const newOriginX = pointer.x - worldPt.x * newS;
      const newOriginY = pointer.y + worldPt.y * newS;
      setScale(newScale);
      setPos({ x: newOriginX - layout.originX, y: newOriginY - layout.originY });
    },
    [scale, layout, originX, originY],
  );

  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const p = stage.getPointerPosition();
    if (!p) return;
    dragStart.current = { x: pos.x, y: pos.y, px: p.x, py: p.y };
    setDragging(true);
    e.evt.preventDefault();
  };
  const onMouseMove = () => {
    if (!dragging || !dragStart.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const p = stage.getPointerPosition();
    if (!p) return;
    setPos({
      x: dragStart.current.x + (p.x - dragStart.current.px),
      y: dragStart.current.y + (p.y - dragStart.current.py),
    });
  };
  const onMouseUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  const resetView = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const { totalLen, cuts, wallCuts } = layout;
  const topDimY = originY - layout.roofMaxH * s - 20;

  const roofHeightAtAlong = useCallback(
    (along: number) => {
      if (!plan.roof || wallCuts.length === 0) return null;
      const spanStart = Math.min(...wallCuts.map((c) => c.start)) - plan.roof.overhang;
      const spanEnd = Math.max(...wallCuts.map((c) => c.end)) + plan.roof.overhang;
      const run = Math.max(1, spanEnd - spanStart);
      const pitchRad = (plan.roof.pitch * Math.PI) / 180;
      const axis = sectionAxis(section);
      const roofAxis = plan.roof.slopeAxis ?? "x";
      const base = plan.roof.eaveHeight;
      if (plan.roof.kind === "flat" || plan.roof.kind === "mono") {
        if (axis !== roofAxis) return base;
        const dir = sectionDirection(section, axis) * (plan.roof.slopeDirection ?? 1);
        const t = dir === 1 ? (along - spanStart) / run : (spanEnd - along) / run;
        return base + Math.tan(pitchRad) * run * Math.max(0, Math.min(1, t));
      }
      const mid = (spanStart + spanEnd) / 2;
      const rise = Math.tan(pitchRad) * Math.max(0, run / 2 - Math.abs(along - mid));
      return base + rise;
    },
    [plan.roof, section, wallCuts],
  );

  const wallTopAt = useCallback(
    (along: number, baseHeight: number, wallType?: string) => {
      if (wallType !== "interior") {
        const roofH = roofHeightAtAlong(along);
        if (roofH !== null) return Math.max(baseHeight, roofH);
      }
      return baseHeight;
    },
    [roofHeightAtAlong],
  );

  const renderWallPolygon = useCallback(
    (
      key: string,
      start: number,
      end: number,
      height: number,
      wallType: string | undefined,
      opacity = 1,
      strokeWidth = 1,
    ) => {
      const h0 = wallTopAt(start, height, wallType);
      const h1 = wallTopAt(end, height, wallType);
      return (
        <Line
          key={key}
          points={[toX(start), toY(0), toX(end), toY(0), toX(end), toY(h1), toX(start), toY(h0)]}
          closed
          fill={theme.wallFill}
          stroke={theme.wallStroke}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    },
    [theme.wallFill, theme.wallStroke, toX, toY, wallTopAt],
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-md border border-border"
      style={{ background: "#ffffff" }}
    >
      <div
        onDoubleClick={onExpand}
        className="absolute left-2 top-2 z-10 cursor-pointer rounded bg-card/90 px-2 py-1 text-[11px] font-medium tracking-wide hover:border hover:border-ring/40"
        title="Double-cliquez pour agrandir"
      >
        {NAME_MAP[section.name] ?? `Coupe ${section.name}-${section.name}'`}
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {onExpand && !fullscreen && (
          <button
            onClick={onExpand}
            className="rounded border border-border bg-card/90 px-2 py-1 text-[10px] font-medium hover:border-ring/40"
            title="Plein écran"
          >
            ⛶
          </button>
        )}
        <button
          onClick={resetView}
          className="rounded border border-border bg-card/90 px-2 py-1 text-[10px] font-medium hover:border-ring/40"
          title="Recentrer la vue"
        >
          Recentrer
        </button>
      </div>

      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <Layer>
          {/* Ground */}
          {sectionDisplay.showGround && (
            <Group>
              <Rect
                x={toX(-50) - 20}
                y={originY}
                width={(totalLen + 100) * s + 40}
                height={30}
                fill={theme.floor}
                opacity={0.4}
              />
              <Line
                points={[toX(-50) - 20, originY, toX(totalLen + 50) + 20, originY]}
                stroke={theme.wallStroke}
                strokeWidth={1.5}
              />
            </Group>
          )}

          {/* Ceiling line */}
          <Line
            points={[toX(-50), toY(data.ceilingH), toX(totalLen + 50), toY(data.ceilingH)]}
            stroke={theme.wallStroke}
            strokeWidth={1}
            dash={[8, 4]}
          />

          {/* Roof */}
          {plan.roof &&
            wallCuts.length > 0 &&
            (() => {
              const spanStart = Math.min(...wallCuts.map((c) => c.start));
              const spanEnd = Math.max(...wallCuts.map((c) => c.end));
              const ov = plan.roof.overhang;
              const base = plan.roof.eaveHeight;
              const thick = roofThickness(plan.roof);
              const pitchRad = (plan.roof.pitch * Math.PI) / 180;
              const xL = spanStart - ov,
                xR = spanEnd + ov;
              const run = Math.max(1, xR - xL);
              const axis = sectionAxis(section);
              const roofAxis = plan.roof.slopeAxis ?? "x";
              let poly: number[] = [];
              if (plan.roof.kind === "flat" || plan.roof.kind === "mono") {
                const visibleSlope = axis === roofAxis;
                const rise = visibleSlope ? Math.tan(pitchRad) * run : 0;
                const dir = sectionDirection(section, axis) * (plan.roof.slopeDirection ?? 1);
                const leftBase = dir === 1 ? base : base + rise;
                const rightBase = dir === 1 ? base + rise : base;
                poly = [
                  toX(xL),
                  toY(leftBase + thick),
                  toX(xR),
                  toY(rightBase + thick),
                  toX(xR),
                  toY(rightBase),
                  toX(xL),
                  toY(leftBase),
                ];
              } else {
                const midX = (xL + xR) / 2;
                const rise = Math.tan(pitchRad) * Math.max(1, run / 2);
                const eaveTop = base;
                const ridgeTop = base + rise;
                poly = [
                  toX(xL),
                  toY(eaveTop + thick),
                  toX(midX),
                  toY(ridgeTop + thick),
                  toX(xR),
                  toY(eaveTop + thick),
                  toX(xR),
                  toY(eaveTop),
                  toX(midX),
                  toY(ridgeTop),
                  toX(xL),
                  toY(eaveTop),
                ];
              }
              return (
                <Line
                  points={poly}
                  closed
                  fill={theme.wallFill}
                  stroke={theme.wallStroke}
                  strokeWidth={1}
                  opacity={0.9}
                />
              );
            })()}

          {/* Elevation walls (behind — draw first, greyed) */}
          {data.elevationWalls?.map((ew, i) =>
            renderWallPolygon(`ew${i}`, ew.start, ew.end, ew.height, ew.wall.wallType, 0.35, 0.6),
          )}

          {/* Cut walls (poché) */}
          {cuts
            .filter((c) => c.type === "wall")
            .map((c, i) =>
              renderWallPolygon(`w${i}`, c.start, c.end, c.height, c.wall.wallType, 1, 1),
            )}

          {/* Openings */}
          {cuts
            .filter((c) => c.type !== "wall")
            .map((c, i) => {
              const openH = c.height - c.sillHeight;
              const openW = c.opening?.width ?? c.end - c.start;
              const kind = c.type === "door" ? "Porte" : "Fenêtre";
              return (
                <Group key={`o${i}`}>
                  <Rect
                    x={toX(c.start)}
                    y={toY(c.height)}
                    width={(c.end - c.start) * s}
                    height={openH * s}
                    fill={"#ffffff"}
                    stroke={theme.openingStroke}
                    strokeWidth={1}
                  />
                  {c.type === "window" && (
                    <>
                      <Line
                        points={[
                          toX(c.start),
                          toY((c.height + c.sillHeight) / 2),
                          toX(c.end),
                          toY((c.height + c.sillHeight) / 2),
                        ]}
                        stroke={theme.openingStroke}
                        strokeWidth={0.6}
                      />
                      <Rect
                        x={toX(c.start)}
                        y={toY(c.sillHeight)}
                        width={(c.end - c.start) * s}
                        height={c.sillHeight * s}
                        fill={theme.wallFill}
                        stroke={theme.wallStroke}
                        strokeWidth={1}
                      />
                    </>
                  )}
                  {sectionDisplay.showOpeningLabels && (
                    <Text
                      x={toX((c.start + c.end) / 2) - 80}
                      y={toY(c.height) - 18 - (i % 3) * 13}
                      width={160}
                      align="center"
                      text={`${kind} ${Math.round(openW)} × ${Math.round(openH)} cm`}
                      fontSize={9}
                      fontFamily="Inter"
                      fill={theme.dimension}
                    />
                  )}
                  {sectionDisplay.showVerticalDims && (
                    <>
                      <VerticalDim
                        xPos={toX(c.end) + 10}
                        yTop={toY(c.height)}
                        yBot={toY(c.sillHeight)}
                        label={m(openH)}
                        color={theme.dimension}
                      />
                      {c.type === "window" && (
                        <VerticalDim
                          xPos={toX(c.end) + 10}
                          yTop={toY(c.sillHeight)}
                          yBot={toY(0)}
                          label={m(c.sillHeight)}
                          color={theme.dimension}
                        />
                      )}
                    </>
                  )}
                </Group>
              );
            })}

          {/* Slab */}
          {sectionDisplay.showFloorHatch && (
            <Rect
              x={toX(-50)}
              y={toY(0)}
              width={(totalLen + 100) * s}
              height={16}
              fill={theme.wallFill}
            />
          )}

          {/* Levels */}
          {sectionDisplay.showLevels && (
            <Group>
              <Text
                x={toX(-50) - 55}
                y={toY(0) - 6}
                text="± 0.00"
                fontSize={10}
                fontFamily="JetBrains Mono"
                fill={theme.dimension}
              />
              <Text
                x={toX(-50) - 55}
                y={toY(data.ceilingH) - 6}
                text={`+ ${m(data.ceilingH)}`}
                fontSize={10}
                fontFamily="JetBrains Mono"
                fill={theme.dimension}
              />
              {plan.roof &&
                (() => {
                  const axis = sectionAxis(section);
                  const roofAxis = plan.roof.slopeAxis ?? "x";
                  const span = wallCuts.length
                    ? Math.max(...wallCuts.map((c) => c.end)) -
                      Math.min(...wallCuts.map((c) => c.start)) +
                      2 * plan.roof.overhang
                    : 0;
                  const visibleSlope =
                    axis === roofAxis && (plan.roof.kind === "flat" || plan.roof.kind === "mono");
                  const rise = visibleSlope
                    ? Math.tan((plan.roof.pitch * Math.PI) / 180) * Math.max(0, span)
                    : 0;
                  const lowInterior = plan.roof.eaveHeight;
                  const highInterior = plan.roof.eaveHeight + rise;
                  const lowExterior = lowInterior + roofThickness(plan.roof);
                  const highExterior = highInterior + roofThickness(plan.roof);
                  const labels =
                    rise >= 1
                      ? [
                          { text: `HSP bas + ${m(lowInterior)}`, y: lowInterior },
                          { text: `HSP haut + ${m(highInterior)}`, y: highInterior },
                          { text: `Ext. bas + ${m(lowExterior)}`, y: lowExterior },
                          { text: `Ext. haut + ${m(highExterior)}`, y: highExterior },
                        ]
                      : [{ text: `Ext. toit + ${m(lowExterior)}`, y: lowExterior }];
                  return (
                    <Group>
                      {labels.map((label, index) => (
                        <Text
                          key={label.text}
                          x={toX(-50) - 95}
                          y={toY(label.y) - 7 - index * 2}
                          width={90}
                          align="right"
                          text={label.text}
                          fontSize={8.5}
                          fontFamily="JetBrains Mono"
                          fill={theme.dimension}
                        />
                      ))}
                    </Group>
                  );
                })()}
            </Group>
          )}

          {/* Vertical dims: HSP / roof low-high */}
          {sectionDisplay.showVerticalDims &&
            wallCuts.length > 0 &&
            (() => {
              const xPos = toX(Math.max(...wallCuts.map((c) => c.end))) + 40;
              const dims = [
                <VerticalDim
                  key="hsp-low"
                  xPos={xPos}
                  yTop={toY(data.ceilingH)}
                  yBot={toY(0)}
                  label={`HSP ${m(data.ceilingH)}`}
                  color={theme.dimension}
                />,
              ];
              if (plan.roof) {
                const axis = sectionAxis(section);
                const roofAxis = plan.roof.slopeAxis ?? "x";
                const span =
                  Math.max(...wallCuts.map((c) => c.end)) -
                  Math.min(...wallCuts.map((c) => c.start)) +
                  2 * plan.roof.overhang;
                const rise =
                  axis === roofAxis && (plan.roof.kind === "flat" || plan.roof.kind === "mono")
                    ? Math.tan((plan.roof.pitch * Math.PI) / 180) * Math.max(0, span)
                    : 0;
                if (rise >= 1) {
                  const highInterior = plan.roof.eaveHeight + rise;
                  const highExterior = highInterior + roofThickness(plan.roof);
                  dims.push(
                    <VerticalDim
                      key="hsp-high"
                      xPos={xPos + 52}
                      yTop={toY(highInterior)}
                      yBot={toY(0)}
                      label={`HSP haut ${m(highInterior)}`}
                      color={theme.dimension}
                    />,
                    <VerticalDim
                      key="ext-high"
                      xPos={xPos + 106}
                      yTop={toY(highExterior)}
                      yBot={toY(0)}
                      label={`Ext. haut ${m(highExterior)}`}
                      color={theme.dimension}
                    />,
                  );
                }
              }
              return <>{dims}</>;
            })()}

          {/* Horizontal top dim */}
          {sectionDisplay.showHorizontalDims &&
            wallCuts.length > 0 &&
            (() => {
              const spanStart = Math.min(...wallCuts.map((c) => c.start));
              const spanEnd = Math.max(...wallCuts.map((c) => c.end));
              const spanLen = spanEnd - spanStart;
              return (
                <Group>
                  <Line
                    points={[toX(spanStart), topDimY, toX(spanEnd), topDimY]}
                    stroke={theme.dimension}
                    strokeWidth={1}
                  />
                  <Line
                    points={[toX(spanStart), topDimY + 5, toX(spanStart), topDimY - 5]}
                    stroke={theme.dimension}
                    strokeWidth={1}
                  />
                  <Line
                    points={[toX(spanEnd), topDimY + 5, toX(spanEnd), topDimY - 5]}
                    stroke={theme.dimension}
                    strokeWidth={1}
                  />
                  <Text
                    x={toX((spanStart + spanEnd) / 2) - 40}
                    y={topDimY - 15}
                    width={80}
                    align="center"
                    text={m(spanLen)}
                    fontSize={10}
                    fontFamily="JetBrains Mono"
                    fill={theme.dimension}
                  />
                </Group>
              );
            })()}
        </Layer>
      </Stage>
    </div>
  );
}

function VerticalDim({
  xPos,
  yTop,
  yBot,
  label,
  color,
}: {
  xPos: number;
  yTop: number;
  yBot: number;
  label: string;
  color: string;
}) {
  const midY = (yTop + yBot) / 2;
  return (
    <Group>
      <Line points={[xPos, yTop, xPos, yBot]} stroke={color} strokeWidth={0.8} />
      <Line points={[xPos - 4, yTop, xPos + 4, yTop]} stroke={color} strokeWidth={0.8} />
      <Line points={[xPos - 4, yBot, xPos + 4, yBot]} stroke={color} strokeWidth={0.8} />
      <Text
        x={xPos + 6}
        y={midY - 6}
        text={label}
        fontSize={10}
        fontFamily="JetBrains Mono"
        fill={color}
      />
    </Group>
  );
}

/** Export all sections as a single tall PNG dataURL (for TopBar). */
export async function exportAllSectionsPNG(): Promise<string | null> {
  // Rendered on demand via Konva stages already mounted — use a helper to render offscreen
  // For now, use html-to-image of the container? Konva only exports its own stages.
  // Simplest approach: reuse individual stage refs — but they're in components. So we regenerate offscreen with Konva.
  return null;
}
