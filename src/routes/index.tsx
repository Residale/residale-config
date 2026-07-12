import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EditorShell } from "@/components/editor/EditorShell";
import { DEFAULT_THEME } from "@/lib/editor/theme";
import { useEditor } from "@/lib/editor/store";
import type { Plan } from "@/lib/editor/types";
import {
  createSavedPlan,
  deleteSavedPlan,
  getActivePlanId,
  getCurrentMember,
  getSavedPlan,
  isAuthenticated,
  listSavedPlans,
  login,
  logout,
  setActivePlanId as persistActivePlanId,
  updateSavedPlan,
  type SavedPlan,
  type SavedPlanScope,
} from "@/lib/editor/plan-library";
import { isSupabaseConfigured } from "@/lib/supabase-client";

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
  const [memberLabel, setMemberLabel] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refreshPlans = async () => {
    try {
      setPlans(await listSavedPlans());
      setError("");
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les plans sauvegardés.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const authenticated = await isAuthenticated();
        if (cancelled) return;
        setMounted(true);
        setAuthed(authenticated);
        if (!authenticated) return;
        const member = await getCurrentMember();
        if (!cancelled) {
          setMemberLabel(member?.display_name || member?.email || "Compte CRM");
        }
        const existing = await listSavedPlans();
        if (existing.length === 0) {
          const st = useEditor.getState();
          await createSavedPlan(
            st.projectName || "Nouveau plan",
            st.plan.walls.length ? st.plan : EMPTY_PLAN,
            st.theme,
            "private",
          );
        }
        if (!cancelled) {
          setPlans(await listSavedPlans());
          setActivePlanId(getActivePlanId());
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setMounted(true);
          setError("Connexion au backend Residale impossible.");
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) ?? null,
    [activePlanId, plans],
  );

  useEffect(() => {
    if (!activePlanId || activePlan) return;
    void getSavedPlan(activePlanId)
      .then((plan) => {
        if (!plan) return;
        setPlans((prev) => [plan, ...prev.filter((p) => p.id !== plan.id)]);
      })
      .catch((err) => {
        console.error(err);
        setError("Impossible d’ouvrir ce plan.");
      });
  }, [activePlanId, activePlan]);

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
        error={error}
        onLogin={async () => {
          setAuthed(true);
          const member = await getCurrentMember();
          setMemberLabel(member?.display_name || member?.email || "Compte CRM");
          await refreshPlans();
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
          setActivePlanId(null);
          void refreshPlans();
        }}
      />
    );
  }

  return (
    <PlansHome
      plans={plans}
      memberLabel={memberLabel}
      error={error}
      onRefresh={refreshPlans}
      onOpen={(id) => {
        persistActivePlanId(id);
        setActivePlanId(id);
      }}
      onLogout={async () => {
        await logout();
        setAuthed(false);
        persistActivePlanId(null);
        setActivePlanId(null);
      }}
    />
  );
}

