import { useEditor } from "@/lib/editor/store";

export function TopBar({ onExportPNG, onExportJSON, onImportJSON }: {
  onExportPNG: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
}) {
  const { projectName, setProjectName, view, setView, undo, redo, clearAll } = useEditor();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-paper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-sm">Plana</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Studio</span>
        </div>
        <div className="mx-3 h-6 w-px bg-border" />
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-56 rounded bg-transparent px-2 py-1 text-sm font-medium outline-none hover:bg-brass/5 focus:bg-brass/5"
        />
      </div>

      <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
        {(["2d", "split", "3d"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              view === v ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink"
            }`}
          >
            {v === "2d" ? "Plan 2D" : v === "3d" ? "Vue 3D" : "Split"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <IconBtn onClick={undo} label="Annuler (⌘Z)">
          <path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>
        </IconBtn>
        <IconBtn onClick={redo} label="Rétablir (⌘⇧Z)">
          <path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>
        </IconBtn>
        <div className="mx-1 h-6 w-px bg-border" />
        <IconBtn onClick={onImportJSON} label="Importer">
          <path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>
        </IconBtn>
        <IconBtn onClick={onExportJSON} label="Exporter JSON">
          <path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 21h16"/>
        </IconBtn>
        <button
          onClick={onExportPNG}
          className="ml-1 flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/85"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>
          </svg>
          Exporter PNG
        </button>
        <button
          onClick={() => confirm("Effacer tout le plan ?") && clearAll()}
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
          title="Tout effacer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-brass hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        {children}
      </svg>
    </button>
  );
}
