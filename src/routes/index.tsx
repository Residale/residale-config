import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EditorShell } from "@/components/editor/EditorShell";
import { DEFAULT_THEME } from "@/lib/editor/theme";
import { useEditor } from "@/lib/editor/store";
import type { Plan } from "@/lib/editor/types";
import {
  ADMIN_EMAIL,
  createSavedPlan,
  deleteSavedPlan,
  getActivePlanId,
  getSavedPlan,
  isAuthenticated,
  listSavedPlans,
  login,
  logout,
  setActivePlanId as persistActivePlanId,
  updateSavedPlan,
  type SavedPlan,
} from "@/lib/editor/plan-library";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Floor Whisper — Residale" },
      {
        name: "description",
        content:
          "Configurez des plans d'habitat Residale, avec murs, ouvertures, façades et export PDF architecte.",
      },
      { property: "og:title", content: "Floor Whisper — Residale" },
      {
        property: "og:description",
        content:
          "Configurez des plans d'habitat Residale, avec murs, ouvertures, façades et export PDF architecte.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

const EMPTY_PLAN: Plan = {
  walls: [],
  openings: [],
  furniture: [],
  labels: [],
  sections: [],
  ceilingHeight: 270,
};

function Index() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);

  const refreshPlans = () => setPlans(listSavedPlans());

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
    const existing = listSavedPlans();
    if (existing.length === 0) {
      const st = useEditor.getState();
      createSavedPlan(
        st.projectName || "Nouveau plan",
        st.plan.walls.length ? st.plan : EMPTY_PLAN,
        st.theme,
      );
    }
    refreshPlans();
    setActivePlanId(getActivePlanId());
  }, []);

  const activePlan = useMemo(() => (activePlanId ? getSavedPlan(activePlanId) : null), [activePlanId]);

  useEffect(() => {
    if (!activePlan) return;
    const st = useEditor.getState();
    st.loadPlan(activePlan.plan);
    st.setProjectName(activePlan.name);
    if (activePlan.theme) st.setTheme(activePlan.theme);
  }, [activePlan]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="font-display text-2xl">Floor Whisper</div>
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <LoginScreen
        onLogin={() => {
          setAuthed(true);
          refreshPlans();
        }}
      />
    );
  }

  if (activePlanId) {
    return (
      <EditorShell
        activePlanId={activePlanId}
        onBackToPlans={() => {
          persistActivePlanId(null);
          persistActivePlanId(null);
          setActivePlanId(null);
          refreshPlans();
        }}
      />
    );
  }

  return (
    <PlansHome
      plans={plans}
      onRefresh={refreshPlans}
      onOpen={(id) => {
        persistActivePlanId(id);
        setActivePlanId(id);
      }}
      onLogout={() => {
        logout();
        setAuthed(false);
        persistActivePlanId(null);
        setActivePlanId(null);
      }}
    />
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f0e6] p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (login(email, password)) onLogin();
          else setError("Identifiants administrateur incorrects.");
        }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-panel"
      >
        <div className="font-display text-2xl">Floor Whisper</div>
        <div className="mt-1 text-sm text-muted-foreground">Connexion administrateur Residale</div>
        <label className="mt-6 block text-xs font-medium text-muted-foreground">
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
        </label>
        {error && (
          <div className="mt-3 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <button className="mt-5 w-full rounded bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85">
          Se connecter
        </button>
      </form>
    </div>
  );
}

function PlansHome({
  plans,
  onOpen,
  onRefresh,
  onLogout,
}: {
  plans: SavedPlan[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const createPlan = () => {
    const name = window.prompt("Nom du nouveau plan", "Nouveau plan") || "Nouveau plan";
    const record = createSavedPlan(name, EMPTY_PLAN, DEFAULT_THEME);
    onRefresh();
    onOpen(record.id);
  };

  return (
    <div className="min-h-screen bg-[#f5f0e6] p-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Residale
            </div>
            <h1 className="font-display text-4xl">Mes plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Chaque plan est séparé et sauvegardé automatiquement à chaque modification.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createPlan}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85"
            >
              + Nouveau plan
            </button>
            <button
              onClick={onLogout}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:border-brass hover:text-ink"
            >
              Déconnexion
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-xl border border-border bg-card p-4 shadow-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">{plan.name}</h2>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Modifié {new Date(plan.updatedAt).toLocaleString("fr-FR")}
                  </div>
                </div>
                <div className="rounded bg-background px-2 py-1 font-mono-tab text-[10px] text-muted-foreground">
                  {plan.plan.walls.length} murs
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onOpen(plan.id)}
                  className="flex-1 rounded bg-ink px-3 py-2 text-xs font-medium text-paper hover:bg-ink/85"
                >
                  Ouvrir
                </button>
                <button
                  onClick={() => {
                    const nextName = window.prompt("Renommer le plan", plan.name);
                    if (!nextName?.trim()) return;
                    updateSavedPlan(plan.id, { name: nextName.trim() });
                    onRefresh();
                  }}
                  className="rounded border border-border bg-background px-3 py-2 text-xs font-medium hover:border-brass"
                >
                  Renommer
                </button>
                <button
                  onClick={() => {
                    const copy = createSavedPlan(`${plan.name} copie`, plan.plan, plan.theme);
                    onRefresh();
                    onOpen(copy.id);
                  }}
                  className="rounded border border-border bg-background px-3 py-2 text-xs font-medium hover:border-brass"
                >
                  Dupliquer
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`Supprimer « ${plan.name} » ?`)) return;
                    deleteSavedPlan(plan.id);
                    onRefresh();
                  }}
                  className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Suppr.
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
