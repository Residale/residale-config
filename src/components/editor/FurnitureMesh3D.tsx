import type { Furniture, FurnitureKind } from "@/lib/editor/types";
import { furnitureDefaultHeight } from "@/lib/editor/sections";

const SCALE = 0.01;

type Props = { f: Furniture };

/**
 * Detailed procedural 3D meshes for each furniture kind.
 * Local space: X = width (f.width), Z = depth (f.height in plan), Y = up.
 * Piece sits on the floor (Y=0) and is centered on X/Z.
 */
export function FurnitureMesh3D({ f }: Props) {
  const w = f.width * SCALE;
  const d = f.height * SCALE;
  const h = (f.zHeight ?? furnitureDefaultHeight(f.kind)) * SCALE;
  const yaw = (-f.rotation * Math.PI) / 180;

  return (
    <group position={[f.x * SCALE, 0, f.y * SCALE]} rotation={[0, yaw, 0]}>
      <Piece kind={f.kind} w={w} d={d} h={h} />
    </group>
  );
}

function Piece({ kind, w, d, h }: { kind: FurnitureKind; w: number; d: number; h: number }) {
  switch (kind) {
    case "bed": return <Bed w={w} d={d} h={h} />;
    case "sofa": return <Sofa w={w} d={d} h={h} />;
    case "chair": return <Chair w={w} d={d} h={h} />;
    case "table": return <Table w={w} d={d} h={h} legR={0.02} color="#8b6f47" />;
    case "dining": return <Table w={w} d={d} h={h} legR={0.025} color="#7a5d3a" />;
    case "desk": return <Desk w={w} d={d} h={h} />;
    case "toilet": return <Toilet w={w} d={d} h={h} />;
    case "sink": return <Sink w={w} d={d} h={h} />;
    case "bath": return <Bath w={w} d={d} h={h} />;
    case "fridge": return <Fridge w={w} d={d} h={h} />;
    case "stove": return <Stove w={w} d={d} h={h} />;
    case "plant": return <Plant w={w} d={d} h={h} />;
    case "rug": return <Rug w={w} d={d} />;
    default: return (
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c9b89a" />
      </mesh>
    );
  }
}

/* ---------------- Individual pieces ---------------- */

