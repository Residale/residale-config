import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, ContactShadows } from "@react-three/drei";
import { useEditor } from "@/lib/editor/store";
import { wallAngle, wallLength } from "@/lib/editor/geometry";
import { CATALOG } from "@/lib/editor/furniture-catalog";
import { furnitureDefaultHeight } from "@/lib/editor/sections";

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
          // extend wall by half thickness at each end so corners fully seal
          const len = (rawLen + w.thickness) * SCALE;
          const ang = wallAngle(w);
          const cx = ((w.a.x + w.b.x) / 2) * SCALE;
          const cz = ((w.a.y + w.b.y) / 2) * SCALE;
          const wallH = (w.height ?? ceilingH) * SCALE;
          const openings = plan.openings.filter((o) => o.wallId === w.id);
          return (
            <group key={w.id} position={[cx, 0, cz]} rotation={[0, -ang, 0]}>
              <mesh position={[0, wallH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[len, wallH, thick]} />
                <meshStandardMaterial color={wall3DColor} roughness={0.9} />
              </mesh>
              {openings.map((o) => {
                const oW = o.width * SCALE;
                // offset within original wall segment (excluding the extension pads)
                const oX = (o.t - 0.5) * rawLen * SCALE;
                const isDoor = o.type === "door";
                const oH = (o.height ?? (isDoor ? 210 : 120)) * SCALE;
                const sill = (o.sillHeight ?? (isDoor ? 0 : 100)) * SCALE;
                return (
                  <mesh key={o.id} position={[oX, sill + oH / 2, 0]}>
                    <boxGeometry args={[oW, oH, thick + 0.02]} />
                    <meshStandardMaterial color={isDoor ? "#6b4a2b" : "#a8c8d8"} transparent opacity={isDoor ? 1 : 0.45} roughness={isDoor ? 0.6 : 0.15} metalness={isDoor ? 0 : 0.1} />
                  </mesh>
                );
              })}
            </group>
          );
        })}

        {plan.furniture.map((f) => {
          const item = CATALOG.find((c) => c.kind === f.kind);
          const color = item?.color ?? "#c9b89a";
          const w = f.width * SCALE;
          const d = f.height * SCALE;
          const h = (f.zHeight ?? furnitureDefaultHeight(f.kind)) * SCALE;
          return (
            <group key={f.id} position={[f.x * SCALE, h / 2, f.y * SCALE]} rotation={[0, (-f.rotation * Math.PI) / 180, 0]}>
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
