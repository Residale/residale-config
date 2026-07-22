import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import type { Tool } from "@/lib/editor/types";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const s = useEditor();

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const setTool = (t: Tool) => () => {
      s.setTool(t);
      setOpen(false);
    };
    const setView = (v: "2d" | "3d" | "section" | "split") => () => {
      s.setView(v);
      setOpen(false);
    };
    return [
      { id: "t-sel", group: "Outil", label: "Sélection", hint: "V", run: setTool("select") },
      { id: "t-wall", group: "Outil", label: "Tracer mur", hint: "W", run: setTool("wall") },
      {
        id: "t-rect",
        group: "Outil",
        label: "Créer pièce (rectangle)",
        hint: "R",
        run: setTool("rectangle"),
      },
      { id: "t-door", group: "Outil", label: "Poser porte", hint: "D", run: setTool("door") },
      { id: "t-win", group: "Outil", label: "Poser fenêtre", hint: "F", run: setTool("window") },
      { id: "t-sec", group: "Outil", label: "Ligne de coupe", hint: "S", run: setTool("section") },
      { id: "t-era", group: "Outil", label: "Gomme", hint: "E", run: setTool("eraser") },
      { id: "v-2d", group: "Vue", label: "Plan 2D", hint: "1", run: setView("2d") },
      { id: "v-3d", group: "Vue", label: "Vue 3D", hint: "2", run: setView("3d") },
      { id: "v-sec", group: "Vue", label: "Coupe", hint: "3", run: setView("section") },
      { id: "v-split", group: "Vue", label: "Split 2D + 3D", run: setView("split") },
      {
        id: "a-undo",
        group: "Action",
        label: "Annuler",
        hint: "⌘Z",
        run: () => {
          s.undo();
          setOpen(false);
        },
      },
      {
        id: "a-redo",
        group: "Action",
        label: "Rétablir",
        hint: "⌘⇧Z",
        run: () => {
          s.redo();
          setOpen(false);
        },
      },
      {
        id: "a-clear",
        group: "Action",
        label: "Tout effacer",
        run: () => {
          if (confirm("Tout effacer ?")) {
            s.clearAll();
            setOpen(false);
          }
        },
      },
      {
        id: "wt-ext",
        group: "Mur",
        label: "Mur extérieur (par défaut)",
        run: () => {
          s.setCurrentWallType("exterior");
          setOpen(false);
        },
      },
      {
        id: "wt-int",
        group: "Mur",
        label: "Mur intérieur (cloison)",
        run: () => {
          s.setCurrentWallType("interior");
          setOpen(false);
        },
      },
      {
        id: "d-grid",
        group: "Affichage",
        label: "Basculer grille",
        run: () => {
          s.toggleGrid();
          setOpen(false);
        },
      },
      {
        id: "d-dim",
        group: "Affichage",
        label: "Basculer cotes",
        run: () => {
          s.toggleDimensions();
          setOpen(false);
        },
      },
      {
        id: "d-snap",
        group: "Affichage",
        label: "Basculer aimantation",
        run: () => {
          s.toggleSnap();
          setOpen(false);
        },
      },
    ];
  }, [s]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return cmds;
    return cmds.filter((c) =>
      (c.label + " " + c.group + " " + (c.hint ?? "")).toLowerCase().includes(query),
    );
  }, [q, cmds]);

  const grouped = useMemo(() => {
    const g: Record<string, Cmd[]> = {};
    for (const c of filtered) (g[c.group] ??= []).push(c);
    return g;
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="mt-[12vh] w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) {
                filtered[0].run();
              }
            }}
            placeholder="Rechercher une action, un outil, une vue…"
            className="w-full bg-transparent px-1 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono-tab text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {group}
              </div>
              {list.map((c) => (
                <button
                  key={c.id}
                  onClick={c.run}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span>{c.label}</span>
                  {c.hint && (
                    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono-tab text-[10px] text-muted-foreground">
                      {c.hint}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">Aucun résultat</div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-background/50 px-3 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ pour naviguer · Entrée pour valider</span>
          <span>
            <kbd className="rounded border border-border bg-card px-1">⌘K</kbd> pour ouvrir
          </span>
        </div>
      </div>
    </div>
  );
}
