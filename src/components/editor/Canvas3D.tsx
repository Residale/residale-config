import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, ContactShadows } from "@react-three/drei";
import { useMemo } from "react";
import { useEditor } from "@/lib/editor/store";
import { wallAngle, wallLength } from "@/lib/editor/geometry";
import { CATALOG } from "@/lib/editor/furniture-catalog";

const WALL_HEIGHT = 260; // cm
const SCALE = 0.01; // cm -> m

export function Canvas3D() {
  const { plan } = useEditor();

  const walls = useMemo(
    () =>
      plan.walls.map((w) => {
        const len = wallLength(w);
        const ang = wallAngle(w);
        const cx = (w.a.x + w.b.x) / 2;
        const cz = (w.a.y + w.b.y) / 2;
        // openings affect this wall
        const openings = plan.openings.filter((o) => o.wallId === w.id);
        return { w, len, ang, cx, cz, openings };
      }),
    [plan]
  );

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#e8e4dc] to-[#c9c2b3]">
      <Canvas camera={{ position: [8, 8, 8], fov: 45 }} shadows>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 15, 8]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Environment preset="apartment" />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#e8dcc4" roughness={0.9} />
        </mesh>
        <Grid
          args={[50, 50]}
          cellSize={0.2}
          cellThickness={0.5}
          cellColor="#c9b98a"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#8b7355"
          fadeDistance={40}
          fadeStrength={1.5}
          position={[0, 0.001, 0]}
          infiniteGrid={false}
        />

        {walls.map(({ w, len, ang, cx, cz, openings }) => {
          const lenM = len * SCALE;
          const thick = w.thickness * SCALE;
          // Build wall segments split by openings (windows keep top+bottom, doors keep top)
          const sorted = [...openings].sort((a, b) => a.t - b.t);
          const segments: Array<{ start: number; end: number; hasBottom: boolean; hasTop: boolean }> = [];
          let prev = 0;
          for (const o of sorted) {
            const oCenter = o.t * lenM;
            const oHalf = (o.width * SCALE) / 2;
            const oStart = oCenter - oHalf;
            const oEnd = oCenter + oHalf;
            if (oStart > prev) segments.push({ start: prev, end: oStart, hasBottom: true, hasTop: true });
            // opening zone: bottom for windows only, top always
            segments.push({
              start: oStart,
              end: oEnd,
              hasBottom: o.type === "window",
              hasTop: true,
            });
            prev = oEnd;
          }
          if (prev < lenM) segments.push({ start: prev, end: lenM, hasBottom: true, hasTop: true });

          return (
            <group key={w.id} position={[cx * SCALE, 0, cz * SCALE]} rotation={[0, -ang, 0]}>
              {segments.map((s, i) => {
                const segLen = s.end - s.start;
                if (segLen <= 0) return null;
                const cxSeg = (s.start + s.end) / 2 - lenM / 2;
                const H = WALL_HEIGHT * SCALE;
                const doorH = 210 * SCALE;
                const winBottom = 90 * SCALE;
                const winTop = 210 * SCALE;
                const els: React.ReactNode[] = [];
                if (s.hasBottom && s.hasTop) {
                  // full wall
                  els.push(
                    <mesh key="f" position={[cxSeg, H / 2, 0]} castShadow receiveShadow>
                      <boxGeometry args={[segLen, H, thick]} />
                      <meshStandardMaterial color="#f0e8d8" roughness={0.85} />
                    </mesh>
                  );
                } else if (s.hasTop && !s.hasBottom) {
                  // door: top piece above door height
                  const topH = H - doorH;
                  els.push(
                    <mesh key="t" position={[cxSeg, doorH + topH / 2, 0]} castShadow receiveShadow>
                      <boxGeometry args={[segLen, topH, thick]} />
                      <meshStandardMaterial color="#f0e8d8" roughness={0.85} />
                    </mesh>
                  );
                } else if (s.hasBottom && s.hasTop === false) {
                  // window: bottom + top pieces
                }
                if (!s.hasBottom || (s.hasBottom && !s.hasTop)) {
                  // window bottom + top pieces
                  if (s.hasTop === true && s.hasBottom === false) {
                    // handled above (door)
                  }
                }
                // proper window handling: hasBottom=true & hasTop=true means solid; opening zone we set hasBottom differently
                // Redo cleaner for window (start<end, hasBottom=true means window has bottom sill piece)
                return <group key={i}>{els}</group>;
              })}
            </group>
          );
        })}

        {/* Simpler: draw walls with cut-outs via separate approach - render solid then subtract openings via extra planes */}
        {plan.walls.map((w) => {
          const len = wallLength(w) * SCALE;
          const thick = w.thickness * SCALE;
          const ang = wallAngle(w);
          const cx = ((w.a.x + w.b.x) / 2) * SCALE;
          const cz = ((w.a.y + w.b.y) / 2) * SCALE;
          const openings = plan.openings.filter((o) => o.wallId === w.id);
          return (
            <group key={`wall-${w.id}`} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
              <mesh position={[0, (WALL_HEIGHT * SCALE) / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[len, WALL_HEIGHT * SCALE, thick]} />
                <meshStandardMaterial color="#f0e8d8" roughness={0.9} />
              </mesh>
              {/* Punch openings with contrasting boxes (visual only) */}
              {openings.map((o) => {
                const oW = o.width * SCALE;
                const oX = (o.t - 0.5) * len;
                const isDoor = o.type === "door";
                const oH = isDoor ? 210 * SCALE : 120 * SCALE;
                const oY = isDoor ? oH / 2 : 90 * SCALE + oH / 2;
                return (
                  <mesh key={o.id} position={[oX, oY, 0]}>
                    <boxGeometry args={[oW, oH, thick + 0.02]} />
                    <meshStandardMaterial
                      color={isDoor ? "#8b6b47" : "#a8c8d8"}
                      transparent
                      opacity={isDoor ? 1 : 0.35}
                      roughness={0.3}
                    />
                  </mesh>
                );
              })}
            </group>
          );
        })}

        {/* Furniture */}
        {plan.furniture.map((f) => {
          const item = CATALOG.find((c) => c.kind === f.kind);
          const color = item?.color ?? "#c9b89a";
          const w = f.width * SCALE;
          const d = f.height * SCALE;
          const heightMap: Record<string, number> = {
            bed: 45, sofa: 80, chair: 90, table: 45, dining: 75, desk: 75,
            toilet: 40, sink: 85, bath: 55, fridge: 180, stove: 90, plant: 100, rug: 1,
          };
          const h = (heightMap[f.kind] ?? 60) * SCALE;
          return (
            <group
              key={f.id}
              position={[f.x * SCALE, h / 2, f.y * SCALE]}
              rotation={[0, (-f.rotation * Math.PI) / 180, 0]}
            >
              <mesh castShadow receiveShadow>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={color} roughness={0.75} />
              </mesh>
            </group>
          );
        })}

        <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={40} blur={2} far={4} />
        <OrbitControls makeDefault enableDamping target={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}
