import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, ContactShadows } from "@react-three/drei";
import { useEditor } from "@/lib/editor/store";
import { wallAngle, wallLength } from "@/lib/editor/geometry";
import { FurnitureMesh3D } from "./FurnitureMesh3D";

const SCALE = 0.01;

export function Canvas3D() {
  const { plan, wall3DColor, floor3DColor } = useEditor();
  const ceilingH = plan.ceilingHeight ?? 250;

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#e8e4dc] to-[#c9c2b3]">
      <Canvas camera={{ position: [8, 8, 8], fov: 45 }} shadows>
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 15, 8]} intensity={1.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <Environment preset="apartment" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color={floor3DColor} roughness={0.9} />
        </mesh>
        <Grid args={[80, 80]} cellSize={0.2} cellThickness={0.5} cellColor="#c9b98a" sectionSize={1} sectionThickness={1} sectionColor="#8b7355" fadeDistance={50} fadeStrength={1.5} position={[0, 0.001, 0]} />

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

          // Build wall as horizontal bands to visually carve out openings.
          // For each opening we skip its extent in X and its vertical band.
          const segments: Array<{ x: number; width: number; yBottom: number; height: number }> = [];
          // Sort openings by t
          const sorted = [...openings].sort((a, b) => a.t - b.t);
          // Full wall — subtract vertical opening rectangles by rendering wall in slices
          let cursorX = -len / 2;
          const endX = len / 2;
          const rects: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
          // start with one full rect
          rects.push({ x0: cursorX, x1: endX, y0: 0, y1: wallH });
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
              // if no X overlap, keep
              if (oX1 <= r.x0 || oX0 >= r.x1) { next.push(r); continue; }
              // left part
              if (oX0 > r.x0) next.push({ x0: r.x0, x1: oX0, y0: r.y0, y1: r.y1 });
              // right part
              if (oX1 < r.x1) next.push({ x0: oX1, x1: r.x1, y0: r.y0, y1: r.y1 });
              // middle: split vertically around opening
              const midX0 = Math.max(oX0, r.x0);
              const midX1 = Math.min(oX1, r.x1);
              if (sill > r.y0) next.push({ x0: midX0, x1: midX1, y0: r.y0, y1: Math.min(sill, r.y1) });
              if (openTop < r.y1) next.push({ x0: midX0, x1: midX1, y0: Math.max(openTop, r.y0), y1: r.y1 });
            }
            rects.length = 0;
            rects.push(...next);
          }
          for (const r of rects) {
            segments.push({
              x: (r.x0 + r.x1) / 2,
              width: r.x1 - r.x0,
              yBottom: r.y0,
              height: r.y1 - r.y0,
            });
          }

          return (
            <group key={w.id} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
              {segments.map((seg, i) => (
                <mesh key={i} position={[seg.x, seg.yBottom + seg.height / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[Math.max(0.001, seg.width), Math.max(0.001, seg.height), thick]} />
                  <meshStandardMaterial color={wallColor} roughness={0.9} />
                </mesh>
              ))}
              {/* window glass */}
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
              {/* door leaf */}
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

        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={40} blur={2} far={4} />
        <OrbitControls makeDefault enableDamping target={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}
