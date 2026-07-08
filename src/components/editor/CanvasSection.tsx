import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Rect, Group, Text } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import { autoSectionsFromPlan, computeSection } from "@/lib/editor/sections";

const MARGIN_X = 90;
const MARGIN_Y = 90;

export function CanvasSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  const { plan, activeSectionId, setActiveSection, sectionDisplay, theme } = useEditor();
  const userSections = plan.sections;
  const autoSections = useMemo(() => (userSections.length ? [] : autoSectionsFromPlan(plan)), [plan, userSections.length]);
  const sections = userSections.length ? userSections : autoSections;

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const active = sections.find((s) => s.id === activeSectionId) ?? sections[0];

  useEffect(() => {
    if (!activeSectionId && sections[0]) setActiveSection(sections[0].id);
  }, [sections, activeSectionId, setActiveSection]);

  const data = useMemo(() => (active ? computeSection(plan, active) : null), [plan, active]);

  if (!active || !data) {
    return (
      <div ref={containerRef} className="flex h-full w-full items-center justify-center" style={{ background: theme.background }}>
        <div className="max-w-md rounded-md border border-dashed border-border bg-card/70 p-6 text-center">
          <div className="mb-2 font-display text-lg">Aucun plan à couper</div>
          <p className="text-sm text-muted-foreground">
            Dessinez d'abord quelques murs pour générer automatiquement des vues en coupe (A-A' et B-B').
          </p>
        </div>
      </div>
    );
  }

  const totalLen = data.length;
  const totalH = data.ceilingH + 60; // include some ground below

  // Fit-to-view scale
  const availW = Math.max(200, size.w - MARGIN_X * 2 - 120);
  const availH = Math.max(200, size.h - MARGIN_Y * 2 - 80);
  const scale = Math.min(availW / totalLen, availH / totalH);
  const originX = MARGIN_X;
  const originY = MARGIN_Y + totalH * scale; // ground line (y=0 world) sits here; up is negative y in canvas

  const toX = (cm: number) => originX + cm * scale;
  const toY = (heightCm: number) => originY - heightCm * scale;

  // Sort cuts along the line
  const cuts = [...data.cuts].sort((a, b) => a.start - b.start || a.end - b.end);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: theme.background }}>
      <Stage ref={stageRef} width={size.w} height={size.h}>
        <Layer>
          {/* Ground hatching */}
          {sectionDisplay.showGround && (
            <Group>
              <Rect x={toX(-50) - 20} y={originY} width={(totalLen + 100) * scale + 40} height={40} fill={theme.floor} opacity={0.4} />
              {Array.from({ length: 40 }).map((_, i) => {
                const x = toX(-50) - 20 + i * 20;
                return (
                  <Line key={i} points={[x, originY, x + 20, originY + 20]} stroke={theme.dimension} strokeWidth={0.5} opacity={0.6} />
                );
              })}
              <Line points={[toX(-50) - 20, originY, toX(totalLen + 50) + 20, originY]} stroke={theme.wallStroke} strokeWidth={1.5} />
            </Group>
          )}

          {/* Ceiling line */}
          <Line
            points={[toX(-50), toY(data.ceilingH), toX(totalLen + 50), toY(data.ceilingH)]}
            stroke={theme.wallStroke} strokeWidth={1}
            dash={[8, 4]}
          />

          {/* Furniture (elevation, behind walls) */}
          {sectionDisplay.showFurniture && data.furn.map((f, i) => {
            const item = CATALOG.find((c) => c.kind === f.furniture.kind);
            const opacity = Math.max(0.25, 1 - Math.abs(f.depthFromLine) / 400);
            return (
              <Group key={i} opacity={opacity}>
                <Rect
                  x={toX(f.start)} y={toY(f.height)}
                  width={(f.end - f.start) * scale} height={f.height * scale}
                  fill="transparent" stroke={theme.furnitureStroke} strokeWidth={0.8}
                />
                <Text
                  x={toX(f.start)} y={toY(f.height) - 14}
                  text={item?.label ?? ""} fontSize={9}
                  fontFamily="Inter" fill={theme.dimension}
                />
              </Group>
            );
          })}

          {/* Walls (poché) */}
          {cuts.filter((c) => c.type === "wall").map((c, i) => (
            <Rect
              key={`w${i}`}
              x={toX(c.start)} y={toY(c.height)}
              width={(c.end - c.start) * scale} height={c.height * scale}
              fill={theme.wallFill} stroke={theme.wallStroke} strokeWidth={1}
            />
          ))}

          {/* Openings — draw a "hole" over the wall */}
          {cuts.filter((c) => c.type !== "wall").map((c, i) => {
            const openH = (c.height - c.sillHeight);
            return (
              <Group key={`o${i}`}>
                {/* void */}
                <Rect
                  x={toX(c.start)} y={toY(c.height)}
                  width={(c.end - c.start) * scale} height={openH * scale}
                  fill={theme.background} stroke={theme.openingStroke} strokeWidth={1}
                />
                {c.type === "window" && (
                  <>
                    <Line
                      points={[toX(c.start), toY((c.height + c.sillHeight) / 2), toX(c.end), toY((c.height + c.sillHeight) / 2)]}
                      stroke={theme.openingStroke} strokeWidth={0.6}
                    />
                    {/* sill wall below */}
                    <Rect
                      x={toX(c.start)} y={toY(c.sillHeight)}
                      width={(c.end - c.start) * scale} height={c.sillHeight * scale}
                      fill={theme.wallFill} stroke={theme.wallStroke} strokeWidth={1}
                    />
                  </>
                )}
                {sectionDisplay.showOpeningLabels && (
                  <Text
                    x={toX((c.start + c.end) / 2) - 30}
                    y={toY(c.height) - 16}
                    width={60} align="center"
                    text={c.type === "door" ? "Porte" : "Fenêtre"}
                    fontSize={9} fontFamily="Inter" fill={theme.dimension}
                  />
                )}
                {sectionDisplay.showVerticalDims && (
                  <>
                    {/* height dim on the right */}
                    <VerticalDim
                      xPos={toX(c.end) + 12}
                      yTop={toY(c.height)} yBot={toY(c.sillHeight)}
                      label={`${Math.round(openH)}`} color={theme.dimension}
                    />
                    {c.type === "window" && (
                      <VerticalDim
                        xPos={toX(c.end) + 12}
                        yTop={toY(c.sillHeight)} yBot={toY(0)}
                        label={`${Math.round(c.sillHeight)}`} color={theme.dimension}
                      />
                    )}
                  </>
                )}
              </Group>
            );
          })}

          {/* Slab below floor */}
          {sectionDisplay.showFloorHatch && (
            <Rect x={toX(-50)} y={toY(0)} width={(totalLen + 100) * scale} height={20} fill={theme.wallFill} />
          )}

          {/* Level indicators */}
          {sectionDisplay.showLevels && (
            <Group>
              <Text x={toX(-50) - 60} y={toY(0) - 6} text="± 0.00" fontSize={10} fontFamily="JetBrains Mono" fill={theme.dimension} />
              <Text x={toX(-50) - 60} y={toY(data.ceilingH) - 6} text={`+ ${(data.ceilingH / 100).toFixed(2)}`} fontSize={10} fontFamily="JetBrains Mono" fill={theme.dimension} />
              <Text x={toX(-50) - 60} y={toY(210) - 6} text="+ 2.10" fontSize={9} fontFamily="JetBrains Mono" fill={theme.dimension} opacity={0.7} />
            </Group>
          )}

          {/* Vertical dim: ceiling */}
          {sectionDisplay.showVerticalDims && (
            <VerticalDim
              xPos={toX(totalLen) + 60}
              yTop={toY(data.ceilingH)} yBot={toY(0)}
              label={`${(data.ceilingH / 100).toFixed(2)} m`} color={theme.dimension}
            />
          )}

          {/* Horizontal dimensions along the top — based on actual cut extents (not the padded section line) */}
          {sectionDisplay.showHorizontalDims && cuts.length > 0 && (() => {
            const wallCuts = cuts.filter((c) => c.type === "wall");
            const spanStart = wallCuts.length ? Math.min(...wallCuts.map((c) => c.start)) : cuts[0].start;
            const spanEnd = wallCuts.length ? Math.max(...wallCuts.map((c) => c.end)) : cuts[cuts.length - 1].end;
            const spanLen = spanEnd - spanStart;
            return (
              <Group>
                <Line
                  points={[toX(spanStart), MARGIN_Y - 30, toX(spanEnd), MARGIN_Y - 30]}
                  stroke={theme.dimension} strokeWidth={1}
                />
                <Line points={[toX(spanStart), MARGIN_Y - 24, toX(spanStart), MARGIN_Y - 36]} stroke={theme.dimension} strokeWidth={1} />
                <Line points={[toX(spanEnd), MARGIN_Y - 24, toX(spanEnd), MARGIN_Y - 36]} stroke={theme.dimension} strokeWidth={1} />
                <Text
                  x={toX((spanStart + spanEnd) / 2) - 40}
                  y={MARGIN_Y - 46}
                  width={80} align="center"
                  text={`${(spanLen / 100).toFixed(2)} m`}
                  fontSize={11} fontFamily="JetBrains Mono" fill={theme.dimension}
                />
                {/* per-cut widths (walls only) */}
                {wallCuts.map((c, i) => (
                  <Group key={`hd${i}`}>
                    <Line points={[toX(c.start), MARGIN_Y - 12, toX(c.end), MARGIN_Y - 12]} stroke={theme.dimension} strokeWidth={0.6} />
                    <Text
                      x={toX((c.start + c.end) / 2) - 20} y={MARGIN_Y - 24}
                      width={40} align="center"
                      text={`${Math.round(c.end - c.start)}`}
                      fontSize={9} fontFamily="JetBrains Mono" fill={theme.dimension} opacity={0.8}
                    />
                  </Group>
                ))}
              </Group>
            );
          })()}


          {/* Title */}
          <Text
            x={MARGIN_X} y={size.h - 50}
            text={`Coupe ${active.name}-${active.name}'`}
            fontSize={22} fontFamily="Fraunces" fill={theme.dimension}
          />
          <Text
            x={MARGIN_X} y={size.h - 24}
            text={`Échelle 1:${Math.round(100 / scale / 10) * 10}   ·   H.S.P. ${(data.ceilingH / 100).toFixed(2)} m`}
            fontSize={11} fontFamily="JetBrains Mono" fill={theme.dimension} opacity={0.7}
          />
        </Layer>
      </Stage>

      {sections.length > 1 && (
        <div className="absolute right-3 top-3 flex gap-1 rounded-md border border-border bg-card/90 p-1 shadow-panel">
          {sections.map((s) => (
            <button
              key={s.id} onClick={() => setActiveSection(s.id)}
              className={`rounded px-2 py-1 text-xs font-medium ${s.id === active.id ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink"}`}
            >
              {s.name}-{s.name}'
            </button>
          ))}
        </div>
      )}
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

export function exportSectionPNG(): string | null {
  return null; // handled via stage ref elsewhere if needed
}
