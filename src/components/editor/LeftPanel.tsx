import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import { useMemo, useState } from "react";
import { wallLength } from "@/lib/editor/geometry";
import { THEME_PRESETS } from "@/lib/editor/theme";

type ToolDef = {
  id: import("@/lib/editor/types").Tool;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{children}</svg>
);

const TOOLS: ToolDef[] = [
  { id: "select", label: "Sélection", hint: "V", icon: <Icon><path d="M4 4l7 16 2-7 7-2z"/></Icon> },
  { id: "wall", label: "Mur", hint: "W · clic-clic · Échap pour terminer", icon: <Icon><path d="M3 20h18"/><path d="M6 20V8h12v12"/></Icon> },
  { id: "rectangle", label: "Pièce", hint: "R · 2 clics", icon: <Icon><rect x="4" y="5" width="16" height="14" rx="1"/></Icon> },
  { id: "door", label: "Porte", hint: "D · cliquez un mur", icon: <Icon><path d="M6 20V4h9v16"/><path d="M6 20a9 9 0 0 1 9-9"/></Icon> },
  { id: "window", label: "Fenêtre", hint: "F · cliquez un mur", icon: <Icon><rect x="4" y="6" width="16" height="12"/><path d="M12 6v12M4 12h16"/></Icon> },
  { id: "section", label: "Coupe", hint: "S · 2 clics", icon: <Icon><path d="M3 12h18"/><path d="M6 8l-3 4 3 4"/><path d="M18 8l3 4-3 4"/></Icon> },
  { id: "eraser", label: "Gomme", hint: "E", icon: <Icon><path d="M3 17l6 6h12v-2H10.4L4.4 15z"/><path d="M20 8L14 2 3 13l6 6"/></Icon> },
];

