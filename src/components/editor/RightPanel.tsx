import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import { wallLength } from "@/lib/editor/geometry";

export function RightPanel() {
  const {
    plan, selection, updateWall, updateFurniture, updateOpening,
    deleteSelected, showGrid, showDimensions, snapEnabled, grid,
    toggleGrid, toggleDimensions, toggleSnap,
  } = useEditor();

  const wall = selection?.type === "wall" ? plan.walls.find((w) => w.id === selection.id) : null;
  const furn = selection?.type === "furniture" ? plan.furniture.find((f) => f.id === selection.id) : null;
  const opening = selection?.type === "opening" ? plan.openings.find((o) => o.id === selection.id) : null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card/60 backdrop-blur">
      <div className="border-b border-border px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Propriétés</div>
        <div className="mt-1 font-display text-lg">
          {wall ? "Mur" : furn ? furn.label ?? "Mobilier" : opening ? (opening.type === "door" ? "Porte" : "Fenêtre") : "—"}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!selection && (
          <div className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
            Sélectionnez un élément avec l'outil <span className="font-medium text-ink">Sélection</span> pour éditer ses propriétés.
          </div>
        )}

        {wall && (
          <div className="space-y-3">
            <Field label="Longueur">
              <span className="font-mono-tab">{(wallLength(wall) / 100).toFixed(2)} m</span>
            </Field>
            <NumberField
              label="Épaisseur (cm)"
              value={wall.thickness}
              min={5}
              max={50}
              onChange={(v) => updateWall(wall.id, { thickness: v })}
            />
            <button onClick={deleteSelected} className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
              Supprimer le mur
            </button>
          </div>
        )}

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
              <NumberField label="Largeur (cm)" value={Math.round(furn.width)} min={10} max={800} onChange={(v) => updateFurniture(furn.id, { width: v })} />
              <NumberField label="Profondeur (cm)" value={Math.round(furn.height)} min={10} max={800} onChange={(v) => updateFurniture(furn.id, { height: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X (cm)" value={Math.round(furn.x)} onChange={(v) => updateFurniture(furn.id, { x: v })} />
              <NumberField label="Y (cm)" value={Math.round(furn.y)} onChange={(v) => updateFurniture(furn.id, { y: v })} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Rotation</span>
                <span className="font-mono-tab">{Math.round(furn.rotation)}°</span>
              </div>
              <input
                type="range" min={0} max={359} value={furn.rotation}
                onChange={(e) => updateFurniture(furn.id, { rotation: Number(e.target.value) })}
                className="w-full accent-[color:var(--brass)]"
              />
              <div className="mt-1 flex gap-1">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => updateFurniture(furn.id, { rotation: deg })}
                    className="flex-1 rounded border border-border bg-background py-1 text-[11px] hover:border-brass"
                  >{deg}°</button>
                ))}
              </div>
            </div>
            <button onClick={deleteSelected} className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
              Supprimer
            </button>
          </div>
        )}

        {opening && (
          <div className="space-y-3">
            <NumberField label="Largeur (cm)" value={opening.width} min={40} max={300} onChange={(v) => updateOpening(opening.id, { width: v })} />
            <button onClick={deleteSelected} className="w-full rounded-md border border-destructive/30 bg-destructive/5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10">
              Supprimer
            </button>
          </div>
        )}

        <div className="border-t border-border pt-4">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Affichage</div>
          <ToggleRow label="Grille" active={showGrid} onClick={toggleGrid} />
          <ToggleRow label="Cotes" active={showDimensions} onClick={toggleDimensions} />
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

function NumberField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono-tab text-sm outline-none focus:border-brass"
      />
    </label>
  );
}

function ToggleRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-brass/5">
      <span>{label}</span>
      <span className={`inline-flex h-4 w-7 items-center rounded-full transition-colors ${active ? "bg-brass" : "bg-border"}`}>
        <span className={`h-3 w-3 rounded-full bg-card shadow transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`}/>
      </span>
    </button>
  );
}
