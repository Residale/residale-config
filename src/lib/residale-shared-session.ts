// residaleSharedSession.ts — canonical Residale shared-session cookie adapter (SSO Strategy A, DESIGN.md D2–D7/D14).
// Copied byte-identically (filename may be kebab-cased) into:
//   residale-crm/apps/web/src/lib/residaleSharedSession.ts
//   residale-files/apps/web/src/lib/residaleSharedSession.ts
//   residale-config/src/lib/residale-shared-session.ts
// Pure module: no import.meta.env, SSR-safe (every document/window access guarded),
// importable under `node --experimental-strip-types` for contract tests.

export const RESIDALE_SESSION_KEY = "residale-sso-auth";

export type ResidaleCookieOptions = {
  /** ".residale.com" in production, undefined on localhost/unknown hosts. */
  domain?: string;
  /** true when served over https — adds Secure + the __Secure- name prefix. */
  secure: boolean;
  /** Per-app legacy localStorage keys migrated copy-forward (never deleted on read). */
  legacyKeys: string[];
  /** Cookie Max-Age; default 400 days (browser cap). */
  maxAgeSeconds?: number;
};

const DEFAULT_MAX_AGE_SECONDS = 34_560_000; // 400 days
const CHUNK_SIZE = 3400; // bytes per cookie chunk (T15)
export const MAX_CHUNKS = 6; // hard cap (T15)
const WATCHER_RELOAD_GUARD_KEY = "residale-sso-watcher-last-reload";

