import { useEffect, useMemo, useRef } from "react";
import { useEditor } from "@/lib/editor/store";
import type { Plan, Opening, RoofKind, SectionLine, Wall } from "@/lib/editor/types";

export type EpureWall = {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  h: number;
};

export type EpureOpening = {
  id: number;
  wall: number;
  type: "door" | "window";
  off: number;
  w: number;
  h: number;
  sill?: number;
  hinge?: number;
  side?: number;
};

export type EpureFurniture = {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  z?: number;
  label?: string;
  color?: string;
};

export type EpureState = {
  version: number;
  walls: EpureWall[];
  openings: EpureOpening[];
  dims: Array<{ id: number; x1: number; y1: number; x2: number; y2: number }>;
  section: { x1: number; y1: number; x2: number; y2: number } | null;
  roof: {
    type: "flat" | "mono" | "gable" | "hip";
    pitch: number;
    orient: number;
    overhang: number;
    thick: number;
  };
  defaults: {
    wallH: number;
    wallT: number;
    doorW: number;
    doorH: number;
    winW: number;
    winH: number;
    winSill: number;
  };
  furniture: EpureFurniture[];
  cladding: {
    primary: "wood" | "composite" | "metal";
    secondary: "wood" | "composite" | "metal";
    metalPercent: number;
    orientation: "vertical" | "horizontal";
    woodColor: string;
    metalColor: string;
    zones: string;
  };
  grid?: number;
  showWallDims?: boolean;
};

const EMPTY_EPURE: EpureState = {
  version: 2,
  walls: [],
  openings: [],
  dims: [],
  section: null,
  roof: { type: "gable", pitch: 30, orient: 0, overhang: 40, thick: 20 },
  defaults: { wallH: 270, wallT: 20, doorW: 90, doorH: 210, winW: 120, winH: 120, winSill: 90 },
  furniture: [],
  cladding: {
    primary: "wood",
    secondary: "metal",
    metalPercent: 0,
    orientation: "vertical",
    woodColor: "#7A5636",
    metalColor: "#20242A",
    zones: "all",
  },
  grid: 10,
  showWallDims: true,
};

function asId(id: number | string) {
  return String(id);
}

function epureRoofKind(type: EpureState["roof"]["type"]): RoofKind {
  if (type === "mono" || type === "gable" || type === "hip") return type;
  return "flat";
}

function convertEpureToPlan(epure: EpureState, previous: Plan): Plan {
  const walls: Wall[] = epure.walls.map((w) => ({
    id: asId(w.id),
    a: { x: w.x1, y: w.y1 },
    b: { x: w.x2, y: w.y2 },
    thickness: w.t,
    height: w.h,
    wallType: "exterior",
  }));

  const wallByNumericId = new Map(epure.walls.map((w) => [w.id, w]));
  const openings: Opening[] = epure.openings
    .filter((o) => wallByNumericId.has(o.wall))
    .map((o) => {
      const wall = wallByNumericId.get(o.wall)!;
      const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
      return {
        id: asId(o.id),
        wallId: asId(o.wall),
        t: Math.max(0, Math.min(1, (o.off + o.w / 2) / len)),
        width: o.w,
        type: o.type,
        height: o.h,
        sillHeight: o.type === "door" ? 0 : (o.sill ?? epure.defaults.winSill),
        hingeSide: o.hinge ? "b" : "a",
        swingSide: (o.side ?? 1) >= 0 ? "p" : "n",
      } satisfies Opening;
    });

  const sections: SectionLine[] = epure.section
    ? [
        {
          id: "A",
          name: "A",
          a: { x: epure.section.x1, y: epure.section.y1 },
          b: { x: epure.section.x2, y: epure.section.y2 },
        },
      ]
    : [];

  return {
    ...previous,
    epure,
    walls,
    openings,
    furniture: epure.furniture.map((f) => ({
      id: asId(f.id),
      kind: (f.kind as Plan["furniture"][number]["kind"]) || "table",
      x: f.x,
      y: f.y,
      width: f.w,
      height: f.h,
      rotation: f.rot ?? 0,
      label: f.label,
      zHeight: f.z,
    })),
    labels: previous.labels ?? [],
    sections,
    ceilingHeight: epure.defaults.wallH,
    roof: {
      kind: epureRoofKind(epure.roof.type),
      pitch: epure.roof.type === "flat" ? 1 : epure.roof.pitch,
      eaveHeight: epure.defaults.wallH,
      thickness: epure.roof.thick,
      overhang: epure.roof.overhang,
      ridgeAxis: epure.roof.orient % 2 === 0 ? "x" : "y",
      slopeAxis: epure.roof.orient % 2 === 0 ? "y" : "x",
      slopeDirection: epure.roof.orient === 0 || epure.roof.orient === 1 ? 1 : -1,
    },
  };
}

function normalizeEpure(input: unknown): EpureState {
  if (!input || typeof input !== "object") return EMPTY_EPURE;
  const partial = input as Partial<EpureState>;
  return {
    ...EMPTY_EPURE,
    ...partial,
    roof: { ...EMPTY_EPURE.roof, ...(partial.roof ?? {}) },
    defaults: { ...EMPTY_EPURE.defaults, ...(partial.defaults ?? {}) },
    cladding: { ...EMPTY_EPURE.cladding, ...(partial.cladding ?? {}) },
    walls: Array.isArray(partial.walls) ? partial.walls : [],
    openings: Array.isArray(partial.openings) ? partial.openings : [],
    dims: Array.isArray(partial.dims) ? partial.dims : [],
    furniture: Array.isArray(partial.furniture) ? partial.furniture : [],
    section: partial.section ?? null,
  };
}

export function EpureEditor({ onBackToPlans }: { onBackToPlans?: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const initialEpure = useMemo(
    () => normalizeEpure(useEditor.getState().plan.epure),
    // Active plan loads remount EditorShell via parent state changes; read once per mount.
    [],
  );

  useEffect(() => {
    const postInitialState = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "residale-epure-load", payload: initialEpure },
        window.location.origin,
      );
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as { type?: string; payload?: unknown };
      if (message.type === "residale-epure-ready") {
        postInitialState();
        return;
      }
      if (message.type === "residale-epure-back") {
        onBackToPlans?.();
        return;
      }
      if (message.type !== "residale-epure-change") return;
      const epure = normalizeEpure(message.payload);
      useEditor.setState((state) => ({
        plan: convertEpureToPlan(epure, state.plan),
      }));
    };

    window.addEventListener("message", onMessage);
    const timer = window.setTimeout(postInitialState, 500);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [initialEpure, onBackToPlans]);

  return (
    <iframe
      ref={iframeRef}
      src="/epure-editor.html"
      title="Éditeur de plans Residale"
      className="h-screen w-screen border-0 bg-white"
    />
  );
}
