import { useEffect, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { wallLength } from "@/lib/editor/geometry";
import { openingHeight, openingSill } from "@/lib/editor/opening-defaults";
import type { OpeningKind, Plan } from "@/lib/editor/types";

function syncedCeilingHeight(plan: Plan) {
  const fallback = plan.ceilingHeight ?? 250;
  const exterior = plan.walls.filter((w) => (w.wallType ?? "exterior") === "exterior");
  const source = exterior.length ? exterior : plan.walls;
  const exteriorH = source.length ? Math.max(...source.map((w) => w.height ?? fallback)) : fallback;
  return Math.max(1, exteriorH);
}

function planLengthAxis(plan: Plan): "x" | "y" {
  if (!plan.walls.length) return "x";
  const xs = plan.walls.flatMap((w) => [w.a.x, w.b.x]);
  const ys = plan.walls.flatMap((w) => [w.a.y, w.b.y]);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  return spanX >= spanY ? "x" : "y";
}

function planWidthAxis(plan: Plan): "x" | "y" {
  return planLengthAxis(plan) === "x" ? "y" : "x";
}

const SLOPE_SIDE_LABEL: Record<"x" | "y", Record<1 | -1, string>> = {
  x: { 1: "côté gauche", [-1]: "côté droit" },
  y: { 1: "côté haut", [-1]: "côté bas" },
};

const KIND_LABELS: Record<OpeningKind, string> = {
  door_simple: "Simple",
  door_double: "Double",
  door_slide: "Coulissante",
  door_pocket: "Galandage",
  entrance: "Entrée",
  window_1: "1 vantail",
  window_2: "2 vantaux",
  window_oscillo: "Oscillo-batt.",
  bay: "Baie vitrée",
  bay_slide: "Baie coulissante",
  fixed: "Châssis fixe",
};

export function RightPanel() {
  const {
    plan,
    selection,
    view,
    updateWall,
    resizeWallLength,
    updateFurniture,
    updateOpening,
    updateSection,
    deleteSelected,
    showGrid,
    showDimensions,
    snapEnabled,
    grid,
    showExteriorDims,
    showInteriorDims,
    toggleExteriorDims,
    toggleInteriorDims,
    toggleGrid,
    toggleDimensions,
    toggleSnap,
    sectionDisplay,
    setSectionDisplay,
    setCeilingHeight,
    setRoof,
  } = useEditor();

  const displayedCeilingHeight = syncedCeilingHeight(plan);
  const wall = selection?.type === "wall" ? plan.walls.find((w) => w.id === selection.id) : null;
  const furn =
    selection?.type === "furniture" ? plan.furniture.find((f) => f.id === selection.id) : null;
  const opening =
    selection?.type === "opening" ? plan.openings.find((o) => o.id === selection.id) : null;
  const sec =
    selection?.type === "section" ? plan.sections.find((x) => x.id === selection.id) : null;
  const multi = selection?.type === "multi" ? selection.items : null;

  // In section view: show display toggles
  if (view === "section") {
    return (
      <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card/60 backdrop-blur">
        <div className="border-b border-border px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Coupe — affichage
          </div>
          <div className="mt-1 font-display text-lg">Options</div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <NumberField
              label="Hauteur sous plafond (cm)"
              value={displayedCeilingHeight}
              min={200}
              max={600}
              onChange={(v) => setCeilingHeight(v)}
            />
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              HSP = hauteur intérieure au support bas du toit. Le toit se pose au-dessus des murs
              extérieurs; en pente, la coupe indique aussi les niveaux bas/haut.
            </p>
          </div>

          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Toiture
            </div>
            <div className="grid grid-cols-4 gap-1 rounded border border-border bg-background p-0.5">
              {(["none", "flat", "mono", "gable"] as const).map((k) => {
                const active = k === "none" ? !plan.roof : plan.roof?.kind === k;
                const lengthAxis = planLengthAxis(plan);
                return (
                  <button
                    key={k}
                    onClick={() =>
                      k === "none"
                        ? setRoof(null)
                        : setRoof({
                            kind: k,
                            eaveHeight:
                              plan.roof?.eaveHeight ??
                              Math.max(
                                ...plan.walls.map((w) => w.height ?? plan.ceilingHeight ?? 250),
                                plan.ceilingHeight ?? 250,
                              ),
                            pitch: plan.roof?.pitch ?? (k === "flat" ? 1 : 30),
                            thickness: plan.roof?.thickness ?? 20,
                            overhang: plan.roof?.overhang ?? 0,
                            slopeAxis: plan.roof?.slopeAxis ?? lengthAxis,
                            ridgeAxis: plan.roof?.ridgeAxis ?? lengthAxis,
                          })
                    }
                    className={`rounded px-1.5 py-1 text-[10px] font-medium ${active ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink"}`}
                  >
                    {k === "none"
                      ? "Aucun"
                      : k === "flat"
                        ? "Plat"
                        : k === "mono"
                          ? "1 pan"
                          : "2 pans"}
                  </button>
                );
              })}
            </div>
            {plan.roof && (
              <div className="space-y-2">
                <NumberField
                  label="Hauteur support toiture / murs ext. (cm)"
                  value={plan.roof.eaveHeight}
                  min={200}
                  max={600}
                  onChange={(v) => setRoof({ eaveHeight: v })}
                />
                <NumberField
                  label="Épaisseur toiture (cm)"
                  value={plan.roof.thickness ?? 20}
                  min={5}
                  max={120}
                  onChange={(v) => setRoof({ thickness: v })}
                />
                <NumberField
                  label="Pente (°)"
                  value={plan.roof.pitch}
                  min={0}
                  max={60}
                  onChange={(v) => setRoof({ pitch: v })}
                />
                <NumberField
                  label="Débord (cm)"
                  value={plan.roof.overhang}
                  min={0}
                  max={150}
                  onChange={(v) => setRoof({ overhang: v })}
                />
                {(plan.roof.kind === "flat" || plan.roof.kind === "mono") && (
                  <div className="space-y-2 rounded border border-border bg-background/50 p-2">
                    <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      Sens de pente
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded border border-border bg-card p-0.5">
                      {(
                        [
                          { label: "Longueur", axis: planLengthAxis(plan) },
                          { label: "Largeur", axis: planWidthAxis(plan) },
                        ] as const
                      ).map(({ label, axis }) => (
                        <button
                          key={label}
                          onClick={() => setRoof({ slopeAxis: axis })}
                          className={`rounded px-2 py-1 text-[10px] font-medium ${
                            (plan.roof?.slopeAxis ?? planLengthAxis(plan)) === axis
                              ? "bg-ink text-paper"
                              : "text-muted-foreground hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1 rounded border border-border bg-card p-0.5">
                      {([1, -1] as const).map((direction) => (
                        <button
                          key={direction}
                          onClick={() => setRoof({ slopeDirection: direction })}
                          className={`rounded px-2 py-1 text-[10px] font-medium ${
                            (plan.roof?.slopeDirection ?? 1) === direction
                              ? "bg-ink text-paper"
                              : "text-muted-foreground hover:text-ink"
                          }`}
                        >
                          Bas{" "}
                          {
                            SLOPE_SIDE_LABEL[plan.roof?.slopeAxis ?? planLengthAxis(plan)][
                              direction
                            ]
                          }
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <ToggleRow
              label="Cotes verticales"
              active={sectionDisplay.showVerticalDims}
              onClick={() =>
                setSectionDisplay({ showVerticalDims: !sectionDisplay.showVerticalDims })
              }
            />
            <ToggleRow
              label="Cotes horizontales"
              active={sectionDisplay.showHorizontalDims}
              onClick={() =>
                setSectionDisplay({ showHorizontalDims: !sectionDisplay.showHorizontalDims })
              }
            />
            <ToggleRow
              label="Niveaux (± 0.00)"
              active={sectionDisplay.showLevels}
              onClick={() => setSectionDisplay({ showLevels: !sectionDisplay.showLevels })}
            />
            <ToggleRow
              label="Hachurage sol"
              active={sectionDisplay.showFloorHatch}
              onClick={() => setSectionDisplay({ showFloorHatch: !sectionDisplay.showFloorHatch })}
            />
            <ToggleRow
              label="Terrain naturel"
              active={sectionDisplay.showGround}
              onClick={() => setSectionDisplay({ showGround: !sectionDisplay.showGround })}
            />
            <ToggleRow
              label="Mobilier en élévation"
              active={sectionDisplay.showFurniture}
              onClick={() => setSectionDisplay({ showFurniture: !sectionDisplay.showFurniture })}
            />
            <ToggleRow
              label="Étiquettes ouvertures"
              active={sectionDisplay.showOpeningLabels}
              onClick={() =>
                setSectionDisplay({ showOpeningLabels: !sectionDisplay.showOpeningLabels })
              }
            />
            <ToggleRow
              label="Axes de repère"
              active={sectionDisplay.showAxes}
              onClick={() => setSectionDisplay({ showAxes: !sectionDisplay.showAxes })}
            />
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3 text-[11px] text-muted-foreground">
            Les 4 coupes (Nord, Sud, Est, Ouest) sont générées automatiquement à partir du plan.
            Molette pour zoomer, clic-glisser pour déplacer.
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card/60 backdrop-blur">
      <div className="border-b border-border px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Propriétés
        </div>
        <div className="mt-1 font-display text-lg">
          {multi
            ? `${multi.length} éléments`
            : wall
              ? "Mur"
              : furn
                ? (furn.label ?? "Mobilier")
                : opening
                  ? opening.type === "door"
                    ? "Porte"
                    : "Fenêtre"
                  : sec
                    ? `Coupe ${sec.name}-${sec.name}'`
                    : "—"}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!selection && (
          <div className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
            Sélectionnez un élément avec l'outil{" "}
            <span className="font-medium text-ink">Sélection</span> pour éditer ses propriétés.
          </div>
        )}

        {multi && (
          <div className="space-y-3">
            <div className="rounded-md border border-brass/40 bg-brass/5 p-3 text-xs">
              <div className="font-medium text-ink">Sélection multiple</div>
              <div className="mt-1 text-muted-foreground">{multi.length} éléments sélectionnés</div>
            </div>
            <button
              onClick={() => useEditor.getState().duplicateSelected()}
              className="w-full rounded-md border border-border bg-background py-2 text-xs font-medium hover:border-brass hover:bg-brass/10"
            >
              Copier / dupliquer
            </button>
            <button
              onClick={deleteSelected}
              className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              Supprimer la sélection
            </button>
          </div>
        )}

        {wall &&
          (() => {
            const axisLen = wallLength(wall);
            return (
              <div className="space-y-3">
                <NumberField
                  label="Longueur (cm)"
                  value={Math.round(axisLen)}
                  min={10}
                  max={5000}
                  onChange={(v) => resizeWallLength(wall.id, Math.max(10, v))}
                />

                <div>
                  <div className="mb-1 block text-xs font-medium text-muted-foreground">Type</div>
                  <div className="grid grid-cols-2 gap-1 rounded border border-border bg-background p-0.5">
                    {(["exterior", "interior"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          const spec = useEditor.getState().wallSettings[t];
                          updateWall(wall.id, {
                            wallType: t,
                            thickness: spec.thickness,
                            height: spec.height,
                          });
                        }}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                          (wall.wallType ?? "exterior") === t
                            ? "bg-ink text-paper"
                            : "text-muted-foreground hover:text-ink"
                        }`}
                      >
                        {t === "exterior" ? "Extérieur" : "Intérieur"}
                      </button>
                    ))}
                  </div>
                </div>
                <NumberField
                  label="Épaisseur (cm)"
                  value={wall.thickness}
                  min={5}
                  max={80}
                  onChange={(v) => updateWall(wall.id, { thickness: v })}
                />
                <NumberField
                  label="Hauteur (cm)"
                  value={wall.height ?? 250}
                  min={100}
                  max={600}
                  onChange={(v) => updateWall(wall.id, { height: v })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="A.x"
                    value={Math.round(wall.a.x)}
                    onChange={(v) => updateWall(wall.id, { a: { ...wall.a, x: v } })}
                  />
                  <NumberField
                    label="A.y"
                    value={Math.round(wall.a.y)}
                    onChange={(v) => updateWall(wall.id, { a: { ...wall.a, y: v } })}
                  />
                  <NumberField
                    label="B.x"
                    value={Math.round(wall.b.x)}
                    onChange={(v) => updateWall(wall.id, { b: { ...wall.b, x: v } })}
                  />
                  <NumberField
                    label="B.y"
                    value={Math.round(wall.b.y)}
                    onChange={(v) => updateWall(wall.id, { b: { ...wall.b, y: v } })}
                  />
                </div>
                <button
                  onClick={deleteSelected}
                  className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Supprimer le mur
                </button>
                <button
                  onClick={() => useEditor.getState().duplicateSelected()}
                  className="w-full rounded-md border border-border bg-background py-2 text-xs font-medium hover:border-brass hover:bg-brass/10"
                >
                  Copier le mur
                </button>
              </div>
            );
          })()}

        {furn && (
          <div className="space-y-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">Nom</span>
              <input
                value={furn.label ?? ""}
                onChange={(e) => updateFurniture(furn.id, { label: e.target.value })}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brass"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Largeur (cm)"
                value={Math.round(furn.width)}
                min={10}
                max={800}
                onChange={(v) => updateFurniture(furn.id, { width: v })}
              />
              <NumberField
                label="Profondeur (cm)"
                value={Math.round(furn.height)}
                min={10}
                max={800}
                onChange={(v) => updateFurniture(furn.id, { height: v })}
              />
            </div>
            <NumberField
              label="Hauteur (cm)"
              value={furn.zHeight ?? 60}
              min={1}
              max={400}
              onChange={(v) => updateFurniture(furn.id, { zHeight: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="X (cm)"
                value={Math.round(furn.x)}
                onChange={(v) => updateFurniture(furn.id, { x: v })}
              />
              <NumberField
                label="Y (cm)"
                value={Math.round(furn.y)}
                onChange={(v) => updateFurniture(furn.id, { y: v })}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Rotation</span>
                <span className="font-mono-tab">{Math.round(furn.rotation)}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                value={furn.rotation}
                onChange={(e) => updateFurniture(furn.id, { rotation: Number(e.target.value) })}
                className="w-full accent-[color:var(--brass)]"
              />
              <div className="mt-1 flex gap-1">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => updateFurniture(furn.id, { rotation: deg })}
                    className="flex-1 rounded border border-border bg-background py-1 text-[11px] hover:border-brass"
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={deleteSelected}
              className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              Supprimer
            </button>
            <button
              onClick={() => useEditor.getState().duplicateSelected()}
              className="w-full rounded-md border border-border bg-background py-2 text-xs font-medium hover:border-brass hover:bg-brass/10"
            >
              Copier le mobilier
            </button>
          </div>
        )}

        {opening && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 block text-xs font-medium text-muted-foreground">
                Type d'ouverture
              </div>
              <div className="grid grid-cols-2 gap-1 rounded border border-border bg-background p-0.5">
                {(opening.type === "door"
                  ? ([
                      "door_simple",
                      "door_double",
                      "door_slide",
                      "door_pocket",
                      "entrance",
                    ] as const)
                  : ([
                      "window_1",
                      "window_2",
                      "window_oscillo",
                      "bay",
                      "bay_slide",
                      "fixed",
                    ] as const)
                ).map((k) => (
                  <button
                    key={k}
                    onClick={() => updateOpening(opening.id, { kind: k })}
                    className={`rounded px-2 py-1 text-[10.5px] font-medium transition-colors ${
                      (opening.kind ?? (opening.type === "door" ? "door_simple" : "window_1")) === k
                        ? "bg-ink text-paper"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            {opening.type === "door" && (
              <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background/50 p-2">
                <button
                  onClick={() => useEditor.getState().flipOpeningHinge(opening.id)}
                  className="rounded border border-border bg-card py-1.5 text-[11px] font-medium hover:border-brass hover:bg-brass/10"
                >
                  ⇄ Charnière {opening.hingeSide === "b" ? "→ droite" : "← gauche"}
                </button>
                <button
                  onClick={() => useEditor.getState().flipOpeningSwing(opening.id)}
                  className="rounded border border-border bg-card py-1.5 text-[11px] font-medium hover:border-brass hover:bg-brass/10"
                >
                  ⇅ Sens {opening.swingSide === "n" ? "intérieur" : "extérieur"}
                </button>
                <div className="col-span-2 text-[10px] text-muted-foreground">
                  Astuce&nbsp;: <kbd className="rounded border border-border bg-card px-1">Tab</kbd>{" "}
                  cycle les 4 combinaisons ·{" "}
                  <kbd className="rounded border border-border bg-card px-1">←</kbd>/
                  <kbd className="rounded border border-border bg-card px-1">→</kbd> déplace le long
                  du mur.
                </div>
              </div>
            )}

            <div>
              <div className="mb-1 block text-xs font-medium text-muted-foreground">
                Tailles standard NF
              </div>
              <div className="flex flex-wrap gap-1">
                {(opening.type === "door"
                  ? [
                      { w: 63, h: 204 },
                      { w: 73, h: 204 },
                      { w: 83, h: 204 },
                      { w: 93, h: 215 },
                    ]
                  : [
                      { w: 60, h: 75 },
                      { w: 80, h: 100 },
                      { w: 100, h: 100 },
                      { w: 100, h: 125 },
                      { w: 120, h: 125 },
                      { w: 140, h: 125 },
                      { w: 180, h: 215 },
                      { w: 240, h: 215 },
                    ]
                ).map((sz) => (
                  <button
                    key={`${sz.w}x${sz.h}`}
                    onClick={() => updateOpening(opening.id, { width: sz.w, height: sz.h })}
                    className={`rounded border px-1.5 py-1 font-mono-tab text-[10px] hover:border-brass ${
                      opening.width === sz.w && (opening.height ?? 0) === sz.h
                        ? "border-brass bg-brass/10"
                        : "border-border bg-card"
                    }`}
                  >
                    {sz.w}×{sz.h}
                  </button>
                ))}
              </div>
            </div>

            <NumberField
              label="Largeur (cm)"
              value={opening.width}
              min={40}
              max={400}
              onChange={(v) => updateOpening(opening.id, { width: v })}
            />
            <NumberField
              label="Hauteur (cm)"
              value={openingHeight(opening)}
              min={40}
              max={300}
              onChange={(v) => updateOpening(opening.id, { height: v })}
            />
            {opening.type === "window" && (
              <NumberField
                label="Allège (cm)"
                value={openingSill(opening)}
                min={0}
                max={200}
                onChange={(v) => updateOpening(opening.id, { sillHeight: v })}
              />
            )}

            <button
              onClick={deleteSelected}
              className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              Supprimer
            </button>
            <button
              onClick={() => useEditor.getState().duplicateSelected()}
              className="w-full rounded-md border border-border bg-background py-2 text-xs font-medium hover:border-brass hover:bg-brass/10"
            >
              Copier l'ouverture
            </button>
          </div>
        )}

        {sec && (
          <div className="space-y-3">
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-muted-foreground">Nom</span>
              <input
                value={sec.name}
                onChange={(e) =>
                  updateSection(sec.id, { name: e.target.value.toUpperCase().slice(0, 2) })
                }
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-brass"
              />
            </label>
            <button
              onClick={deleteSelected}
              className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              Supprimer la coupe
            </button>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Affichage
          </div>
          <ToggleRow label="Grille" active={showGrid} onClick={toggleGrid} />
          <ToggleRow label="Cotes des murs" active={showDimensions} onClick={toggleDimensions} />
          <ToggleRow
            label="Emprise extérieure"
            active={showExteriorDims}
            onClick={toggleExteriorDims}
          />
          <ToggleRow
            label="Emprise intérieure (chaîne)"
            active={showInteriorDims}
            onClick={toggleInteriorDims}
          />
          <ToggleRow label={`Aimantation (${grid} cm)`} active={snapEnabled} onClick={toggleSnap} />
        </div>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
    if (clamped !== value) onChange(clamped);
    setText(String(clamped));
  };
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        value={text}
        min={min}
        max={max}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setText(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono-tab text-sm outline-none focus:border-brass"
      />
    </label>
  );
}

function ToggleRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-brass/5"
    >
      <span>{label}</span>
      <span
        className={`inline-flex h-4 w-7 items-center rounded-full transition-colors ${active ? "bg-brass" : "bg-border"}`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-card shadow transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