function Bed({ w, d, h }: { w: number; d: number; h: number }) {
  const frameH = h * 0.35;
  const mattressH = h * 0.4;
  const headH = h * 1.6;
  return (
    <group>
      {/* frame */}
      <mesh position={[0, frameH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, frameH, d]} />
        <meshStandardMaterial color="#6b5842" roughness={0.8} />
      </mesh>
      {/* mattress */}
      <mesh position={[0, frameH + mattressH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.96, mattressH, d * 0.96]} />
        <meshStandardMaterial color="#f4ede0" roughness={0.85} />
      </mesh>
      {/* duvet */}
      <mesh position={[0, frameH + mattressH * 0.95, d * 0.05]} castShadow>
        <boxGeometry args={[w * 0.94, mattressH * 0.35, d * 0.6]} />
        <meshStandardMaterial color="#d9c7a3" roughness={0.9} />
      </mesh>
      {/* pillows */}
      <mesh position={[-w * 0.22, frameH + mattressH + 0.02, -d * 0.32]} castShadow>
        <boxGeometry args={[w * 0.38, mattressH * 0.4, d * 0.18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[w * 0.22, frameH + mattressH + 0.02, -d * 0.32]} castShadow>
        <boxGeometry args={[w * 0.38, mattressH * 0.4, d * 0.18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      {/* headboard */}
      <mesh position={[0, headH / 2, -d / 2 - 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w, headH, 0.04]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Sofa({ w, d, h }: { w: number; d: number; h: number }) {
  const seatH = h * 0.45;
  const backH = h;
  const armH = h * 0.7;
  const armW = w * 0.08;
  return (
    <group>
      {/* base */}
      <mesh position={[0, seatH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, seatH, d]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      {/* cushions */}
      {[-w * 0.28, 0, w * 0.28].map((x, i) => (
        <mesh key={i} position={[x, seatH + h * 0.08, d * 0.05]} castShadow>
          <boxGeometry args={[w * 0.28, h * 0.15, d * 0.75]} />
          <meshStandardMaterial color="#b8a68a" roughness={0.9} />
        </mesh>
      ))}
      {/* back */}
      <mesh position={[0, backH / 2, -d / 2 + d * 0.1]} castShadow receiveShadow>
        <boxGeometry args={[w, backH, d * 0.2]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      {/* arms */}
      <mesh position={[-w / 2 + armW / 2, armH / 2, 0]} castShadow>
        <boxGeometry args={[armW, armH, d]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      <mesh position={[w / 2 - armW / 2, armH / 2, 0]} castShadow>
        <boxGeometry args={[armW, armH, d]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Chair({ w, d, h }: { w: number; d: number; h: number }) {
  const seatY = h * 0.5;
  const seatH = 0.04;
  return (
    <group>
      {/* seat */}
      <mesh position={[0, seatY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, seatH, d * 0.9]} />
        <meshStandardMaterial color="#6b5842" roughness={0.8} />
      </mesh>
      {/* legs */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.42, seatY / 2, sz * d * 0.42]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, seatY, 8]} />
          <meshStandardMaterial color="#3d2f22" roughness={0.7} />
        </mesh>
      ))}
      {/* back */}
      <mesh position={[0, seatY + (h - seatY) / 2, -d * 0.42]} castShadow>
        <boxGeometry args={[w * 0.9, h - seatY, 0.03]} />
        <meshStandardMaterial color="#6b5842" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Table({ w, d, h, legR, color }: { w: number; d: number; h: number; legR: number; color: string }) {
  const topH = 0.04;
  const topY = h - topH / 2;
  return (
    <group>
      <mesh position={[0, topY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, topH, d]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (w / 2 - legR * 2), (h - topH) / 2, sz * (d / 2 - legR * 2)]} castShadow>
          <cylinderGeometry args={[legR, legR, h - topH, 10]} />
          <meshStandardMaterial color="#3d2f22" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <Table w={w} d={d} h={h} legR={0.02} color="#7a5d3a" />
      {/* drawer under one side */}
      <mesh position={[w * 0.32, h * 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.32, h * 0.5, d * 0.9]} />
        <meshStandardMaterial color="#6b5842" roughness={0.75} />
      </mesh>
    </group>
  );
}

function Toilet({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* bowl */}
      <mesh position={[0, h * 0.3, d * 0.1]} castShadow receiveShadow>
        <cylinderGeometry args={[w * 0.4, w * 0.35, h * 0.5, 24]} />
        <meshStandardMaterial color="#f6f6f2" roughness={0.35} />
      </mesh>
      {/* tank */}
      <mesh position={[0, h * 0.7, -d * 0.32]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.8, h * 0.6, d * 0.25]} />
        <meshStandardMaterial color="#f6f6f2" roughness={0.35} />
      </mesh>
      {/* seat */}
      <mesh position={[0, h * 0.56, d * 0.1]} castShadow>
        <cylinderGeometry args={[w * 0.42, w * 0.42, 0.02, 24]} />
        <meshStandardMaterial color="#e8e8e6" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Sink({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* cabinet */}
      <mesh position={[0, h * 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.85, d]} />
        <meshStandardMaterial color="#c9b89a" roughness={0.8} />
      </mesh>
      {/* basin */}
      <mesh position={[0, h * 0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, h * 0.15, d * 0.85]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* faucet */}
      <mesh position={[0, h * 1.02, -d * 0.35]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, h * 0.2, 10]} />
        <meshStandardMaterial color="#aeb2b6" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Bath({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#f6f6f2" roughness={0.35} />
      </mesh>
      {/* interior basin (dark) */}
      <mesh position={[0, h * 0.65, 0]}>
        <boxGeometry args={[w * 0.88, h * 0.5, d * 0.82]} />
        <meshStandardMaterial color="#dfe6ea" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Fridge({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#d5d5d5" metalness={0.4} roughness={0.35} />
      </mesh>
      {/* door split line */}
      <mesh position={[0, h * 0.55, d / 2 + 0.001]}>
        <boxGeometry args={[w * 0.9, 0.005, 0.002]} />
        <meshStandardMaterial color="#7a7a7a" />
      </mesh>
      {/* handle */}
      <mesh position={[w * 0.35, h * 0.45, d / 2 + 0.01]} castShadow>
        <boxGeometry args={[0.02, h * 0.35, 0.03]} />
        <meshStandardMaterial color="#8a8a8a" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Stove({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.85, d]} />
        <meshStandardMaterial color="#b6b6b6" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* cooktop */}
      <mesh position={[0, h * 0.83, 0]} castShadow>
        <boxGeometry args={[w * 0.98, 0.02, d * 0.98]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.25} />
      </mesh>
      {/* burners */}
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.28, h * 0.85, sz * d * 0.28]}>
          <cylinderGeometry args={[w * 0.12, w * 0.12, 0.008, 24]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ w, d, h }: { w: number; d: number; h: number }) {
  const potH = h * 0.3;
  const r = Math.min(w, d) * 0.4;
  return (
    <group>
      <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.9, r * 0.7, potH, 20]} />
        <meshStandardMaterial color="#8a5a3a" roughness={0.85} />
      </mesh>
      <mesh position={[0, potH + (h - potH) / 2, 0]} castShadow>
        <sphereGeometry args={[Math.min(w, d) * 0.5, 16, 12]} />
        <meshStandardMaterial color="#5a7c4f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Rug({ w, d }: { w: number; d: number }) {
  return (
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color="#c9a961" roughness={0.95} />
    </mesh>
  );
}
