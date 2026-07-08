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
    case "bed":
    case "bed_single": return <Bed w={w} d={d} h={h} />;
    case "nightstand": return <BoxUnit w={w} d={d} h={h} color="#8b7355" drawers={2} />;
    case "wardrobe": return <Wardrobe w={w} d={d} h={h} />;
    case "dresser": return <BoxUnit w={w} d={d} h={h} color="#7a5d3a" drawers={3} />;
    case "sofa": return <Sofa w={w} d={d} h={h} />;
    case "sofa_l": return <SofaL w={w} d={d} h={h} />;
    case "armchair": return <Armchair w={w} d={d} h={h} />;
    case "chair": return <Chair w={w} d={d} h={h} />;
    case "table": case "coffee_table": return <Table w={w} d={d} h={h} legR={0.02} color="#8b6f47" />;
    case "dining": return <Table w={w} d={d} h={h} legR={0.025} color="#7a5d3a" />;
    case "desk": return <Desk w={w} d={d} h={h} />;
    case "bookshelf": return <Bookshelf w={w} d={d} h={h} />;
    case "tv_console": return <BoxUnit w={w} d={d} h={h} color="#4a3a2a" drawers={0} shelves />;
    case "tv": return <TV w={w} d={d} h={h} />;
    case "toilet": return <Toilet w={w} d={d} h={h} />;
    case "bidet": return <Bidet w={w} d={d} h={h} />;
    case "sink": return <Sink w={w} d={d} h={h} />;
    case "vanity": return <Vanity w={w} d={d} h={h} />;
    case "bath": return <Bath w={w} d={d} h={h} />;
    case "shower": return <Shower w={w} d={d} h={h} />;
    case "radiator": case "towel_rack": return <Radiator w={w} d={d} h={h} />;
    case "washer": return <Washer w={w} d={d} h={h} />;
    case "fridge": return <Fridge w={w} d={d} h={h} />;
    case "stove": return <Stove w={w} d={d} h={h} />;
    case "oven": return <Oven w={w} d={d} h={h} />;
    case "microwave": return <Microwave w={w} d={d} h={h} />;
    case "hood": return <Hood w={w} d={d} h={h} />;
    case "dishwasher": return <Dishwasher w={w} d={d} h={h} />;
    case "kitchen_island": return <KitchenIsland w={w} d={d} h={h} />;
    case "kitchen_base": return <KitchenBase w={w} d={d} h={h} />;
    case "kitchen_upper": return <KitchenUpper w={w} d={d} h={h} />;
    case "plant": return <Plant w={w} d={d} h={h} />;
    case "rug": return <Rug w={w} d={d} />;
    case "staircase": return <Staircase w={w} d={d} h={h} />;
    case "fireplace": return <Fireplace w={w} d={d} h={h} />;
    case "wood_stove": return <WoodStove w={w} d={d} h={h} />;
    case "bbq": return <BBQ w={w} d={d} h={h} />;
    case "garden_table": return <Table w={w} d={d} h={h} legR={0.022} color="#8a7350" />;
    case "garden_chair": return <Chair w={w} d={d} h={h} />;
    case "parasol": return <Parasol w={w} d={d} h={h} />;
    case "pool": return <Pool w={w} d={d} h={h} />;
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
      <mesh position={[0, frameH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, frameH, d]} />
        <meshStandardMaterial color="#6b5842" roughness={0.8} />
      </mesh>
      <mesh position={[0, frameH + mattressH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.96, mattressH, d * 0.96]} />
        <meshStandardMaterial color="#f4ede0" roughness={0.85} />
      </mesh>
      <mesh position={[0, frameH + mattressH * 0.95, d * 0.05]} castShadow>
        <boxGeometry args={[w * 0.94, mattressH * 0.35, d * 0.6]} />
        <meshStandardMaterial color="#d9c7a3" roughness={0.9} />
      </mesh>
      {w > 1.1 ? (
        <>
          <mesh position={[-w * 0.22, frameH + mattressH + 0.02, -d * 0.32]} castShadow>
            <boxGeometry args={[w * 0.38, mattressH * 0.4, d * 0.18]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
          <mesh position={[w * 0.22, frameH + mattressH + 0.02, -d * 0.32]} castShadow>
            <boxGeometry args={[w * 0.38, mattressH * 0.4, d * 0.18]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, frameH + mattressH + 0.02, -d * 0.32]} castShadow>
          <boxGeometry args={[w * 0.7, mattressH * 0.4, d * 0.18]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
      )}
      <mesh position={[0, headH / 2, -d / 2 - 0.02]} castShadow receiveShadow>
        <boxGeometry args={[w, headH, 0.04]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function BoxUnit({ w, d, h, color, drawers, shelves }: { w: number; d: number; h: number; color: string; drawers: number; shelves?: boolean }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {Array.from({ length: drawers }).map((_, i) => (
        <mesh key={i} position={[0, h * ((i + 0.5) / drawers), d / 2 + 0.001]}>
          <boxGeometry args={[w * 0.9, (h / drawers) * 0.75, 0.005]} />
          <meshStandardMaterial color="#3a2a1a" />
        </mesh>
      ))}
      {shelves && (
        <>
          <mesh position={[0, h * 0.5, 0]}><boxGeometry args={[w * 0.95, 0.01, d * 0.9]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
        </>
      )}
    </group>
  );
}

function Wardrobe({ w, d, h }: { w: number; d: number; h: number }) {
  const doors = Math.max(2, Math.round(w / 0.6));
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#6b5842" roughness={0.8} />
      </mesh>
      {Array.from({ length: doors - 1 }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + (w / doors) * (i + 1), h / 2, d / 2 + 0.001]}>
          <boxGeometry args={[0.008, h * 0.98, 0.006]} />
          <meshStandardMaterial color="#3a2a1a" />
        </mesh>
      ))}
      {Array.from({ length: doors }).map((_, i) => (
        <mesh key={`h${i}`} position={[-w / 2 + (w / doors) * (i + 0.5), h * 0.5, d / 2 + 0.01]} castShadow>
          <boxGeometry args={[0.015, 0.08, 0.02]} />
          <meshStandardMaterial color="#c8b89a" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Sofa({ w, d, h }: { w: number; d: number; h: number }) {
  const seatH = h * 0.45;
  const backH = h;
  const armH = h * 0.7;
  const armW = w * 0.08;
  const cushions = Math.max(2, Math.round(w / 0.8));
  return (
    <group>
      <mesh position={[0, seatH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, seatH, d]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      {Array.from({ length: cushions }).map((_, i) => {
        const cw = (w - armW * 2 - 0.02) / cushions;
        const x = -w / 2 + armW + cw * (i + 0.5);
        return (
          <mesh key={i} position={[x, seatH + h * 0.08, d * 0.05]} castShadow>
            <boxGeometry args={[cw * 0.92, h * 0.15, d * 0.75]} />
            <meshStandardMaterial color="#b8a68a" roughness={0.9} />
          </mesh>
        );
      })}
      <mesh position={[0, backH / 2, -d / 2 + d * 0.1]} castShadow receiveShadow>
        <boxGeometry args={[w, backH, d * 0.2]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
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

function SofaL({ w, d, h }: { w: number; d: number; h: number }) {
  const seatH = h * 0.45;
  const returnD = Math.min(w * 0.35, 0.9);
  const shortH = d * 0.42;
  return (
    <group>
      {/* main horizontal bench */}
      <mesh position={[0, seatH / 2, -d / 2 + shortH / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, seatH, shortH]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      {/* return leg */}
      <mesh position={[-w / 2 + returnD / 2, seatH / 2, shortH / 2]} castShadow receiveShadow>
        <boxGeometry args={[returnD, seatH, d - shortH]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      {/* back main */}
      <mesh position={[0, h * 0.7, -d / 2 + 0.05]} castShadow>
        <boxGeometry args={[w, h * 0.6, 0.1]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
      {/* back return */}
      <mesh position={[-w / 2 + 0.05, h * 0.7, shortH / 2]} castShadow>
        <boxGeometry args={[0.1, h * 0.6, d - shortH]} />
        <meshStandardMaterial color="#8b7a5f" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Armchair({ w, d, h }: { w: number; d: number; h: number }) {
  return <Sofa w={w} d={d} h={h} />;
}

function Chair({ w, d, h }: { w: number; d: number; h: number }) {
  const seatY = h * 0.5;
  const seatH = 0.04;
  return (
    <group>
      <mesh position={[0, seatY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.9, seatH, d * 0.9]} />
        <meshStandardMaterial color="#6b5842" roughness={0.8} />
      </mesh>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.42, seatY / 2, sz * d * 0.42]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, seatY, 8]} />
          <meshStandardMaterial color="#3d2f22" roughness={0.7} />
        </mesh>
      ))}
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
      <mesh position={[w * 0.32, h * 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.32, h * 0.5, d * 0.9]} />
        <meshStandardMaterial color="#6b5842" roughness={0.75} />
      </mesh>
    </group>
  );
}

function Bookshelf({ w, d, h }: { w: number; d: number; h: number }) {
  const shelves = Math.max(4, Math.round(h / 0.4));
  return (
    <group>
      <mesh position={[0, h / 2, -d / 2 + 0.005]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.01]} />
        <meshStandardMaterial color="#4a3a22" />
      </mesh>
      <mesh position={[-w / 2 + 0.01, h / 2, 0]} castShadow><boxGeometry args={[0.02, h, d]} /><meshStandardMaterial color="#6b5842" /></mesh>
      <mesh position={[w / 2 - 0.01, h / 2, 0]} castShadow><boxGeometry args={[0.02, h, d]} /><meshStandardMaterial color="#6b5842" /></mesh>
      {Array.from({ length: shelves + 1 }).map((_, i) => (
        <mesh key={i} position={[0, (h / shelves) * i, 0]} castShadow>
          <boxGeometry args={[w, 0.015, d]} />
          <meshStandardMaterial color="#6b5842" />
        </mesh>
      ))}
      {/* random books */}
      {Array.from({ length: shelves }).map((_, r) =>
        Array.from({ length: Math.floor(w / 0.05) }).map((_, c) => {
          const colors = ["#8b3a3a", "#3a5a8b", "#3a8b5a", "#8b6b3a", "#5a3a8b"];
          const bh = 0.25 + ((r * 7 + c * 13) % 10) * 0.01;
          return (
            <mesh key={`${r}-${c}`} position={[-w / 2 + 0.04 + c * 0.05, (h / shelves) * r + bh / 2 + 0.01, 0]}>
              <boxGeometry args={[0.035, bh, d * 0.55]} />
              <meshStandardMaterial color={colors[(r + c) % colors.length]} roughness={0.9} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

function TV({ w, d, h }: { w: number; d: number; h: number }) {
  const y = 1.05; // wall-mounted around 105cm from floor if not on console
  return (
    <group>
      <mesh position={[0, y + h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, Math.max(d, 0.04)]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.4} />
      </mesh>
      <mesh position={[0, y + h / 2, 0.021]}>
        <boxGeometry args={[w * 0.96, h * 0.92, 0.005]} />
        <meshStandardMaterial color="#1a2a3a" emissive="#0a1a2a" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Toilet({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.25, d * 0.1]} castShadow receiveShadow>
        <cylinderGeometry args={[w * 0.4, w * 0.35, h * 0.5, 24]} />
        <meshStandardMaterial color="#f6f6f2" roughness={0.35} />
      </mesh>
      <mesh position={[0, h * 0.62, -d * 0.32]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.8, h * 0.6, d * 0.25]} />
        <meshStandardMaterial color="#f6f6f2" roughness={0.35} />
      </mesh>
      <mesh position={[0, h * 0.52, d * 0.1]} castShadow>
        <cylinderGeometry args={[w * 0.42, w * 0.42, 0.02, 24]} />
        <meshStandardMaterial color="#e8e8e6" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Bidet({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#f6f6f2" roughness={0.35} />
      </mesh>
      <mesh position={[0, h * 0.7, 0]}>
        <boxGeometry args={[w * 0.85, h * 0.35, d * 0.85]} />
        <meshStandardMaterial color="#dfe6ea" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Sink({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c9b89a" roughness={0.8} />
      </mesh>
      <mesh position={[0, h * 0.93, 0]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.95, 0.02, d * 0.95]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.3} />
      </mesh>
      {/* basin */}
      <mesh position={[0, h * 0.9, 0]}>
        <boxGeometry args={[w * 0.85, 0.08, d * 0.75]} />
        <meshStandardMaterial color="#c8d0d5" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* faucet */}
      <mesh position={[0, h * 1.05, -d * 0.35]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, h * 0.2, 10]} />
        <meshStandardMaterial color="#aeb2b6" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Vanity({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c9b89a" roughness={0.8} />
      </mesh>
      <mesh position={[0, h * 1.005, 0]} castShadow>
        <boxGeometry args={[w, 0.02, d]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.4} />
      </mesh>
      {w > 1.0 ? (
        <>
          <mesh position={[-w * 0.22, h * 1.02, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.14, Math.min(w, d) * 0.16, 0.06, 20]} />
            <meshStandardMaterial color="#ffffff" roughness={0.25} />
          </mesh>
          <mesh position={[w * 0.22, h * 1.02, 0]}>
            <cylinderGeometry args={[Math.min(w, d) * 0.14, Math.min(w, d) * 0.16, 0.06, 20]} />
            <meshStandardMaterial color="#ffffff" roughness={0.25} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, h * 1.02, 0]}>
          <cylinderGeometry args={[Math.min(w, d) * 0.28, Math.min(w, d) * 0.3, 0.06, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.25} />
        </mesh>
      )}
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
      <mesh position={[0, h * 0.7, 0]}>
        <boxGeometry args={[w * 0.88, h * 0.55, d * 0.82]} />
        <meshStandardMaterial color="#dfe6ea" roughness={0.4} />
      </mesh>
    </group>
  );
}

function Shower({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      {/* base */}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.06, d]} />
        <meshStandardMaterial color="#dfe6ea" roughness={0.5} />
      </mesh>
      {/* glass panels */}
      <mesh position={[0, h / 2, d / 2 - 0.005]}>
        <boxGeometry args={[w, h, 0.008]} />
        <meshStandardMaterial color="#a0c8d8" transparent opacity={0.35} roughness={0.1} metalness={0.05} />
      </mesh>
      <mesh position={[w / 2 - 0.005, h / 2, 0]}>
        <boxGeometry args={[0.008, h, d]} />
        <meshStandardMaterial color="#a0c8d8" transparent opacity={0.35} roughness={0.1} metalness={0.05} />
      </mesh>
      {/* shower head */}
      <mesh position={[-w * 0.35, h * 0.9, -d * 0.4]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.015, 16]} />
        <meshStandardMaterial color="#c0c4c8" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

function Radiator({ w, d, h }: { w: number; d: number; h: number }) {
  const fins = Math.max(6, Math.round(w / 0.06));
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.4} />
      </mesh>
      {Array.from({ length: fins }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + (w / fins) * (i + 0.5), h / 2, d / 2 + 0.001]}>
          <boxGeometry args={[0.008, h * 0.92, 0.005]} />
          <meshStandardMaterial color="#c0c0c0" />
        </mesh>
      ))}
    </group>
  );
}

function Washer({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh position={[0, h * 0.45, d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(w, h) * 0.28, Math.min(w, h) * 0.28, 0.02, 24]} />
        <meshStandardMaterial color="#404040" roughness={0.4} />
      </mesh>
      <mesh position={[0, h * 0.45, d / 2 + 0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(w, h) * 0.22, Math.min(w, h) * 0.22, 0.02, 24]} />
        <meshStandardMaterial color="#a0c0d0" transparent opacity={0.5} />
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
      <mesh position={[0, h * 0.55, d / 2 + 0.001]}>
        <boxGeometry args={[w * 0.9, 0.005, 0.002]} />
        <meshStandardMaterial color="#7a7a7a" />
      </mesh>
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
      <mesh position={[0, h * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.7} />
      </mesh>
      {/* cooktop */}
      <mesh position={[0, h + 0.005, 0]} castShadow>
        <boxGeometry args={[w, 0.015, d]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.25} />
      </mesh>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * w * 0.28, h + 0.014, sz * d * 0.28]}>
          <cylinderGeometry args={[Math.min(w, d) * 0.11, Math.min(w, d) * 0.11, 0.005, 24]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Oven({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, h * 0.4, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.9, h * 0.55, 0.005]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, h * 0.4, d / 2 + 0.005]}>
        <boxGeometry args={[w * 0.85, h * 0.5, 0.003]} />
        <meshStandardMaterial color="#3a3a4a" emissive="#3a2a10" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, h * 0.85, d / 2 + 0.003]}>
        <boxGeometry args={[w * 0.85, 0.03, 0.006]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} />
      </mesh>
    </group>
  );
}

function Microwave({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[-w * 0.15, h / 2, d / 2 + 0.001]}>
        <boxGeometry args={[w * 0.65, h * 0.85, 0.005]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[w * 0.3, h / 2, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.28, h * 0.5, 0.005]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
    </group>
  );
}

function Hood({ w, d, h }: { w: number; d: number; h: number }) {
  const y0 = 1.5; // typical mount height
  return (
    <group>
      <mesh position={[0, y0 + h * 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.3, d]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* chimney */}
      <mesh position={[0, y0 + h * 0.6, -d * 0.3]} castShadow>
        <boxGeometry args={[w * 0.4, h * 0.7, d * 0.35]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Dishwasher({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, h * 0.94, d / 2 + 0.002]}>
        <boxGeometry args={[w * 0.9, h * 0.06, 0.005]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
    </group>
  );
}

function KitchenIsland({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.7} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]} castShadow>
        <boxGeometry args={[w * 1.02, 0.04, d * 1.02]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.4} />
      </mesh>
    </group>
  );
}

function KitchenBase({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.7} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]} castShadow>
        <boxGeometry args={[w * 1.02, 0.04, d * 1.02]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.4} />
      </mesh>
    </group>
  );
}

