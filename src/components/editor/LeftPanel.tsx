import { useEditor } from "@/lib/editor/store";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import { useMemo, useState } from "react";
import { wallLength } from "@/lib/editor/geometry";

type ToolDef = {
  id: import("@/lib/editor/types").Tool;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    {children}
  </svg>
);

const TOOLS: ToolDef[] = [
  { id: "select", label: "Sélection", hint: "V", icon: <Icon><path d="M4 4l7 16 2-7 7-2z"/></Icon> },
  { id: "wall", label: "Mur", hint: "W · Cliquez pour poser des points · Échap pour terminer", icon: <Icon><path d="M3 20h18"/><path d="M6 20V8h12v12"/></Icon> },
  { id: "rectangle", label: "Pièce (rect.)", hint: "R · 2 clics", icon: <Icon><rect x="4" y="5" width="16" height="14" rx="1"/></Icon> },
  { id: "door", label: "Porte", hint: "D · Cliquez sur un mur", icon: <Icon><path d="M6 20V4h9v16"/><path d="M6 20a9 9 0 0 1 9-9"/></Icon> },
  { id: "window", label: "Fenêtre", hint: "F · Cliquez sur un mur", icon: <Icon><rect x="4" y="6" width="16" height="12"/><path d="M12 6v12M4 12h16"/></Icon> },
  { id: "eraser", label: "Gomme", hint: "E · Cliquez un élément", icon: <Icon><path d="M3 17l6 6h12v-2H10.4L4.4 15z"/><path d="M20 8L14 2 3 13l6 6"/></Icon> },
];

export function LeftPanel() {
  const { tool, setTool, plan } = useEditor();
  const [tab, setTab] = useState<"tools" | "furniture">("tools");
  const cats = useMemo(() => Array.from(new Set(CATALOG.map((c) => c.category))), []);
  const [openCat, setOpenCat] = useState<string>(cats[0]);

  const totalMeters = plan.walls.reduce((sum, w) => sum + wallLength(w), 0) / 100;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur">
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("tools")}
          className={`flex-1 px-4 py-3 text-xs font-medium tracking-wide uppercase transition-colors ${tab === "tools" ? "text-ink border-b-2 border-brass" : "text-muted-foreground hover:text-ink"}`}
        >Outils</button>
        <button
          onClick={() => setTab("furniture")}
          className={`flex-1 px-4 py-3 text-xs font-medium tracking-wide uppercase transition-colors ${tab === "furniture" ? "text-ink border-b-2 border-brass" : "text-muted-foreground hover:text-ink"}`}
        >Mobilier</button>
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
                  tool === t.id
                    ? "border-brass bg-brass/10 text-ink shadow-panel"
                    : "border-border bg-card hover:border-brass/50 hover:bg-brass/5"
                }`}
              >
                <span className={tool === t.id ? "text-brass" : "text-muted-foreground group-hover:text-ink"}>{t.icon}</span>
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-md border border-border bg-background/60 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Résumé</div>
            <div className="space-y-1.5 font-mono-tab text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Murs</span><span>{plan.walls.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Longueur</span><span>{totalMeters.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ouvertures</span><span>{plan.openings.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mobilier</span><span>{plan.furniture.length}</span></div>
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
                <button
                  onClick={() => setOpenCat(openCat === cat ? "" : cat)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-brass/5"
                >
                  <span>{cat}</span>
                  <span className="text-muted-foreground">{openCat === cat ? "−" : "+"}</span>
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
                        <div
                          className="mb-1 h-8 w-full rounded-sm border"
                          style={{ backgroundColor: c.color, borderColor: "#8b7355" }}
                        />
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
    </aside>
  );
}
