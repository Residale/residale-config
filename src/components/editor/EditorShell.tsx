import { useEffect } from "react";
import { toast } from "sonner";
import { updateSavedPlan } from "@/lib/editor/plan-library";
import { useEditor } from "@/lib/editor/store";
import { EpureEditor } from "./EpureEditor";

export function EditorShell({
  activePlanId,
  onBackToPlans,
}: {
  activePlanId?: string | null;
  onBackToPlans?: () => void;
}) {
  useEffect(() => {
    if (!activePlanId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const st = useEditor.getState();
        void updateSavedPlan(activePlanId, {
          name: st.projectName || "Sans titre",
          plan: st.plan,
          theme: st.theme,
        }).catch((err) => {
          console.error(err);
          toast.error("Sauvegarde du plan impossible.");
        });
      }, 450);
    };
    save();
    const unsubscribe = useEditor.subscribe(save);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [activePlanId]);

  return <EpureEditor onBackToPlans={onBackToPlans} />;
}