function KitchenUpper({ w, d, h }: { w: number; d: number; h: number }) {
  const y0 = 1.4;
  return (
    <mesh position={[0, y0 + h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#e8e4dc" roughness={0.7} />
    </mesh>
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

function Staircase({ w, d, h }: { w: number; d: number; h: number }) {
  const steps = Math.max(6, Math.round(h / 0.2));
  const stepD = d / steps;
  const stepH = h / steps;
  return (
    <group>
      {Array.from({ length: steps }).map((_, i) => (
        <mesh key={i} position={[0, stepH * (i + 0.5), -d / 2 + stepD * (i + 0.5)]} castShadow receiveShadow>
          <boxGeometry args={[w, stepH, stepD]} />
          <meshStandardMaterial color="#a08a6c" roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Fireplace({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#c8b89a" roughness={0.85} />
      </mesh>
      <mesh position={[0, h * 0.32, d / 2 - 0.05]}>
        <boxGeometry args={[w * 0.55, h * 0.45, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      {/* mantle */}
      <mesh position={[0, h * 0.6, d / 2 + 0.02]} castShadow>
        <boxGeometry args={[w * 1.05, 0.05, d * 0.4]} />
        <meshStandardMaterial color="#8b6f47" roughness={0.7} />
      </mesh>
    </group>
  );
}

function WoodStove({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[Math.min(w, d) / 2, Math.min(w, d) / 2, h * 0.75, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, h * 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, h * 0.3, 20]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

function BBQ({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, h * 0.35, 0]} castShadow>
        <boxGeometry args={[w * 0.8, 0.05, d * 0.8]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.5} />
      </mesh>
      <mesh position={[0, h * 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.5, d]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.5} metalness={0.4} />
      </mesh>
      {[-1, 0, 1].map((s) => (
        <mesh key={s} position={[s * w * 0.3, h * 0.15, d * 0.3]}>
          <cylinderGeometry args={[0.02, 0.02, h * 0.3, 10]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
      ))}
    </group>
  );
}

function Parasol({ w, d, h }: { w: number; d: number; h: number }) {
  const r = Math.min(w, d) / 2;
  return (
    <group>
      <mesh position={[0, h * 0.5, 0]}>
        <cylinderGeometry args={[0.025, 0.025, h, 12]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>
      <mesh position={[0, h * 0.9, 0]} castShadow>
        <coneGeometry args={[r, h * 0.2, 24]} />
        <meshStandardMaterial color="#c9b89a" roughness={0.9} side={2} />
      </mesh>
    </group>
  );
}

function Pool({ w, d, h }: { w: number; d: number; h: number }) {
  return (
    <group>
      <mesh position={[0, -h / 2, 0]} receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#dfe6ea" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[w * 0.98, 0.02, d * 0.98]} />
        <meshStandardMaterial color="#6ec2e0" transparent opacity={0.75} roughness={0.15} />
      </mesh>
    </group>
  );
}
