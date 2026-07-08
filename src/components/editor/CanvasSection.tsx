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


export function CanvasSection() {
  const { plan, theme } = useEditor();
  const sections = useMemo(() => {
    const user = plan.sections;
    return user.length ? user : autoSectionsFromPlan(plan);
  }, [plan]);
  const [expanded, setExpanded] = useState<SectionLine | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (sections.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: theme.background }}>
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
              className="absolute right-2 top-2 z-[60] rounded border border-border bg-card px-3 py-1 text-xs font-medium hover:border-brass"
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

function SectionPanel({ section, fullscreen = false, onExpand }: { section: SectionLine; fullscreen?: boolean; onExpand?: () => void }) {
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
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
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
      if (!plan.roof || !wallCuts.length) return data.ceilingH;
      const spanStart = Math.min(...wallCuts.map((c) => c.start));
      const spanEnd = Math.max(...wallCuts.map((c) => c.end));
      const xL = spanStart - plan.roof.overhang;
      const xR = spanEnd + plan.roof.overhang;
      if (plan.roof.kind === "flat") return Math.max(data.ceilingH, plan.roof.eaveHeight + 20);
      if (plan.roof.kind === "mono") return Math.max(data.ceilingH, plan.roof.eaveHeight + Math.tan((plan.roof.pitch * Math.PI) / 180) * (xR - xL));
      return Math.max(data.ceilingH, plan.roof.eaveHeight + Math.tan((plan.roof.pitch * Math.PI) / 180) * ((spanEnd - spanStart) / 2 + plan.roof.overhang));
    })();
    const belowGround = 60;
    const totalH = roofMaxH + belowGround;
    const marginX = 60, marginY = 40;
    const availW = Math.max(100, size.w - marginX * 2);
    const availH = Math.max(100, size.h - marginY * 2);
    const fitScale = Math.min(availW / Math.max(1, totalLen), availH / Math.max(1, totalH));
    const originX = marginX;
    const originY = marginY + roofMaxH * fitScale;
    return { totalLen, cuts, wallCuts, roofMaxH, fitScale, originX, originY };
  }, [data, plan.roof, size.w, size.h]);

  const s = scale * layout.fitScale;
  const originX = layout.originX + pos.x;
  const originY = layout.originY + pos.y;
  const toX = (cm: number) => originX + cm * s;
  const toY = (heightCm: number) => originY - heightCm * s;

  const onWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    const oldScale = scale;
    const newScale = Math.max(0.3, Math.min(8, direction > 0 ? oldScale * factor : oldScale / factor));
    // Zoom around pointer
    const oldS = oldScale * layout.fitScale;
    const worldPt = { x: (pointer.x - originX) / oldS, y: -(pointer.y - originY) / oldS };
    const newS = newScale * layout.fitScale;
    const newOriginX = pointer.x - worldPt.x * newS;
    const newOriginY = pointer.y + worldPt.y * newS;
    setScale(newScale);
    setPos({ x: newOriginX - layout.originX, y: newOriginY - layout.originY });
  }, [scale, layout, originX, originY]);

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
  const onMouseUp = () => { setDragging(false); dragStart.current = null; };

  const resetView = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const { totalLen, cuts, wallCuts } = layout;
  const topDimY = originY - layout.roofMaxH * s - 20;

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-md border border-border" style={{ background: "#faf8f2" }}>
      <div
        onDoubleClick={onExpand}
        className="absolute left-2 top-2 z-10 cursor-pointer rounded bg-card/90 px-2 py-1 text-[11px] font-medium tracking-wide shadow-panel hover:border hover:border-brass"
        title="Double-cliquez pour agrandir"
      >
        {NAME_MAP[section.name] ?? `Coupe ${section.name}-${section.name}'`}
      </div>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {onExpand && !fullscreen && (
          <button
            onClick={onExpand}
            className="rounded border border-border bg-card/90 px-2 py-1 text-[10px] font-medium hover:border-brass"
            title="Plein écran"
          >⛶</button>
        )}
        <button
          onClick={resetView}
          className="rounded border border-border bg-card/90 px-2 py-1 text-[10px] font-medium hover:border-brass"
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
              <Rect x={toX(-50) - 20} y={originY} width={(totalLen + 100) * s + 40} height={30} fill={theme.floor} opacity={0.4} />
              <Line points={[toX(-50) - 20, originY, toX(totalLen + 50) + 20, originY]} stroke={theme.wallStroke} strokeWidth={1.5} />
            </Group>
          )}

          {/* Ceiling line */}
          <Line
            points={[toX(-50), toY(data.ceilingH), toX(totalLen + 50), toY(data.ceilingH)]}
            stroke={theme.wallStroke} strokeWidth={1} dash={[8, 4]}
          />

          {/* Roof */}
          {plan.roof && wallCuts.length > 0 && (() => {
            const spanStart = Math.min(...wallCuts.map((c) => c.start));
            const spanEnd = Math.max(...wallCuts.map((c) => c.end));
            const ov = plan.roof.overhang;
            const eave = plan.roof.eaveHeight;
            const pitchRad = (plan.roof.pitch * Math.PI) / 180;
            const half = (spanEnd - spanStart) / 2 + ov;
            const ridgeH = plan.roof.kind === "flat" ? eave + 20 : eave + Math.tan(pitchRad) * half;
            let poly: number[] = [];
            const xL = spanStart - ov, xR = spanEnd + ov;
            if (plan.roof.kind === "flat") {
              poly = [toX(xL), toY(eave + 20), toX(xR), toY(eave + 20), toX(xR), toY(eave), toX(xL), toY(eave)];
            } else if (plan.roof.kind === "mono") {
              const hi = eave + Math.tan(pitchRad) * (xR - xL);
              poly = [toX(xL), toY(eave), toX(xR), toY(hi), toX(xR), toY(hi - 15), toX(xL), toY(eave - 15)];
            } else {
              const midX = (xL + xR) / 2;
              poly = [
                toX(xL), toY(eave),
                toX(midX), toY(ridgeH),
                toX(xR), toY(eave),
                toX(xR), toY(eave - 15),
                toX(midX), toY(ridgeH - 15),
                toX(xL), toY(eave - 15),
              ];
            }
            return <Line points={poly} closed fill={theme.wallFill} stroke={theme.wallStroke} strokeWidth={1} opacity={0.9} />;
          })()}

          {/* Elevation walls (behind — draw first, greyed) */}
          {data.elevationWalls?.map((ew, i) => (
            <Rect
              key={`ew${i}`}
              x={toX(ew.start)} y={toY(ew.height)}
              width={(ew.end - ew.start) * s} height={ew.height * s}
              fill={theme.wallFill} stroke={theme.wallStroke} strokeWidth={0.6}
              opacity={0.35}
            />
          ))}

          {/* Cut walls (poché) */}
          {cuts.filter((c) => c.type === "wall").map((c, i) => (
            <Rect
              key={`w${i}`}
              x={toX(c.start)} y={toY(c.height)}
              width={(c.end - c.start) * s} height={c.height * s}
              fill={theme.wallFill} stroke={theme.wallStroke} strokeWidth={1}
            />
          ))}


          {/* Openings */}
          {cuts.filter((c) => c.type !== "wall").map((c, i) => {
            const openH = c.height - c.sillHeight;
            const openW = c.opening?.width ?? (c.end - c.start);
            const kind = c.type === "door" ? "Porte" : "Fenêtre";
            return (
              <Group key={`o${i}`}>
                <Rect
                  x={toX(c.start)} y={toY(c.height)}
                  width={(c.end - c.start) * s} height={openH * s}
                  fill={"#faf8f2"} stroke={theme.openingStroke} strokeWidth={1}
                />
                {c.type === "window" && (
                  <>
                    <Line
                      points={[toX(c.start), toY((c.height + c.sillHeight) / 2), toX(c.end), toY((c.height + c.sillHeight) / 2)]}
                      stroke={theme.openingStroke} strokeWidth={0.6}
                    />
                    <Rect
                      x={toX(c.start)} y={toY(c.sillHeight)}
                      width={(c.end - c.start) * s} height={c.sillHeight * s}
                      fill={theme.wallFill} stroke={theme.wallStroke} strokeWidth={1}
                    />
                  </>
                )}
                {sectionDisplay.showOpeningLabels && (
                  <Text
                    x={toX((c.start + c.end) / 2) - 80}
                    y={toY(c.height) - 18}
                    width={160} align="center"
                    text={`${kind} ${Math.round(openW)}×${Math.round(openH)}`}
                    fontSize={10} fontFamily="Inter" fill={theme.dimension}
                  />
                )}
                {sectionDisplay.showVerticalDims && (
                  <>
                    <VerticalDim xPos={toX(c.end) + 10} yTop={toY(c.height)} yBot={toY(c.sillHeight)} label={`${Math.round(openH)}`} color={theme.dimension} />
                    {c.type === "window" && (
                      <VerticalDim xPos={toX(c.end) + 10} yTop={toY(c.sillHeight)} yBot={toY(0)} label={`${Math.round(c.sillHeight)}`} color={theme.dimension} />
                    )}
                  </>
                )}
              </Group>
            );
          })}

          {/* Slab */}
          {sectionDisplay.showFloorHatch && (
            <Rect x={toX(-50)} y={toY(0)} width={(totalLen + 100) * s} height={16} fill={theme.wallFill} />
          )}

          {/* Levels */}
          {sectionDisplay.showLevels && (
            <Group>
              <Text x={toX(-50) - 55} y={toY(0) - 6} text="± 0.00" fontSize={10} fontFamily="JetBrains Mono" fill={theme.dimension} />
              <Text x={toX(-50) - 55} y={toY(data.ceilingH) - 6} text={`+ ${(data.ceilingH / 100).toFixed(2)}`} fontSize={10} fontFamily="JetBrains Mono" fill={theme.dimension} />
            </Group>
          )}

          {/* Vertical dim: HSP right side */}
          {sectionDisplay.showVerticalDims && wallCuts.length > 0 && (
            <VerticalDim
              xPos={toX(Math.max(...wallCuts.map(c => c.end))) + 40}
              yTop={toY(data.ceilingH)} yBot={toY(0)}
              label={`${(data.ceilingH / 100).toFixed(2)} m`} color={theme.dimension}
            />
          )}

          {/* Horizontal top dim */}
          {sectionDisplay.showHorizontalDims && wallCuts.length > 0 && (() => {
            const spanStart = Math.min(...wallCuts.map((c) => c.start));
            const spanEnd = Math.max(...wallCuts.map((c) => c.end));
            const spanLen = spanEnd - spanStart;
            return (
              <Group>
                <Line points={[toX(spanStart), topDimY, toX(spanEnd), topDimY]} stroke={theme.dimension} strokeWidth={1} />
                <Line points={[toX(spanStart), topDimY + 5, toX(spanStart), topDimY - 5]} stroke={theme.dimension} strokeWidth={1} />
                <Line points={[toX(spanEnd), topDimY + 5, toX(spanEnd), topDimY - 5]} stroke={theme.dimension} strokeWidth={1} />
                <Text x={toX((spanStart + spanEnd) / 2) - 40} y={topDimY - 15} width={80} align="center" text={`${(spanLen / 100).toFixed(2)} m`} fontSize={10} fontFamily="JetBrains Mono" fill={theme.dimension} />
              </Group>
            );
          })()}
        </Layer>
      </Stage>
    </div>
  );
}

function VerticalDim({ xPos, yTop, yBot, label, color }: { xPos: number; yTop: number; yBot: number; label: string; color: string }) {
  const midY = (yTop + yBot) / 2;
  return (
    <Group>
      <Line points={[xPos, yTop, xPos, yBot]} stroke={color} strokeWidth={0.8} />
      <Line points={[xPos - 4, yTop, xPos + 4, yTop]} stroke={color} strokeWidth={0.8} />
      <Line points={[xPos - 4, yBot, xPos + 4, yBot]} stroke={color} strokeWidth={0.8} />
      <Text x={xPos + 6} y={midY - 6} text={label} fontSize={10} fontFamily="JetBrains Mono" fill={color} />
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
