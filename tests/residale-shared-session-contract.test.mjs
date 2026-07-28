// Contract test for src/lib/residale-shared-session.ts (DESIGN.md D17,
// BRIEF-CRM-CONFIG §7). Style mirrors residale-webmail/tests/*.test.mjs
// (F4): top-level node:assert/strict calls, no framework, run via
// `node --experimental-strip-types` so the .ts source can be imported
// directly without a build step.
import assert from "node:assert/strict";

// ── SSR-safety ────────────────────────────────────────────────────────────
// This whole script runs under plain Node — there is no `window`/`document`
// global at all here, exactly like the server half of a TanStack Start SSR
// render (F3). If the module referenced either at import time (module
// scope, not inside a guarded function), this import would throw before we
// even reach the assertions below.
assert.equal(
  typeof globalThis.window,
  "undefined",
  "sanity check: this test must run in a window-less context to prove SSR-safety",
);

const adapter = await import("../src/lib/residale-shared-session.ts");

assert.equal(typeof adapter.RESIDALE_SESSION_KEY, "string");
assert.equal(adapter.RESIDALE_SESSION_KEY, "residale-sso-auth");
assert.equal(typeof adapter.chunkValue, "function");
assert.equal(typeof adapter.joinChunks, "function");
assert.equal(typeof adapter.createResidaleCookieStorage, "function");
assert.equal(typeof adapter.cookieDomainFor, "function");
assert.equal(typeof adapter.startResidaleSessionWatcher, "function");

// ── Chunk round-trip ──────────────────────────────────────────────────────
const bigValue = "a".repeat(5000) + "-marker-" + "b".repeat(2000);
const chunks = adapter.chunkValue(bigValue);
assert.ok(chunks.length > 1, "a value over 3400 bytes must split into multiple chunks");
assert.equal(
  adapter.joinChunks(chunks),
  bigValue,
  "joinChunks must reassemble chunkValue's output exactly",
);

assert.equal(
  adapter.joinChunks(["a", "b", null, "c"]),
  "ab",
  "joinChunks must stop at the first missing chunk",
);
assert.equal(
  adapter.joinChunks([null, "a"]),
  null,
  "joinChunks must return null when chunk 0 is absent",
);

// ── cookieDomainFor pure logic ────────────────────────────────────────────
assert.equal(adapter.cookieDomainFor("localhost"), undefined, "localhost must stay host-only");
assert.equal(adapter.cookieDomainFor("127.0.0.1"), undefined, "raw IPv4 must stay host-only");
assert.equal(adapter.cookieDomainFor("crm.residale.com"), ".residale.com");
assert.equal(adapter.cookieDomainFor("config.residale.com"), ".residale.com");
assert.equal(adapter.cookieDomainFor("residale.com"), ".residale.com");

// ── Storage degrades to a no-op returning null with no window/document ───
// (This is the exact property the SSR wiring in supabase-client.ts depends
// on: during SSR no custom `storage` is constructed at all, but even if it
// were, the adapter itself must never throw.)
const storage = adapter.createResidaleCookieStorage({
  domain: undefined,
  secure: false,
  legacyKeys: ["sb-vvtgwjjsvyyakpuficcq-auth-token"],
});
assert.doesNotThrow(() => storage.setItem(adapter.RESIDALE_SESSION_KEY, "value"));
assert.equal(
  storage.getItem(adapter.RESIDALE_SESSION_KEY),
  null,
  "getItem must degrade to null with no document/localStorage available",
);
assert.doesNotThrow(() => storage.removeItem(adapter.RESIDALE_SESSION_KEY));

// ── Watcher no-ops without `window` rather than throwing ──────────────────
const stop = adapter.startResidaleSessionWatcher({
  hasSession: () => true,
  cookieName: adapter.RESIDALE_SESSION_KEY,
});
assert.equal(
  typeof stop,
  "function",
  "startResidaleSessionWatcher must still return a cleanup function",
);
assert.doesNotThrow(() => stop());

console.log("residale-shared-session contract test passed");
