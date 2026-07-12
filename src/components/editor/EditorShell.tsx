import { useEffect, useRef } from "react";
import { useEditor } from "@/lib/editor/store";
import { TopBar } from "./TopBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { Canvas2D } from "./Canvas2D";
import { ShortcutsHelp } from "./ShortcutsHelp";

import { Canvas3D } from "./Canvas3D";
import { CanvasSection } from "./CanvasSection";
import { CommandPalette } from "./CommandPalette";
import { exportDossierPDF, findStageDataURL } from "@/lib/editor/pdf-export";
import {
  DEFAULT_SHEET_CONFIG,
  exportArchitectSheetPDF,
  type SheetPaper,
} from "@/lib/editor/sheet-export";
import { toast } from "sonner";
import { updateSavedPlan } from "@/lib/editor/plan-library";

export function EditorShell({
  activePlanId,
  onBackToPlans,
}: {
  activePlanId?: string | null;
  onBackToPlans?: () => void;
}) {
  const view = useEditor((s) => s.view);
  const exportRef = useRef<() => string | null>(() => null);

  useEffect(() => {
    const st = useEditor.getState();
    if (
      typeof window !== "undefined" &&
      !localStorage.getItem("residale-seeded-v1") &&
      st.plan.walls.length === 0
    ) {
      const ext = st.wallSettings.exterior.thickness;
      const pts = [
        { x: -400, y: -200 },
        { x: 400, y: -200 },
        { x: 400, y: 200 },
        { x: -400, y: 200 },
      ];
      for (let i = 0; i < 4; i++)
        st.addWall({ a: pts[i], b: pts[(i + 1) % 4], thickness: ext, wallType: "exterior" });
      st.addWall({
        a: { x: -200, y: -200 },
        b: { x: -200, y: 40 },
        thickness: st.wallSettings.interior.thickness,
        wallType: "interior",
      });
      localStorage.setItem("residale-seeded-v1", "1");
    }
  }, []);

  useEffect(() => {
    if (!activePlanId) return;
    const save = () => {
      const st = useEditor.getState();
      updateSavedPlan(activePlanId, {
        name: st.projectName || "Sans titre",
        plan: st.plan,
        theme: st.theme,
      });
    };
    save();
    return useEditor.subscribe(save);
  }, [activePlanId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, "2d" | "3d" | "section" | "split"> = {
        "1": "2d",
        "2": "3d",
        "3": "split",
        "4": "section",
      };
      const v = map[e.key];
      if (v) {
        useEditor.getState().setView(v);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    const data = JSON.stringify(
      { name: state.projectName, plan: state.plan, theme: state.theme },
      null,
      2,
    );
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
          if (data.theme) useEditor.getState().setTheme(data.theme);
        }
      } catch {
        /* ignore */
      }
    };
    input.click();
  };

  const handleExportArchitectSheet = () => {
    const state = useEditor.getState();
    if (state.plan.walls.length === 0) {
      toast.error("Dessinez d'abord un plan avant d'exporter la feuille architecte.");
      return;
    }

    const company =
      window.prompt("Cartouche — société", DEFAULT_SHEET_CONFIG.company) ||
      DEFAULT_SHEET_CONFIG.company;
    const projectName =
      window.prompt("Nom du projet", state.projectName || "AURA 48") ||
      state.projectName ||
      "AURA 48";
    const version =
      window.prompt("Version", DEFAULT_SHEET_CONFIG.version) || DEFAULT_SHEET_CONFIG.version;
    const scaleRaw = window.prompt(
      "Échelle souhaitée (ex: 100 pour 1:100)",
      String(DEFAULT_SHEET_CONFIG.scale),
    );
    const scale = Number(scaleRaw) > 0 ? Number(scaleRaw) : DEFAULT_SHEET_CONFIG.scale;
    const paperRaw = (
      window.prompt("Format papier: A4 ou A3", DEFAULT_SHEET_CONFIG.paper.toUpperCase()) ||
      DEFAULT_SHEET_CONFIG.paper
    ).toLowerCase();
    const paper: SheetPaper = paperRaw === "a3" ? "a3" : "a4";

    try {
      const result = exportArchitectSheetPDF(state.plan, projectName, {
        ...DEFAULT_SHEET_CONFIG,
        company,
        version,
        scale,
        paper,
      });
      state.setProjectName(projectName);
      toast.success(
        result.elevationScale !== result.effectiveScale
          ? `Feuille architecte exportée — plan 1:${result.effectiveScale}, façades 1:${result.elevationScale}.`
          : `Feuille architecte exportée en 1:${result.effectiveScale}.`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export de la feuille architecte.");
    }
  };

  const handleExportDossier = async () => {
    const state = useEditor.getState();
    if (state.plan.walls.length === 0) {
      toast.error("Dessinez d'abord un plan avant d'exporter le dossier.");
      return;
    }
    toast.info("Génération du dossier en cours…");
    try {
      // Capture 2D plan by switching to 2D view briefly
      const prevView = state.view;
      let plan2DImage: string | null = null;
      let view3DImage: string | null = null;

      if (prevView !== "2d") state.setView("2d");
      await new Promise((r) => setTimeout(r, 350));
      plan2DImage = exportRef.current() ?? findStageDataURL();

      state.setView("3d");
      await new Promise((r) => setTimeout(r, 600));
      view3DImage = findStageDataURL();

      state.setView(prevView);
      await new Promise((r) => setTimeout(r, 100));

      await exportDossierPDF({
        plan: state.plan,
        projectName: state.projectName || "Plan",
        theme: state.theme,
        plan2DImage,
        view3DImage,
      });
      toast.success("Dossier PDF téléchargé.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du PDF.");
    }
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <TopBar
        onBackToPlans={onBackToPlans}
        onExportPNG={handleExportPNG}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onExportDossier={handleExportDossier}
        onExportArchitectSheet={handleExportArchitectSheet}
      />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="relative flex min-w-0 flex-1">
          {view === "2d" && <Canvas2D onExportRef={(fn) => (exportRef.current = fn)} />}
          {view === "3d" && <Canvas3D />}
          {view === "section" && <CanvasSection />}
          {view === "split" && (
            <div className="grid h-full w-full grid-cols-2 divide-x divide-border">
              <Canvas2D onExportRef={(fn) => (exportRef.current = fn)} />
              <Canvas3D />
            </div>
          )}
          {(view === "2d" || view === "split") && <ShortcutsHelp />}
        </main>
        <RightPanel />
      </div>
      <CommandPalette />
    </div>
  );
}
