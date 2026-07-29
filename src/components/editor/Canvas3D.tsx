import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useEditor } from "@/lib/editor/store";
import { wallAngle, wallLength } from "@/lib/editor/geometry";
import { openingHeight } from "@/lib/editor/opening-defaults";
import { summarizeRooms } from "@/lib/editor/rooms";

import { FurnitureMesh3D } from "./FurnitureMesh3D";

const SCALE = 0.01;
const DEFAULT_CEILING_HEIGHT = 250;

function finiteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function finitePoint(p: unknown): p is { x: number; y: number } {
  return Boolean(
    p &&
    typeof p === "object" &&
    finiteNumber((p as { x?: unknown }).x) &&
    finiteNumber((p as { y?: unknown }).y),
  );
}

function safeCm(v: unknown, fallback: number) {
  return finiteNumber(v) && v > 0 ? v : fallback;
}

function Scene() {
  const { plan, wall3DColor, floor3DColor } = useEditor();
  const ceilingH = safeCm(plan.ceilingHeight, DEFAULT_CEILING_HEIGHT);

  const validWalls = useMemo(
    () =>
      plan.walls.filter((w) => {
        if (!finitePoint(w.a) || !finitePoint(w.b)) return false;
        const len = wallLength(w);
        return Number.isFinite(len) && len >= 1;
      }),
    [plan.walls],
  );

  const camera = useMemo(() => {
    if (validWalls.length === 0) {
      return {
        position: [8, 8, 8] as [number, number, number],
        target: [0, 1, 0] as [number, number, number],
      };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const w of validWalls) {
      minX = Math.min(minX, w.a.x, w.b.x);
      maxX = Math.max(maxX, w.a.x, w.b.x);
      minZ = Math.min(minZ, w.a.y, w.b.y);
      maxZ = Math.max(maxZ, w.a.y, w.b.y);
    }
    const cx = ((minX + maxX) / 2) * SCALE;
    const cz = ((minZ + maxZ) / 2) * SCALE;
    const diag = Math.max(1, Math.hypot((maxX - minX) * SCALE, (maxZ - minZ) * SCALE));
    const d = Math.max(6, diag * 1.2);
    return {
      position: [cx + d * 0.75, d * 0.85, cz + d * 0.75] as [number, number, number],
      target: [cx, ceilingH * SCALE * 0.45, cz] as [number, number, number],
    };
  }, [validWalls, ceilingH]);

  return (
    <Canvas camera={{ position: camera.position, fov: 45 }} shadows={false}>
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[camera.position[0] + 4, 12, camera.position[2] + 4]}
        intensity={1}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={floor3DColor} roughness={0.95} />
      </mesh>
      <Grid
        args={[200, 200]}
        cellSize={0.2}
        cellThickness={0.5}
        cellColor="#94a3b8"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#475569"
        fadeDistance={60}
        fadeStrength={1.5}
        position={[0, 0.001, 0]}
      />

      {validWalls.map((w) => {
        const len = wallLength(w) * SCALE;
        const thick = safeCm(w.thickness, 20) * SCALE;
        const wallH = safeCm(w.height, ceilingH) * SCALE;
        if (![len, thick, wallH].every(Number.isFinite) || len <= 0 || thick <= 0 || wallH <= 0)
          return null;

        const ang = wallAngle(w);
        const cx = ((w.a.x + w.b.x) / 2) * SCALE;
        const cz = ((w.a.y + w.b.y) / 2) * SCALE;
        const wallColor = w.wallType === "interior" ? "#e2e8f0" : wall3DColor;
        const openings = plan.openings.filter(
          (o) => o.wallId === w.id && finiteNumber(o.t) && finiteNumber(o.width),
        );

        return (
          <group key={w.id} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
            <mesh position={[0, wallH / 2, 0]}>
              <boxGeometry args={[len, wallH, thick]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>
            {openings.map((o) => {
              const oW = safeCm(o.width, o.type === "door" ? 83 : 100) * SCALE;
              const oH = safeCm(openingHeight(o), o.type === "door" ? 210 : 115) * SCALE;
              const x = (o.t - 0.5) * len;
              const y = Math.min(wallH - 0.02, o.type === "door" ? oH / 2 : wallH * 0.55);
              if (![oW, oH, x, y].every(Number.isFinite) || oW <= 0 || oH <= 0) return null;
              return (
                <mesh key={o.id} position={[x, Math.max(0.05, y), thick / 2 + 0.004]}>
                  <boxGeometry
                    args={[Math.min(oW, len * 0.9), Math.min(oH, wallH * 0.85), 0.012]}
                  />
                  <meshStandardMaterial
                    color={o.type === "door" ? "#8a5a2f" : "#a8c8d8"}
                    roughness={0.55}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {plan.furniture.map((f) => (
        <FurnitureMesh3D key={f.id} f={f} />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        target={camera.target}
        zoomSpeed={0.55}
        panSpeed={0.9}
        rotateSpeed={0.7}
        minDistance={1.5}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2 - 0.02}
      />
    </Canvas>
  );
}

export function Canvas3D() {
  const { show3DRoof, toggle3DRoof, plan } = useEditor();
  const stats = useMemo(() => {
    const fallback = safeCm(plan.ceilingHeight, DEFAULT_CEILING_HEIGHT);
    const validWalls = plan.walls.filter((w) => finitePoint(w.a) && finitePoint(w.b));
    const exterior = validWalls.filter((w) => (w.wallType ?? "exterior") === "exterior");
    const source = exterior.length ? exterior : validWalls;
    const envelopeH = source.length
      ? Math.max(...source.map((w) => safeCm(w.height, fallback)))
      : fallback;
    const hsp = Math.max(1, envelopeH);
    const rooms = summarizeRooms(plan);
    const totalArea = rooms.reduce((s, r) => s + r.area, 0);
    let maxWall = 0;
    for (const w of validWalls) maxWall = Math.max(maxWall, safeCm(w.height, hsp));
    const floor = 20;
    const roofRun = plan.roof
      ? Math.max(
          0,
          Math.tan(((finiteNumber(plan.roof.pitch) ? plan.roof.pitch : 0) * Math.PI) / 180) *
            ((plan.roof.slopeAxis ?? "x") === "x" ? 800 : 400),
        ) + safeCm(plan.roof.thickness, 20)
      : 0;
    const horsTout = maxWall + floor + roofRun;
    return { hsp, totalArea, horsTout };
  }, [plan]);

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-muted to-secondary">
      <Scene />
      {plan.roof && (
        <button
          onClick={toggle3DRoof}
          className="absolute right-3 top-3 rounded-md border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium shadow-panel backdrop-blur hover:border-ring/40"
        >
          {show3DRoof ? "Masquer la toiture" : "Afficher la toiture"}
        </button>
      )}
      {plan.walls.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-card/95 px-3 py-2 text-[11px] shadow-panel backdrop-blur">
          <div className="flex flex-col gap-0.5 font-mono">
            <div>
              <span className="text-muted-foreground">Surface :</span>{" "}
              <span className="font-semibold">{stats.totalArea.toFixed(1)} m²</span>
            </div>
            <div>
              <span className="text-muted-foreground">HSP :</span>{" "}
              <span className="font-semibold">{(stats.hsp / 100).toFixed(2)} m</span>
            </div>
            <div>
              <span className="text-muted-foreground">Hors-tout :</span>{" "}
              <span className="font-semibold">{(stats.horsTout / 100).toFixed(2)} m</span>
            </div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        Clic gauche : orbite · Clic droit : déplacer · Molette : zoom
      </div>
    </div>
  );
}
