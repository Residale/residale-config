// Contract test for D15/T13 (DESIGN.md): isAuthenticated()/getCurrentMember()
// must never make the client-settable "temporary access" bypass
// (residale-config-temp-access-v1 in localStorage) look like a real signed
// -in session once SSO ships. Source-text based (not a live import) so this
// runs with zero dependencies and without needing VITE_SUPABASE_URL/ANON_KEY
// configured — matches the style of residale-webmail/tests/*.test.mjs (F4).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const planLibrarySource = readFileSync(
  new URL("../src/lib/editor/plan-library.ts", import.meta.url),
  "utf8",
);

function extractFunctionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `could not locate "${signature}" in plan-library.ts`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`unbalanced braces reading "${signature}"`);
}

const getCurrentMemberBody = extractFunctionBody(
  planLibrarySource,
  "export async function getCurrentMember(",
);
const isAuthenticatedBody = extractFunctionBody(
  planLibrarySource,
  "export async function isAuthenticated(",
);

assert.doesNotMatch(
  getCurrentMemberBody,
  /isTempAccessSession/,
  "getCurrentMember must no longer reference isTempAccessSession (D15/T13)",
);
assert.doesNotMatch(
  isAuthenticatedBody,
  /isTempAccessSession/,
  "isAuthenticated must no longer reference isTempAccessSession (D15/T13)",
);

// Both functions must still fall through to a real Supabase session check —
// this guards against the fix degenerating into "always return
// false/null" instead of actually checking auth.getSession().
assert.match(
  getCurrentMemberBody,
  /auth\.getSession\(\)/,
  "getCurrentMember must still check a real Supabase session",
);
assert.match(
  isAuthenticatedBody,
  /auth\.getSession\(\)/,
  "isAuthenticated must still check a real Supabase session",
);

// The temp-access bypass itself is allowed to keep existing for the
// explicit, offline local-plan-storage convenience (D15: "the local-plan
// storage path may remain") — it must simply no longer feed these two
// functions. Confirm the helper is still defined (i.e. this test would fail
// loudly, not silently, if a future refactor deletes it along with its
// remaining call sites without updating this test's assumptions).
assert.match(
  planLibrarySource,
  /function isTempAccessSession\(/,
  "isTempAccessSession should still exist for the local-only plan storage path",
);

// ── supabase-client.ts SSO wiring ─────────────────────────────────────────
const supabaseClientSource = readFileSync(
  new URL("../src/lib/supabase-client.ts", import.meta.url),
  "utf8",
);
assert.match(supabaseClientSource, /storageKey:/, "supabase-client.ts must set storageKey");
assert.match(
  supabaseClientSource,
  /storageKey:\s*ssoEnabled\s*\?\s*RESIDALE_SESSION_KEY\s*:\s*LEGACY_STORAGE_KEY/,
  "storageKey must switch between the shared session key and the legacy per-project key on the SSO gate",
);
assert.match(
  supabaseClientSource,
  /LEGACY_STORAGE_KEY\s*=\s*isSupabaseConfigured[\s\S]{0,120}new URL\(supabaseUrl!\)\.hostname\.split\("\."\)\[0\][\s\S]{0,40}-auth-token/,
  "the legacy key must be derived from the project ref in VITE_SUPABASE_URL (sb-<ref>-auth-token)",
);
assert.doesNotMatch(
  supabaseClientSource,
  /flowType/,
  "flowType must not be set (D5 — implicit flow stays the default)",
);
assert.match(
  supabaseClientSource,
  /typeof window !== "undefined"/,
  "storage wiring must guard window access (SSR, F3)",
);

console.log("config auth contract test passed");
