import { create } from "zustand";
import type { Furniture, Opening, Plan, RoomLabel, Selection, Tool, Wall } from "./types";
import { uid } from "./geometry";

type View = "2d" | "3d" | "split";

type State = {
  plan: Plan;
  tool: Tool;
  selection: Selection;
  view: View;
  grid: number; // cm
  snapEnabled: boolean;
  showGrid: boolean;
  showDimensions: boolean;
  projectName: string;
  history: Plan[];
  future: Plan[];
};

type Actions = {
  setTool: (t: Tool) => void;
  setView: (v: View) => void;
  setSelection: (s: Selection) => void;
  setProjectName: (n: string) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;
  toggleDimensions: () => void;

  addWall: (w: Omit<Wall, "id">) => string;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  addOpening: (o: Omit<Opening, "id">) => string;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  addFurniture: (f: Omit<Furniture, "id">) => string;
  updateFurniture: (id: string, patch: Partial<Furniture>) => void;
  addLabel: (l: Omit<RoomLabel, "id">) => string;
  updateLabel: (id: string, patch: Partial<RoomLabel>) => void;
  deleteSelected: () => void;
  clearAll: () => void;

  commit: () => void;
  undo: () => void;
  redo: () => void;

  loadPlan: (p: Plan) => void;
};

const emptyPlan: Plan = { walls: [], openings: [], furniture: [], labels: [] };

export const useEditor = create<State & Actions>((set, get) => ({
  plan: emptyPlan,
  tool: "wall",
  selection: null,
  view: "2d",
  grid: 20,
  snapEnabled: true,
  showGrid: true,
  showDimensions: true,
  projectName: "Nouveau plan",
  history: [],
  future: [],

  setTool: (tool) => set({ tool, selection: null }),
  setView: (view) => set({ view }),
  setSelection: (selection) => set({ selection }),
  setProjectName: (projectName) => set({ projectName }),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),

  commit: () =>
    set((s) => ({ history: [...s.history.slice(-49), s.plan], future: [] })),

  addWall: (w) => {
    const id = uid();
    get().commit();
    set((s) => ({ plan: { ...s.plan, walls: [...s.plan.walls, { ...w, id }] } }));
    return id;
  },
  updateWall: (id, patch) =>
    set((s) => ({
      plan: {
        ...s.plan,
        walls: s.plan.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      },
    })),
  addOpening: (o) => {
    const id = uid();
    get().commit();
    set((s) => ({ plan: { ...s.plan, openings: [...s.plan.openings, { ...o, id }] } }));
    return id;
  },
  updateOpening: (id, patch) =>
    set((s) => ({
      plan: {
        ...s.plan,
        openings: s.plan.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      },
    })),
  addFurniture: (f) => {
    const id = uid();
    get().commit();
    set((s) => ({ plan: { ...s.plan, furniture: [...s.plan.furniture, { ...f, id }] } }));
    return id;
  },
  updateFurniture: (id, patch) =>
    set((s) => ({
      plan: {
        ...s.plan,
        furniture: s.plan.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      },
    })),
  addLabel: (l) => {
    const id = uid();
    get().commit();
    set((s) => ({ plan: { ...s.plan, labels: [...s.plan.labels, { ...l, id }] } }));
    return id;
  },
  updateLabel: (id, patch) =>
    set((s) => ({
      plan: {
        ...s.plan,
        labels: s.plan.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    })),

  deleteSelected: () => {
    const sel = get().selection;
    if (!sel) return;
    get().commit();
    set((s) => {
      const p = { ...s.plan };
      if (sel.type === "wall") {
        p.walls = p.walls.filter((w) => w.id !== sel.id);
        p.openings = p.openings.filter((o) => o.wallId !== sel.id);
      }
      if (sel.type === "opening") p.openings = p.openings.filter((o) => o.id !== sel.id);
      if (sel.type === "furniture") p.furniture = p.furniture.filter((f) => f.id !== sel.id);
      if (sel.type === "label") p.labels = p.labels.filter((l) => l.id !== sel.id);
      return { plan: p, selection: null };
    });
  },

  clearAll: () => {
    get().commit();
    set({ plan: emptyPlan, selection: null });
  },

  undo: () =>
    set((s) => {
      if (!s.history.length) return {};
      const prev = s.history[s.history.length - 1];
      return {
        plan: prev,
        history: s.history.slice(0, -1),
        future: [s.plan, ...s.future].slice(0, 50),
        selection: null,
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      const next = s.future[0];
      return {
        plan: next,
        history: [...s.history, s.plan].slice(-50),
        future: s.future.slice(1),
        selection: null,
      };
    }),

  loadPlan: (plan) => set({ plan, selection: null, history: [], future: [] }),
}));