function LoginScreen({
  onLogin,
  error: externalError,
}: {
  onLogin: () => Promise<void>;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f0e6] p-6">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError("");
          try {
            await login(email, password);
            await onLogin();
          } catch (err) {
            console.error(err);
            setError(
              isSupabaseConfigured
                ? "Identifiants CRM incorrects ou compte désactivé."
                : "Backend Supabase non configuré pour Floor Whisper.",
            );
          } finally {
            setLoading(false);
          }
        }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-panel"
      >
        <div className="font-display text-2xl">Floor Whisper</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Connexion avec votre compte CRM Residale
        </div>
        <label className="mt-6 block text-xs font-medium text-muted-foreground">
          Email CRM
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Mot de passe CRM
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brass"
          />
        </label>
        {(error || externalError) && (
          <div className="mt-3 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error || externalError}
          </div>
        )}
        <button
          disabled={loading}
          className="mt-5 w-full rounded bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85 disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function PlansHome({
  plans,
  memberLabel,
  error,
  onOpen,
  onRefresh,
  onLogout,
}: {
  plans: SavedPlan[];
  memberLabel: string;
  error: string;
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
  onLogout: () => void | Promise<void>;
}) {
  const createPlan = async (scope: SavedPlanScope = "private") => {
    const name = window.prompt("Nom du nouveau plan", "Nouveau plan") || "Nouveau plan";
    const record = await createSavedPlan(name, EMPTY_PLAN, DEFAULT_THEME, scope);
    await onRefresh();
    onOpen(record.id);
  };

  return (
    <div className="min-h-screen bg-[#f5f0e6] p-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Residale
            </div>
            <h1 className="font-display text-4xl">Mes plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sauvegarde CRM par compte, accès partagé via l’espace commun, exports PDF/PNG/JSON
              dans l’éditeur.
            </p>
            {memberLabel && (
              <p className="mt-2 text-xs text-muted-foreground">Connecté : {memberLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => void createPlan("private")}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85"
            >
              + Nouveau plan privé
            </button>
            <button
              onClick={() => void createPlan("shared")}
              className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-ink hover:bg-brass/85"
            >
              + Plan commun
            </button>
            <button
              onClick={() => void onLogout()}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:border-brass hover:text-ink"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Espace commun
          </h2>
          <PlanGrid
            plans={plans.filter((p) => p.scope === "shared")}
            onOpen={onOpen}
            onRefresh={onRefresh}
          />
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Mes plans privés
          </h2>
          <PlanGrid
            plans={plans.filter((p) => p.scope !== "shared")}
            onOpen={onOpen}
            onRefresh={onRefresh}
          />
        </section>
      </div>
    </div>
  );
}

function PlanGrid({
  plans,
  onOpen,
  onRefresh,
}: {
  plans: SavedPlan[];
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  if (plans.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
        Aucun plan pour le moment.
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <article key={plan.id} className="rounded-xl border border-border bg-card p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl">{plan.name}</h3>
              <div className="mt-1 text-xs text-muted-foreground">
                Modifié {new Date(plan.updatedAt).toLocaleString("fr-FR")}
              </div>
              {plan.scope === "shared" && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Commun{plan.ownerName ? ` · créé par ${plan.ownerName}` : ""}
                </div>
              )}
            </div>
            <div className="rounded bg-background px-2 py-1 font-mono-tab text-[10px] text-muted-foreground">
              {plan.plan.walls.length} murs
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onOpen(plan.id)}
              className="flex-1 rounded bg-ink px-3 py-2 text-xs font-medium text-paper hover:bg-ink/85"
            >
              Ouvrir
            </button>
            <button
              onClick={async () => {
                const nextName = window.prompt("Renommer le plan", plan.name);
                if (!nextName?.trim()) return;
                await updateSavedPlan(plan.id, { name: nextName.trim() });
                await onRefresh();
              }}
              className="rounded border border-border bg-background px-3 py-2 text-xs font-medium hover:border-brass"
            >
              Renommer
            </button>
            <button
              onClick={async () => {
                const copy = await createSavedPlan(
                  `${plan.name} copie`,
                  plan.plan,
                  plan.theme,
                  plan.scope,
                );
                await onRefresh();
                onOpen(copy.id);
              }}
              className="rounded border border-border bg-background px-3 py-2 text-xs font-medium hover:border-brass"
            >
              Dupliquer
            </button>
            <button
              onClick={async () => {
                const nextScope: SavedPlanScope = plan.scope === "shared" ? "private" : "shared";
                await updateSavedPlan(plan.id, { scope: nextScope });
                await onRefresh();
              }}
              className="rounded border border-border bg-background px-3 py-2 text-xs font-medium hover:border-brass"
            >
              {plan.scope === "shared" ? "Rendre privé" : "Partager"}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Supprimer « ${plan.name} » ?`)) return;
                await deleteSavedPlan(plan.id);
                await onRefresh();
              }}
              className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
            >
              Suppr.
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
