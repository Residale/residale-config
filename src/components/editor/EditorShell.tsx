import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

// Lazily import canvas modules so Konva/three never touch SSR.
import type { ComponentType } from "react";

let Canvas2DCached: ComponentType<{ onExportRef?: (fn: () => string | null) => void }> | null = null;
let Canvas3DCached: ComponentType | null = null;

export function EditorShell() {
  const view = useEditor((s) => s.view);
  const [ready, setReady] = useState(false);
  const [C2, setC2] = useState<ComponentType<{ onExportRef?: (fn: () => string | null) => void }> | null>(Canvas2DCached);
  const [C3, setC3] = useState<ComponentType | null>(Canvas3DCached);
  const exportRef = useRef<() => string | null>(() => null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Canvas2DCached) {
        const m = await import("./Canvas2D");
        Canvas2DCached = m.Canvas2D;
      }
      if (!Canvas3DCached) {
        const m = await import("./Canvas3D");
        Canvas3DCached = m.Canvas3D;
      }
      if (!mounted) return;
      setC2(() => Canvas2DCached);
      setC3(() => Canvas3DCached);
      setReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  const handleExportPNG = () => {
    const url = exportRef.current();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${useEditor.getState().projectName || "plan"}.png`;
    a.click();
  };

  const handleExportJSON = () => {
    const state = useEditor.getState();
    const data = JSON.stringify({ name: state.projectName, plan: state.plan }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.projectName || "plan"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const data = JSON.parse(text);
        if (data.plan) {
          useEditor.getState().loadPlan(data.plan);
          if (data.name) useEditor.getState().setProjectName(data.name);
        }
      } catch { /* ignore */ }
    };
    input.click();
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <TopBar onExportPNG={handleExportPNG} onExportJSON={handleExportJSON} onImportJSON={handleImportJSON} />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="relative flex min-w-0 flex-1">
          {!ready && (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Chargement de l'éditeur…
            </div>
          )}
          {ready && view === "2d" && C2 && <C2 onExportRef={(fn) => (exportRef.current = fn)} />}
          {ready && view === "3d" && C3 && <C3 />}
          {ready && view === "split" && C2 && C3 && (
            <div className="grid h-full w-full grid-cols-2 divide-x divide-border">
              <C2 onExportRef={(fn) => (exportRef.current = fn)} />
              <C3 />
            </div>
          )}
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
