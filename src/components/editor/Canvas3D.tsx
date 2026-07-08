import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, ContactShadows } from "@react-three/drei";
import { useEditor } from "@/lib/editor/store";
import { wallAngle, wallLength } from "@/lib/editor/geometry";
import { FurnitureMesh3D } from "./FurnitureMesh3D";

const SCALE = 0.01;

export function Canvas3D() {
  const { plan, wall3DColor, floor3DColor } = useEditor();
  const ceilingH = plan.ceilingHeight ?? 250;

  // Auto-fit camera to plan bounds so we never spawn inside a wall.
  const camera = useMemo(() => {
    if (plan.walls.length === 0) {
      return { position: [8, 8, 8] as [number, number, number], target: [0, 1, 0] as [number, number, number] };
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const w of plan.walls) {
      minX = Math.min(minX, w.a.x, w.b.x);
      maxX = Math.max(maxX, w.a.x, w.b.x);
      minZ = Math.min(minZ, w.a.y, w.b.y);
      maxZ = Math.max(maxZ, w.a.y, w.b.y);
    }
    const cx = ((minX + maxX) / 2) * SCALE;
    const cz = ((minZ + maxZ) / 2) * SCALE;
    const sizeX = (maxX - minX) * SCALE;
    const sizeZ = (maxZ - minZ) * SCALE;
    const diag = Math.hypot(sizeX, sizeZ);
    const d = Math.max(6, diag * 1.15);
    return {
      position: [cx + d * 0.75, d * 0.85, cz + d * 0.75] as [number, number, number],
      target: [cx, ceilingH * SCALE * 0.4, cz] as [number, number, number],
    };
  }, [plan.walls, ceilingH]);

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#e8e4dc] to-[#c9c2b3]">
      <Canvas camera={{ position: camera.position, fov: 45 }} shadows>
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[camera.position[0] + 4, 15, camera.position[2] + 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Environment preset="apartment" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={floor3DColor} roughness={0.9} />
        </mesh>
        <Grid
          args={[200, 200]}
          cellSize={0.2}
          cellThickness={0.5}
          cellColor="#c9b98a"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#8b7355"
          fadeDistance={60}
          fadeStrength={1.5}
          position={[0, 0.001, 0]}
        />

        {plan.walls.map((w) => {
          const rawLen = wallLength(w);
          const thick = w.thickness * SCALE;
          const len = (rawLen + w.thickness) * SCALE;
          const ang = wallAngle(w);
          const cx = ((w.a.x + w.b.x) / 2) * SCALE;
          const cz = ((w.a.y + w.b.y) / 2) * SCALE;
          const wallH = (w.height ?? ceilingH) * SCALE;
          const wallColor = w.wallType === "interior" ? "#e8e0cc" : wall3DColor;
          const openings = plan.openings.filter((o) => o.wallId === w.id);

          const sorted = [...openings].sort((a, b) => a.t - b.t);
          const rects: Array<{ x0: number; x1: number; y0: number; y1: number }> = [
            { x0: -len / 2, x1: len / 2, y0: 0, y1: wallH },
          ];
          for (const o of sorted) {
            const oW = o.width * SCALE;
            const oCenter = (o.t - 0.5) * rawLen * SCALE;
            const oX0 = oCenter - oW / 2;
            const oX1 = oCenter + oW / 2;
            const isDoor = o.type === "door";
            const oH = (o.height ?? (isDoor ? 210 : 120)) * SCALE;
            const sill = (o.sillHeight ?? (isDoor ? 0 : 100)) * SCALE;
            const openTop = sill + oH;
            const next: typeof rects = [];
            for (const r of rects) {
              if (oX1 <= r.x0 || oX0 >= r.x1) { next.push(r); continue; }
              if (oX0 > r.x0) next.push({ x0: r.x0, x1: oX0, y0: r.y0, y1: r.y1 });
              if (oX1 < r.x1) next.push({ x0: oX1, x1: r.x1, y0: r.y0, y1: r.y1 });
              const midX0 = Math.max(oX0, r.x0);
              const midX1 = Math.min(oX1, r.x1);
              if (sill > r.y0) next.push({ x0: midX0, x1: midX1, y0: r.y0, y1: Math.min(sill, r.y1) });
              if (openTop < r.y1) next.push({ x0: midX0, x1: midX1, y0: Math.max(openTop, r.y0), y1: r.y1 });
            }
            rects.length = 0;
            rects.push(...next);
          }

          return (
            <group key={w.id} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
              {rects.map((r, i) => (
                <mesh key={i} position={[(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[Math.max(0.001, r.x1 - r.x0), Math.max(0.001, r.y1 - r.y0), thick]} />
                  <meshStandardMaterial color={wallColor} roughness={0.9} />
                </mesh>
              ))}
              {openings.filter((o) => o.type === "window").map((o) => {
                const oW = o.width * SCALE;
                const oX = (o.t - 0.5) * rawLen * SCALE;
                const oH = (o.height ?? 120) * SCALE;
                const sill = (o.sillHeight ?? 100) * SCALE;
                return (
                  <mesh key={o.id} position={[oX, sill + oH / 2, 0]}>
                    <boxGeometry args={[oW * 0.95, oH * 0.95, thick * 0.15]} />
                    <meshStandardMaterial color="#a8c8d8" transparent opacity={0.45} roughness={0.15} metalness={0.1} />
                  </mesh>
                );
              })}
              {openings.filter((o) => o.type === "door").map((o) => {
                const oW = o.width * SCALE;
                const oX = (o.t - 0.5) * rawLen * SCALE;
                const oH = (o.height ?? 210) * SCALE;
                return (
                  <mesh key={o.id} position={[oX - oW * 0.35, oH / 2, thick / 2 + 0.005]} castShadow>
                    <boxGeometry args={[oW * 0.95, oH, 0.03]} />
                    <meshStandardMaterial color="#6b4a2b" roughness={0.6} />
                  </mesh>
                );
              })}
            </group>
          );
        })}

        {plan.furniture.map((f) => (
          <FurnitureMesh3D key={f.id} f={f} />
        ))}

        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={60} blur={2} far={4} />
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
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-panel backdrop-blur">
        Clic gauche : orbite · Clic droit : déplacer · Molette : zoom
      </div>
    </div>
  );
}
