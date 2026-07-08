import { useState } from "react";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "V", label: "Outil sélection" },
  { keys: "W", label: "Dessiner un mur" },
  { keys: "R", label: "Dessiner une pièce" },
  { keys: "D", label: "Poser une porte" },
  { keys: "F", label: "Poser une fenêtre" },
  { keys: "Espace + glisser", label: "Déplacer la vue (pan)" },
  { keys: "Molette", label: "Zoom" },
  { keys: "Clic droit", label: "Menu contextuel" },
  { keys: "Maj + clic", label: "Sélection multiple" },
  { keys: "Maj + glisser (vide)", label: "Sélection rectangle" },
  { keys: "Alt + glisser", label: "Dupliquer" },
  { keys: "Ctrl/Cmd + D", label: "Dupliquer la sélection" },
  { keys: "Ctrl/Cmd + Z / Y", label: "Annuler / Rétablir" },
  { keys: "Suppr", label: "Supprimer la sélection" },
  { keys: "Échap", label: "Désélectionner / annuler l'outil" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="pointer-events-auto w-72 rounded-md border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Raccourcis</span>
            <button className="rounded p-1 hover:bg-muted" onClick={() => setOpen(false)} aria-label="Fermer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1.5 text-xs">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{s.label}</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{s.keys}</kbd>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 shadow hover:bg-muted"
        title="Raccourcis clavier"
        aria-label="Raccourcis clavier"
      >
        <Keyboard className="h-4 w-4" />
      </button>
    </div>
  );
}
