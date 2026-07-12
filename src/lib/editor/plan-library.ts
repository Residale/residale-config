import type { Plan } from "./types";
import type { Theme2D } from "./theme";

export const ADMIN_EMAIL = "iznaour@residale.com";
export const ADMIN_PASSWORD = "iznaour123";

const AUTH_KEY = "residale-floor-whisper-auth-v1";
const PLANS_KEY = "residale-floor-whisper-plans-v1";
const ACTIVE_PLAN_KEY = "residale-floor-whisper-active-plan-v1";

export type SavedPlan = {
  id: string;
  name: string;
  plan: Plan;
  theme?: Theme2D;
  createdAt: string;
  updatedAt: string;
};

export function isAuthenticated() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function login(email: string, password: string) {
  const ok = email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
  if (ok) localStorage.setItem(AUTH_KEY, "true");
  return ok;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(ACTIVE_PLAN_KEY);
}

function uid() {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listSavedPlans(): SavedPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    const plans = raw ? (JSON.parse(raw) as SavedPlan[]) : [];
    return Array.isArray(plans)
      ? plans.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      : [];
  } catch {
    return [];
  }
}

function writeSavedPlans(plans: SavedPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export function getSavedPlan(id: string) {
  return listSavedPlans().find((p) => p.id === id) ?? null;
}

export function savePlan(record: SavedPlan) {
  const plans = listSavedPlans();
  const idx = plans.findIndex((p) => p.id === record.id);
  const next = idx >= 0 ? plans.map((p) => (p.id === record.id ? record : p)) : [record, ...plans];
  writeSavedPlans(next);
  localStorage.setItem(ACTIVE_PLAN_KEY, record.id);
  return record;
}

export function createSavedPlan(name = "Nouveau plan", plan: Plan, theme?: Theme2D) {
  const now = new Date().toISOString();
  const record: SavedPlan = { id: uid(), name, plan, theme, createdAt: now, updatedAt: now };
  return savePlan(record);
}

export function updateSavedPlan(
  id: string,
  patch: Partial<Pick<SavedPlan, "name" | "plan" | "theme">>,
) {
  const current = getSavedPlan(id);
  if (!current) return null;
  const next: SavedPlan = { ...current, ...patch, updatedAt: new Date().toISOString() };
  return savePlan(next);
}

export function deleteSavedPlan(id: string) {
  writeSavedPlans(listSavedPlans().filter((p) => p.id !== id));
  if (localStorage.getItem(ACTIVE_PLAN_KEY) === id) localStorage.removeItem(ACTIVE_PLAN_KEY);
}

export function getActivePlanId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_PLAN_KEY);
}

export function setActivePlanId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_PLAN_KEY, id);
  else localStorage.removeItem(ACTIVE_PLAN_KEY);
}
