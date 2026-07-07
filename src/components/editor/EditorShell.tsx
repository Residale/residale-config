import { useEffect, useRef } from "react";
import { useEditor } from "@/lib/editor/store";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Canvas2D } from "./Canvas2D";
import { Canvas3D } from "./Canvas3D";

export function EditorShell() {
  const view = useEditor((s) => s.view);
  const exportRef = useRef<() => string | null>(() => null);

  // Load a starter plan on first mount
  useEffect(() => {
    const st = useEditor.getState();
    if (st.plan.walls.length === 0) {
      const T = 15;
      const pts = [
        { x: -400, y: -300 },
        { x: 400, y: -300 },
        { x: 400, y: 300 },
        { x: -400, y: 300 },
      ];
      for (let i = 0; i < 4; i++) {
        st.addWall({ a: pts[i], b: pts[(i + 1) % 4], thickness: T });
      }
      // Add an interior wall
      st.addWall({ a: { x: 0, y: -300 }, b: { x: 0, y: 100 }, thickness: T });
    }
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
          {view === "2d" && <Canvas2D onExportRef={(fn) => (exportRef.current = fn)} />}
          {view === "3d" && <Canvas3D />}
          {view === "split" && (
            <div className="grid h-full w-full grid-cols-2 divide-x divide-border">
              <Canvas2D onExportRef={(fn) => (exportRef.current = fn)} />
              <Canvas3D />
            </div>
          )}
        </main>
        <RightPanel />
      </div>
    </div>
  );
}
