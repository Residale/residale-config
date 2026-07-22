import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function currentTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("app-theme", next);
    } catch {
      // localStorage unavailable (private mode) — theme still toggles for the session
    }
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
      className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