export function LeftPanel() {
  const {
    tool, setTool, plan, theme, setTheme, patchTheme,
    wall3DColor, floor3DColor, setWall3DColor, setFloor3DColor,
    wallSettings, setWallSettings, currentWallType, setCurrentWallType, applyWallTypeToAll,
  } = useEditor();
  const [tab, setTab] = useState<"tools" | "furniture" | "theme">("tools");
  const cats = useMemo(() => Array.from(new Set(CATALOG.map((c) => c.category))), []);
  const [openCat, setOpenCat] = useState<string>(cats[0]);

  const totalMeters = plan.walls.reduce((sum, w) => sum + wallLength(w), 0) / 100;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur">
      <div className="flex border-b border-border">
        {(["tools", "furniture", "theme"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-2 py-3 text-[11px] font-medium tracking-wide uppercase transition-colors ${tab === t ? "text-ink border-b-2 border-brass" : "text-muted-foreground hover:text-ink"}`}
          >
            {t === "tools" ? "Outils" : t === "furniture" ? "Mobilier" : "Thème"}
          </button>
        ))}
      </div>

      {tab === "tools" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={`${t.label} — ${t.hint}`}
                className={`group flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs transition-all ${
                  tool === t.id ? "border-brass bg-brass/10 text-ink shadow-panel" : "border-border bg-card hover:border-brass/50 hover:bg-brass/5"
                }`}
              >
                <span className={tool === t.id ? "text-brass" : "text-muted-foreground group-hover:text-ink"}>{t.icon}</span>
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Global wall settings */}
          <div className="mt-5 rounded-md border border-brass/40 bg-brass/5 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Type de mur en cours
            </div>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded border border-border bg-background p-0.5">
              {(["exterior", "interior"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCurrentWallType(t)}
                  className={`rounded px-2 py-1.5 text-xs font-medium transition-colors ${
                    currentWallType === t ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  {t === "exterior" ? "Extérieur" : "Intérieur"}
                </button>
              ))}
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="rounded border border-border bg-card p-2">
                <div className="mb-1 font-medium text-ink">Mur extérieur</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <MiniNum label="Épais." value={wallSettings.exterior.thickness} onChange={(v) => setWallSettings({ exterior: { ...wallSettings.exterior, thickness: v } })} />
                  <MiniNum label="Haut." value={wallSettings.exterior.height} onChange={(v) => setWallSettings({ exterior: { ...wallSettings.exterior, height: v } })} />
                </div>
              </div>
              <div className="rounded border border-border bg-card p-2">
                <div className="mb-1 font-medium text-ink">Mur intérieur</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <MiniNum label="Épais." value={wallSettings.interior.thickness} onChange={(v) => setWallSettings({ interior: { ...wallSettings.interior, thickness: v } })} />
                  <MiniNum label="Haut." value={wallSettings.interior.height} onChange={(v) => setWallSettings({ interior: { ...wallSettings.interior, height: v } })} />
                </div>
              </div>
              <button
                onClick={applyWallTypeToAll}
                className="w-full rounded border border-border bg-background py-1.5 text-[11px] font-medium hover:border-brass hover:bg-brass/10"
              >
                Appliquer à tous les murs existants
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-background/60 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Résumé</div>
            <div className="space-y-1.5 font-mono-tab text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Murs</span><span>{plan.walls.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Longueur</span><span>{totalMeters.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ouvertures</span><span>{plan.openings.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mobilier</span><span>{plan.furniture.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Coupes</span><span>{plan.sections.length || "auto"}</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === "furniture" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Glissez-déposez</div>
          <div className="space-y-2">
            {cats.map((cat) => (
              <div key={cat} className="overflow-hidden rounded-md border border-border bg-card">
                <button onClick={() => setOpenCat(openCat === cat ? "" : cat)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-brass/5">
                  <span>{cat}</span><span className="text-muted-foreground">{openCat === cat ? "−" : "+"}</span>
                </button>
                {openCat === cat && (
                  <div className="grid grid-cols-2 gap-1.5 border-t border-border bg-background/40 p-2">
                    {CATALOG.filter((c) => c.category === cat).map((c, i) => (
                      <div
                        key={`${c.kind}-${i}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/x-furniture", c.kind);
                          e.dataTransfer.setData("application/x-furniture-label", c.label);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="group cursor-grab select-none rounded border border-border bg-card p-2 text-[11px] transition-all hover:border-brass hover:shadow-panel active:cursor-grabbing"
                      >
                        <div className="mb-1 h-8 w-full rounded-sm border" style={{ backgroundColor: c.color, borderColor: "#8b7355" }} />
                        <div className="truncate font-medium">{c.label}</div>
                        <div className="font-mono-tab text-[9px] text-muted-foreground">
                          {(c.width / 100).toFixed(2)}×{(c.height / 100).toFixed(2)} m
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "theme" && (
        <div className="flex-1 space-y-5 overflow-y-auto p-3">
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Thèmes 2D</div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTheme(p)}
                  className={`overflow-hidden rounded-md border text-left transition-all ${theme.id === p.id ? "border-brass shadow-panel" : "border-border hover:border-brass/50"}`}
                >
                  <div className="relative h-14" style={{ background: p.background }}>
                    <div className="absolute inset-2 rounded" style={{ background: p.floor }} />
                    <div className="absolute inset-x-2 top-2 h-2" style={{ background: p.wallFill }} />
                    <div className="absolute inset-x-2 bottom-2 h-2" style={{ background: p.wallFill }} />
                    <div className="absolute left-2 top-2 h-10 w-2" style={{ background: p.wallFill }} />
                    <div className="absolute right-2 top-2 h-10 w-2" style={{ background: p.wallFill }} />
                  </div>
                  <div className="px-2 py-1.5 text-[11px] font-medium">{p.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Personnaliser 2D</div>
            <div className="space-y-2">
              <ColorRow label="Sol" value={theme.floor} onChange={(v) => patchTheme({ floor: v })} />
              <ColorRow label="Murs (poché)" value={theme.wallFill} onChange={(v) => patchTheme({ wallFill: v, wallStroke: v })} />
              <ColorRow label="Fond" value={theme.background} onChange={(v) => patchTheme({ background: v })} />
              <ColorRow label="Cotes" value={theme.dimension} onChange={(v) => patchTheme({ dimension: v, openingStroke: v })} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Vue 3D</div>
            <div className="space-y-2">
              <ColorRow label="Murs 3D" value={wall3DColor} onChange={setWall3DColor} />
              <ColorRow label="Sol 3D" value={floor3DColor} onChange={setFloor3DColor} />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded border border-border bg-card px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color" value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
        />
        <span className="font-mono-tab text-[10px] text-muted-foreground">{toHex(value)}</span>
      </div>
    </label>
  );
}

function toHex(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return "#000000";
}
