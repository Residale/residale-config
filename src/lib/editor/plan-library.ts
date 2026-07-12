import type { Plan } from "./types";
import type { Theme2D } from "./theme";
import {
  isSupabaseConfigured,
  requireSupabase,
  type FloorWhisperMember,
} from "@/lib/supabase-client";

const PLANS_KEY = "residale-floor-whisper-plans-v1";
const ACTIVE_PLAN_KEY = "residale-floor-whisper-active-plan-v1";

export type SavedPlanScope = "private" | "shared";

export type SavedPlan = {
  id: string;
  name: string;
  plan: Plan;
  theme?: Theme2D;
  scope: SavedPlanScope;
  ownerId?: string | null;
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type FloorWhisperPlanRow = {
  id: string;
  owner_id: string | null;
  name: string;
  plan: Plan;
  theme: Theme2D | null;
  scope: SavedPlanScope;
  created_at: string;
  updated_at: string;
  owner?: { display_name: string | null; email: string | null } | null;
};

function rowToSavedPlan(row: FloorWhisperPlanRow): SavedPlan {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    theme: row.theme ?? undefined,
    scope: row.scope,
    ownerId: row.owner_id,
    ownerName: row.owner?.display_name ?? row.owner?.email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function localPlans(): SavedPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    const plans = raw ? (JSON.parse(raw) as Array<SavedPlan & { scope?: SavedPlanScope }>) : [];
    return Array.isArray(plans)
      ? plans
          .map((p) => ({ ...p, scope: p.scope ?? "private" }))
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      : [];
  } catch {
    return [];
  }
}

function writeLocalPlans(plans: SavedPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export async function getCurrentMember(): Promise<FloorWhisperMember | null> {
  if (!isSupabaseConfigured) return null;
  const sb = requireSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return null;
  const { data, error } = await sb.rpc("floor_whisper_current_member");
  if (error) throw error;
  const first = Array.isArray(data) ? data[0] : data;
  return (first as FloorWhisperMember | null) ?? null;
}

export async function isAuthenticated() {
  if (!isSupabaseConfigured) return false;
  const { data } = await requireSupabase().auth.getSession();
  return Boolean(data.session);
}

export async function login(email: string, password: string) {
  const sb = requireSupabase();
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  await migrateLocalPlansToCloud();
  return true;
}

export async function requestPasswordReset(email: string) {
  const sb = requireSupabase();
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const sb = requireSupabase();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
  await migrateLocalPlansToCloud();
}

export async function logout() {
  if (isSupabaseConfigured) await requireSupabase().auth.signOut();
  if (typeof window !== "undefined") localStorage.removeItem(ACTIVE_PLAN_KEY);
}

export async function listSavedPlans(): Promise<SavedPlan[]> {
  if (!isSupabaseConfigured) return localPlans();
  const { data, error } = await requireSupabase()
    .from("floor_whisper_plans")
    .select("id, owner_id, name, plan, theme, scope, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as FloorWhisperPlanRow[]).map(rowToSavedPlan);
}

export async function getSavedPlan(id: string) {
  if (!isSupabaseConfigured) return localPlans().find((p) => p.id === id) ?? null;
  const { data, error } = await requireSupabase()
    .from("floor_whisper_plans")
    .select("id, owner_id, name, plan, theme, scope, created_at, updated_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return rowToSavedPlan(data as unknown as FloorWhisperPlanRow);
}

export async function savePlan(record: SavedPlan) {
  if (!isSupabaseConfigured) {
    const plans = localPlans();
    const idx = plans.findIndex((p) => p.id === record.id);
    const next =
      idx >= 0 ? plans.map((p) => (p.id === record.id ? record : p)) : [record, ...plans];
    writeLocalPlans(next);
    localStorage.setItem(ACTIVE_PLAN_KEY, record.id);
    return record;
  }

  const payload = {
    id: record.id,
    name: record.name,
    plan: record.plan,
    theme: record.theme ?? null,
    scope: record.scope,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await requireSupabase()
    .from("floor_whisper_plans")
    .upsert(payload)
    .select("id, owner_id, name, plan, theme, scope, created_at, updated_at")
    .single();
  if (error) throw error;
  setActivePlanId(record.id);
  return rowToSavedPlan(data as unknown as FloorWhisperPlanRow);
}

export async function createSavedPlan(
  name = "Nouveau plan",
  plan: Plan,
  theme?: Theme2D,
  scope: SavedPlanScope = "private",
) {
  const now = new Date().toISOString();
  return savePlan({ id: uid(), name, plan, theme, scope, createdAt: now, updatedAt: now });
}

export async function updateSavedPlan(
  id: string,
  patch: Partial<Pick<SavedPlan, "name" | "plan" | "theme" | "scope">>,
) {
  const current = await getSavedPlan(id);
  if (!current) return null;
  return savePlan({ ...current, ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteSavedPlan(id: string) {
  if (!isSupabaseConfigured) {
    writeLocalPlans(localPlans().filter((p) => p.id !== id));
  } else {
    const { error } = await requireSupabase().from("floor_whisper_plans").delete().eq("id", id);
    if (error) throw error;
  }
  if (getActivePlanId() === id) setActivePlanId(null);
}

export function getActivePlanId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PLAN_KEY);
}

export function setActivePlanId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_PLAN_KEY, id);
  else localStorage.removeItem(ACTIVE_PLAN_KEY);
}

async function migrateLocalPlansToCloud() {
  if (!isSupabaseConfigured) return;
  const locals = localPlans();
  if (locals.length === 0 || localStorage.getItem(`${PLANS_KEY}-migrated-to-cloud`) === "true")
    return;
  for (const local of locals) {
    const { error } = await requireSupabase()
      .from("floor_whisper_plans")
      .upsert({
        id: local.id,
        name: local.name,
        plan: local.plan,
        theme: local.theme ?? null,
        scope: local.scope ?? "private",
        created_at: local.createdAt,
        updated_at: local.updatedAt,
      });
    if (error) throw error;
  }
  localStorage.setItem(`${PLANS_KEY}-migrated-to-cloud`, "true");
}
