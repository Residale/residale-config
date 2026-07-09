import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EditorShell } from "@/components/editor/EditorShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Floor Whisper — Residale" },
      { name: "description", content: "Configurez des plans d'habitat Residale, avec murs, ouvertures, façades et export PDF architecte." },
      { property: "og:title", content: "Floor Whisper — Residale" },
      { property: "og:description", content: "Configurez des plans d'habitat Residale, avec murs, ouvertures, façades et export PDF architecte." },
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
          <div className="font-display text-2xl">Floor Whisper</div>
          <div className="mt-2 text-xs text-muted-foreground">Chargement…</div>
        </div>
      </div>
    );
  }
  return <EditorShell />;
}
