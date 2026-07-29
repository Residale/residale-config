// residale-global-sign-out.ts — "Se déconnecter partout" (DESIGN.md D12).
//
// Config's own copy of the CRM implementation (orchestrator instruction:
// wire onSignOutEverywhere in both repos — DESIGN.md's BRIEF-CRM-CONFIG §5
// text scoped this to CRM only, but the switcher is mounted in both apps
// with the same contract, so both get the real action rather than a
// silently-missing footer button in Config).
//
// Order matters and MUST NOT change:
//   1. Revoke every refresh token server-side (`scope: 'global'`) — the
//      authoritative step. Best-effort: a network failure still falls
//      through to steps 2-3 so the user is never stuck unable to sign out
//      locally.
//   2. Clear the shared cookie (all chunks, both `__Secure-` and unprefixed
//      variants) AND the legacy storage key — regardless of whether the SSO
//      cookie gate is currently on or off, so a rollback mid-flight can
//      never leave a resurrectable session (T12).
//   3. Navigate (not fetch — no CORS/credentialed-POST surface) to webmail's
//      `/sso/logout`, which clears every server-side mail session and then
//      redirects back to this app.
//
// This is a TanStack Start SSR app (F3) but signOutEverywhere() is only ever
// invoked from a click handler, never at module scope or during SSR, so no
// window/document guard is needed inside the function body itself — it is
// simply never called server-side.
import { supabase, LEGACY_STORAGE_KEY } from "@/lib/supabase-client";
import {
  RESIDALE_SESSION_KEY,
  cookieDomainFor,
  createResidaleCookieStorage,
} from "@/lib/residale-shared-session";

function webmailUrl(): string {
  return (
    (import.meta.env.VITE_RESIDALE_APP_WEBMAIL_URL as string | undefined) ||
    "https://webmail.residale.com"
  );
}

export async function signOutEverywhere(): Promise<void> {
  try {
    if (supabase) await supabase.auth.signOut({ scope: "global" });
  } catch (err) {
    // Non-fatal — still clear local state and navigate below so the user
    // isn't stranded "signed in" locally just because the revoke call
    // failed to reach Supabase.
    console.error("[residale-sso] global sign-out revoke failed", err);
  }

  const storage = createResidaleCookieStorage({
    domain: cookieDomainFor(window.location.hostname),
    secure: window.location.protocol === "https:",
    legacyKeys: [LEGACY_STORAGE_KEY],
  });
  storage.removeItem(RESIDALE_SESSION_KEY);

  // Config has no dedicated /sign-in route — the login screen renders
  // inline at "/" when unauthenticated (routes/index.tsx), so the app root
  // IS this app's sign-in URL.
  const signInUrl = `${window.location.origin}/`;
  window.location.assign(`${webmailUrl()}/sso/logout?redirect=${encodeURIComponent(signInUrl)}`);
}

export default signOutEverywhere;
