// ResidaleAppSwitcher.tsx — canonical Google-style app switcher (DESIGN.md D13).
// Copied per repo (filename may be kebab-cased); keep logic identical across copies.
// Only dependency: react. Icon is inline SVG (no icon library). URLs are Vite build-time env.
import { useEffect, useRef, useState } from "react";

export type ResidaleAppId = "crm" | "webmail" | "files" | "config";

type ResidaleAppEntry = {
  id: ResidaleAppId;
  label: string;
  description: string;
  url: string;
  initial: string;
  accent: string;
};

const viteEnv: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export const RESIDALE_APPS: ResidaleAppEntry[] = [
  {
    id: "crm",
    label: "CRM",
    description: "Clients & leads",
    url: viteEnv.VITE_RESIDALE_APP_CRM_URL || "https://crm.residale.com",
    initial: "C",
    accent: "#2563eb",
  },
  {
    id: "webmail",
    label: "Webmail",
    description: "Messagerie Residale",
    url: viteEnv.VITE_RESIDALE_APP_WEBMAIL_URL || "https://webmail.residale.com",
    initial: "M",
    accent: "#7c3aed",
  },
  {
    id: "files",
    label: "Files",
    description: "Documents & drive",
    url: viteEnv.VITE_RESIDALE_APP_FILES_URL || "https://files.residale.com",
    initial: "F",
    accent: "#059669",
  },
  {
    id: "config",
    label: "Configurateur",
    description: "Plans & configuration",
    url: viteEnv.VITE_RESIDALE_APP_CONFIG_URL || "https://config.residale.com",
    initial: "P",
    accent: "#d97706",
  },
];

export function ResidaleAppSwitcher({
  currentApp,
  onSignOutEverywhere,
}: {
  currentApp: ResidaleAppId;
  onSignOutEverywhere?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent): void => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative" data-testid="residale-app-switcher">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Applications Residale"
        title="Applications Residale"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-current opacity-80 transition hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <g fill="currentColor">
            {[4, 12, 20].map((y) =>
              [4, 12, 20].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" />),
            )}
          </g>
        </svg>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Applications Residale"
          className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-zinc-900"
        >
          <div className="grid grid-cols-2 gap-2">
            {RESIDALE_APPS.map((app) => {
              const isCurrent = app.id === currentApp;
              const tile = (
                <>
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: app.accent }}
                  >
                    {app.initial}
                  </span>
                  <span className="mt-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{app.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">{app.description}</span>
                </>
              );
              return isCurrent ? (
                <div
                  key={app.id}
                  aria-current="page"
                  data-testid={`residale-app-${app.id}`}
                  className="flex cursor-default flex-col items-center rounded-lg bg-black/5 px-2 py-2.5 text-center dark:bg-white/10"
                >
                  {tile}
                </div>
              ) : (
                <a
                  key={app.id}
                  href={app.url}
                  data-testid={`residale-app-${app.id}`}
                  className="flex flex-col items-center rounded-lg px-2 py-2.5 text-center transition hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {tile}
                </a>
              );
            })}
          </div>
          {onSignOutEverywhere ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void onSignOutEverywhere();
              }}
              className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-white/10 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Se déconnecter partout
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ResidaleAppSwitcher;
