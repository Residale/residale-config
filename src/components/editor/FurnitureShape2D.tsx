import { Rect, Line, Circle, Group, Path } from "react-konva";
import type { Furniture, FurnitureKind } from "@/lib/editor/types";

type Props = { f: Furniture; strokeColor: string };

/** Top-down 2D iconic drawing of a furniture item. Rendered in local space,
 *  centered at (0,0), respecting f.width × f.height. */
export function FurnitureShape2D({ f, strokeColor }: Props) {
  const w = f.width;
  const h = f.height;
  const hw = w / 2;
  const hh = h / 2;
  return <Glyph kind={f.kind} w={w} h={h} hw={hw} hh={hh} stroke={strokeColor} />;
}

function Glyph({ kind, w, h, hw, hh, stroke }: { kind: FurnitureKind; w: number; h: number; hw: number; hh: number; stroke: string }) {
  const lw = 1.2;
  switch (kind) {
    case "bed": {
      const headboard = Math.min(h * 0.18, 15);
      const pillowH = Math.min(h * 0.22, 25);
      const pillowW = (w - 12) / 2;
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#f4ede0" stroke={stroke} strokeWidth={lw} cornerRadius={3} />
          <Rect x={-hw} y={-hh} width={w} height={headboard} fill="#a29179" stroke={stroke} strokeWidth={lw * 0.6} />
          <Rect x={-hw + 4} y={-hh + headboard + 3} width={pillowW} height={pillowH} fill="#ffffff" stroke={stroke} strokeWidth={0.8} cornerRadius={2} />
          <Rect x={4} y={-hh + headboard + 3} width={pillowW} height={pillowH} fill="#ffffff" stroke={stroke} strokeWidth={0.8} cornerRadius={2} />
          <Line points={[-hw, hh - h * 0.35, hw, hh - h * 0.35]} stroke={stroke} strokeWidth={0.6} dash={[4, 3]} />
        </Group>
      );
    }
    case "sofa": {
      const back = Math.min(h * 0.28, 22);
      const arm = Math.min(w * 0.08, 12);
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#b8a68a" stroke={stroke} strokeWidth={lw} cornerRadius={4} />
          <Rect x={-hw} y={-hh} width={w} height={back} fill="#a29179" stroke={stroke} strokeWidth={0.8} />
          <Rect x={-hw} y={-hh} width={arm} height={h} fill="#a29179" stroke={stroke} strokeWidth={0.8} />
          <Rect x={hw - arm} y={-hh} width={arm} height={h} fill="#a29179" stroke={stroke} strokeWidth={0.8} />
          {[0, 1, 2].map((i) => {
            const cw = (w - arm * 2 - 8) / 3;
            const x0 = -hw + arm + 4 + i * cw;
            return <Rect key={i} x={x0} y={-hh + back + 3} width={cw - 2} height={h - back - 8} fill="#c9b89a" stroke={stroke} strokeWidth={0.6} cornerRadius={2} />;
          })}
        </Group>
      );
    }
    case "chair":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#c9b89a" stroke={stroke} strokeWidth={lw} cornerRadius={3} />
          <Rect x={-hw} y={-hh} width={w} height={h * 0.22} fill="#a89679" stroke={stroke} strokeWidth={0.7} />
        </Group>
      );
    case "table":
    case "dining":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#8b7355" stroke={stroke} strokeWidth={lw} cornerRadius={2} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
            <Circle key={i} x={sx * (hw - 5)} y={sy * (hh - 5)} radius={2} fill="#3d2f22" />
          ))}
        </Group>
      );
    case "desk":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#7a5d3a" stroke={stroke} strokeWidth={lw} cornerRadius={2} />
          <Rect x={hw - w * 0.3 - 3} y={-hh + 3} width={w * 0.3} height={h - 6} fill="#5c4629" stroke={stroke} strokeWidth={0.6} />
        </Group>
      );
    case "toilet": {
      // bowl (ellipse via circle) + tank
      const bowlR = Math.min(w, h) * 0.42;
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h * 0.35} fill="#f6f6f2" stroke={stroke} strokeWidth={lw} cornerRadius={1.5} />
          <Circle x={0} y={hh - bowlR} radius={bowlR} fill="#f6f6f2" stroke={stroke} strokeWidth={lw} />
        </Group>
      );
    }
    case "sink":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#c9b89a" stroke={stroke} strokeWidth={lw} cornerRadius={2} />
          <Rect x={-hw + 5} y={-hh + 5} width={w - 10} height={h - 10} fill="#ffffff" stroke={stroke} strokeWidth={0.8} cornerRadius={2} />
          <Circle x={0} y={-hh + 4} radius={1.6} fill="#3d2f22" />
        </Group>
      );
    case "bath":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#f6f6f2" stroke={stroke} strokeWidth={lw} cornerRadius={8} />
          <Rect x={-hw + 6} y={-hh + 6} width={w - 12} height={h - 12} fill="#dfe6ea" stroke={stroke} strokeWidth={0.8} cornerRadius={5} />
          <Circle x={-hw + 8} y={0} radius={1.6} fill="#3d2f22" />
        </Group>
      );
    case "fridge":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#d5d5d5" stroke={stroke} strokeWidth={lw} cornerRadius={1.5} />
          <Line points={[-hw, -hh + h * 0.35, hw, -hh + h * 0.35]} stroke={stroke} strokeWidth={0.7} />
          <Rect x={hw - 4} y={-hh + h * 0.15} width={1.5} height={5} fill="#8a8a8a" />
          <Rect x={hw - 4} y={-hh + h * 0.5} width={1.5} height={8} fill="#8a8a8a" />
        </Group>
      );
    case "stove":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#b6b6b6" stroke={stroke} strokeWidth={lw} cornerRadius={1.5} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
            <Circle key={i} x={sx * (hw * 0.45)} y={sy * (hh * 0.45)} radius={Math.min(w, h) * 0.13} fill="#2a2a2a" />
          ))}
        </Group>
      );
    case "plant":
      return (
        <Group>
          <Circle x={0} y={0} radius={Math.min(hw, hh) * 0.95} fill="#5a7c4f" stroke={stroke} strokeWidth={lw} />
          <Circle x={0} y={0} radius={Math.min(hw, hh) * 0.45} fill="#8a5a3a" stroke={stroke} strokeWidth={0.6} />
        </Group>
      );
    case "rug":
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#c9a961" stroke={stroke} strokeWidth={lw} dash={[6, 4]} opacity={0.6} cornerRadius={2} />
          <Rect x={-hw + 8} y={-hh + 8} width={w - 16} height={h - 16} fill="transparent" stroke={stroke} strokeWidth={0.6} dash={[3, 3]} />
        </Group>
      );
    default:
      return <Rect x={-hw} y={-hh} width={w} height={h} fill="#c9b89a" stroke={stroke} strokeWidth={lw} cornerRadius={2} />;
  }
}
