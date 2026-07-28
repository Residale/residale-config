import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  RESIDALE_SESSION_KEY,
  cookieDomainFor,
  createResidaleCookieStorage,
  seedLegacyFromCookie,
} from "@/lib/residale-shared-session";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type FloorWhisperMember = {
  id: string;
  email: string | null;
  display_name: string | null;
  role_key: string | null;
  is_admin: boolean;
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Residale SSO (DESIGN.md D2-D7/D14): a shared `.residale.com` cookie carries
// the Supabase session across crm/webmail/files/config so switching apps
// never requires a relogin. Gate defaults ON; set
// VITE_RESIDALE_SSO_COOKIE_ENABLED="false" to roll back to the legacy
// per-app storage key — `seedLegacyFromCookie` below copies a still-present
// cookie into that legacy key once, so rollback loses no sessions (D14).
//
// This is a TanStack Start SSR app (F3): this module is imported by both the
// server and the client bundle, so every `window`/`document` access below is
// guarded. During SSR `hasWindow` is false, `storage` stays undefined, and
// the client falls back to whatever supabase-js already does with no custom
// storage server-side — exactly the pre-existing (pre-SSO) behavior, so SSR
// is no worse off than before this change.
export const ssoEnabled = import.meta.env.VITE_RESIDALE_SSO_COOKIE_ENABLED !== "false";
const hasWindow = typeof window !== "undefined";

// Legacy key computed from the project ref in VITE_SUPABASE_URL — this is
// the effective default storageKey supabase-js already used here before this
// change (no storageKey was ever set, F3), so it is what an existing signed
// -in user's session is currently persisted under.
export const LEGACY_STORAGE_KEY = isSupabaseConfigured
  ? `sb-${new URL(supabaseUrl!).hostname.split(".")[0]}-auth-token`
  : "sb-unconfigured-auth-token";

if (!ssoEnabled && hasWindow) {
  seedLegacyFromCookie(LEGACY_STORAGE_KEY);
}

const storage =
  ssoEnabled && hasWindow
    ? createResidaleCookieStorage({
        domain: cookieDomainFor(window.location.hostname),
        secure: window.location.protocol === "https:",
        legacyKeys: [LEGACY_STORAGE_KEY],
      })
    : undefined;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: ssoEnabled ? RESIDALE_SESSION_KEY : LEGACY_STORAGE_KEY,
        ...(storage ? { storage } : {}),
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