function hasDocument(): boolean {
  return typeof document !== "undefined";
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function residaleCookieName(base: string, secure: boolean): string {
  return secure ? `__Secure-${base}` : base;
}

/** Domain attribute policy: only ever widen to .residale.com; host-only everywhere else. */
export function cookieDomainFor(hostname: string): string | undefined {
  if (!hostname || !hostname.includes(".")) return undefined; // localhost, single-label hosts
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return undefined; // raw IPv4
  if (hostname === "residale.com" || hostname.endsWith(".residale.com")) return ".residale.com";
  return undefined; // preview/unknown hosts stay host-only
}

export function chunkValue(value: string, size: number = CHUNK_SIZE): string[] {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
  return parts.length > 0 ? parts : [""];
}

/** Joins consecutive chunks, stopping at the first missing one. Returns null when chunk 0 is absent. */
export function joinChunks(parts: Array<string | null | undefined>): string | null {
  const collected: string[] = [];
  for (const part of parts) {
    if (part === null || part === undefined) break;
    collected.push(part);
  }
  return collected.length > 0 ? collected.join("") : null;
}

function rawCookieValue(cookieString: string, name: string): string | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

function readJoinedCookie(cookieString: string, fullName: string): string | null {
  const parts: Array<string | null> = [];
  for (let i = 0; i < MAX_CHUNKS; i += 1) {
    parts.push(rawCookieValue(cookieString, `${fullName}.${i}`));
  }
  const joined = joinChunks(parts);
  if (joined === null) return null;
  try {
    return decodeURIComponent(joined);
  } catch {
    return null;
  }
}

/**
 * Reads the shared session value from a Cookie header or document.cookie string,
 * trying the __Secure- prefixed name first. Usable server-side (webmail) and in tests.
 */
export function readResidaleSessionCookie(
  cookieHeaderOrDocument: string,
  baseName: string = RESIDALE_SESSION_KEY,
): string | null {
  for (const name of [`__Secure-${baseName}`, baseName]) {
    const value = readJoinedCookie(cookieHeaderOrDocument, name);
    if (value !== null) return value;
  }
  return null;
}

export function createResidaleCookieStorage(opts: ResidaleCookieOptions): {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
} {
  const maxAge = opts.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;

  const writeCookie = (name: string, value: string, maxAgeSeconds: number): void => {
    if (!hasDocument()) return;
    const bits = [`${name}=${value}`, `Max-Age=${maxAgeSeconds}`, "Path=/", "SameSite=Lax"];
    if (opts.domain) bits.push(`Domain=${opts.domain}`);
    if (opts.secure) bits.push("Secure");
    document.cookie = bits.join("; ");
  };

  const expireAllVariants = (key: string): void => {
    // Expire both prefixed and unprefixed names so an http->https transition leaves no orphan.
    for (const name of [`__Secure-${key}`, key]) {
      for (let i = 0; i < MAX_CHUNKS; i += 1) writeCookie(`${name}.${i}`, "", 0);
      writeCookie(name, "", 0);
    }
  };

  const readLegacy = (): string | null => {
    if (!hasLocalStorage()) return null;
    for (const legacyKey of opts.legacyKeys) {
      try {
        const value = window.localStorage.getItem(legacyKey);
        if (value !== null && value !== "") return value;
      } catch {
        // storage unavailable (private mode) — treat as absent
      }
    }
    return null;
  };

  const setItem = (key: string, value: string): void => {
    if (!hasDocument()) return;
    const fullName = residaleCookieName(key, opts.secure);
    const encoded = encodeURIComponent(value);
    const chunks = chunkValue(encoded);
    if (chunks.length > 2) {
      // eslint-disable-next-line no-console
      console.warn(`[residale-sso] session cookie uses ${chunks.length} chunks (>2) — watch header sizes (T15)`);
    }
    if (chunks.length > MAX_CHUNKS) {
      // eslint-disable-next-line no-console
      console.error(`[residale-sso] session value needs ${chunks.length} chunks (> ${MAX_CHUNKS}); refusing to write a truncated session`);
      return;
    }
    chunks.forEach((chunk, i) => writeCookie(`${fullName}.${i}`, chunk, maxAge));
    for (let i = chunks.length; i < MAX_CHUNKS; i += 1) writeCookie(`${fullName}.${i}`, "", 0);
  };

  const getItem = (key: string): string | null => {
    if (hasDocument()) {
      const fromCookie = readJoinedCookie(document.cookie, residaleCookieName(key, opts.secure));
      if (fromCookie !== null) return fromCookie;
    }
    // Legacy migration (D4): copy-forward once, NEVER delete the legacy entry (D14 rollback stays lossless).
    const legacy = readLegacy();
    if (legacy !== null) setItem(key, legacy);
    return legacy;
  };

  const removeItem = (key: string): void => {
    expireAllVariants(key);
    // Global/local sign-out must not let a legacy key resurrect the session (T12).
    if (hasLocalStorage()) {
      for (const legacyKey of opts.legacyKeys) {
        try {
          window.localStorage.removeItem(legacyKey);
        } catch {
          // ignore
        }
      }
    }
  };

  return { getItem, setItem, removeItem };
}

/**
 * Rollback aid (D14): when the SSO cookie gate is OFF, seed the legacy localStorage key
 * from a still-present cookie once, so users do not get logged out by the rollback.
 */
export function seedLegacyFromCookie(legacyKey: string, baseName: string = RESIDALE_SESSION_KEY): void {
  if (!hasDocument() || !hasLocalStorage()) return;
  try {
    if (window.localStorage.getItem(legacyKey) !== null) return;
    const value = readResidaleSessionCookie(document.cookie, baseName);
    if (value !== null) window.localStorage.setItem(legacyKey, value);
  } catch {
    // ignore
  }
}

/**
 * Cross-app propagation watcher (D7): on tab focus/visibility, reloads when the cookie's
 * presence disagrees with the app's belief. Reload-guarded (>=10s between reloads, persisted
 * in sessionStorage) so a persistent mismatch can never cause a reload loop.
 */
export function startResidaleSessionWatcher(args: {
  hasSession: () => boolean;
  cookieName: string;
  reload?: () => void;
  minIntervalMs?: number;
}): () => void {
  if (typeof window === "undefined" || !hasDocument()) return () => {};
  const doReload = args.reload ?? (() => window.location.reload());
  const minInterval = args.minIntervalMs ?? 10_000;

  const lastReloadAt = (): number => {
    try {
      return Number(window.sessionStorage.getItem(WATCHER_RELOAD_GUARD_KEY) ?? "0");
    } catch {
      return 0;
    }
  };
  const markReload = (at: number): void => {
    try {
      window.sessionStorage.setItem(WATCHER_RELOAD_GUARD_KEY, String(at));
    } catch {
      // ignore
    }
  };

  const check = (): void => {
    if (document.visibilityState === "hidden") return;
    const cookiePresent = rawCookieValue(document.cookie, `${args.cookieName}.0`) !== null;
    if (cookiePresent === args.hasSession()) return;
    const now = Date.now();
    if (now - lastReloadAt() < minInterval) return;
    markReload(now);
    doReload();
  };

  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  return () => {
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
  };
}
