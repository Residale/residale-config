import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EditorShell } from "@/components/editor/EditorShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plana Studio — Créateur de plans en ligne" },
      { name: "description", content: "Concevez vos plans d'appartement et de maison en 2D et 3D, avec un éditeur simple, précis et élégant." },
      { property: "og:title", content: "Plana Studio — Créateur de plans en ligne" },
      { property: "og:description", content: "Concevez vos plans d'appartement et de maison en 2D et 3D, avec un éditeur simple, précis et élégant." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="font-display text-2xl">Plana Studio</div>
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        </div>
      </div>
    );
  }
  return <EditorShell />;
}
