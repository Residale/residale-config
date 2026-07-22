import { Rect, Line, Circle, Group } from "react-konva";
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

function Glyph({
  kind,
  w,
  h,
  hw,
  hh,
  stroke,
}: {
  kind: FurnitureKind;
  w: number;
  h: number;
  hw: number;
  hh: number;
  stroke: string;
}) {
  const lw = 1.2;
  switch (kind) {
    case "bed":
    case "bed_single": {
      const headboard = Math.min(h * 0.14, 14);
      const pillowH = Math.min(h * 0.2, 22);
      const single = kind === "bed_single";
      const pillowW = single ? w - 10 : (w - 14) / 2;
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#f4ede0"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={3}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={headboard}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={lw * 0.6}
          />
          {single ? (
            <Rect
              x={-hw + 5}
              y={-hh + headboard + 3}
              width={pillowW}
              height={pillowH}
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={0.8}
              cornerRadius={2}
            />
          ) : (
            <>
              <Rect
                x={-hw + 5}
                y={-hh + headboard + 3}
                width={pillowW}
                height={pillowH}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={0.8}
                cornerRadius={2}
              />
              <Rect
                x={4}
                y={-hh + headboard + 3}
                width={pillowW}
                height={pillowH}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={0.8}
                cornerRadius={2}
              />
            </>
          )}
          <Line
            points={[-hw + 4, hh - h * 0.3, hw - 4, hh - h * 0.3]}
            stroke={stroke}
            strokeWidth={0.6}
            dash={[4, 3]}
          />
        </Group>
      );
    }
    case "nightstand":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#8b7355"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          <Rect
            x={-hw + 3}
            y={-hh + 3}
            width={w - 6}
            height={h * 0.35}
            fill="#6b5842"
            stroke={stroke}
            strokeWidth={0.6}
          />
          <Circle x={0} y={-hh + h * 0.55} radius={1.5} fill={stroke} />
        </Group>
      );
    case "wardrobe": {
      const nDoors = Math.max(2, Math.round(w / 60));
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#6b5842"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          {Array.from({ length: nDoors }).map((_, i) => (
            <Line
              key={i}
              points={[-hw + (w / nDoors) * (i + 1), -hh, -hw + (w / nDoors) * (i + 1), hh]}
              stroke={stroke}
              strokeWidth={0.6}
            />
          ))}
          {Array.from({ length: nDoors }).map((_, i) => (
            <Circle
              key={`h${i}`}
              x={-hw + (w / nDoors) * (i + 0.5)}
              y={hh - 4}
              radius={1}
              fill={stroke}
            />
          ))}
        </Group>
      );
    }
    case "dresser":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#7a5d3a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          {[0, 1, 2].map((i) => (
            <Rect
              key={i}
              x={-hw + 3}
              y={-hh + 3 + (i * (h - 6)) / 3}
              width={w - 6}
              height={(h - 6) / 3 - 1}
              fill="#5c4629"
              stroke={stroke}
              strokeWidth={0.5}
            />
          ))}
        </Group>
      );
    case "sofa": {
      const back = Math.min(h * 0.28, 22);
      const arm = Math.min(w * 0.08, 12);
      const cushions = Math.max(2, Math.round(w / 80));
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#b8a68a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={4}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={back}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.8}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={arm}
            height={h}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.8}
          />
          <Rect
            x={hw - arm}
            y={-hh}
            width={arm}
            height={h}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.8}
          />
          {Array.from({ length: cushions }).map((_, i) => {
            const cw = (w - arm * 2 - 4 * (cushions + 1)) / cushions;
            const x0 = -hw + arm + 4 + i * (cw + 4);
            return (
              <Rect
                key={i}
                x={x0}
                y={-hh + back + 3}
                width={cw}
                height={h - back - 8}
                fill="#c9b89a"
                stroke={stroke}
                strokeWidth={0.6}
                cornerRadius={2}
              />
            );
          })}
        </Group>
      );
    }
    case "sofa_l": {
      // L-shaped: main horizontal + return
      const armT = 10;
      const returnW = Math.min(w * 0.35, 90);
      const returnH = h - armT;
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h * 0.42}
            fill="#b8a68a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={4}
          />
          <Rect
            x={-hw}
            y={-hh + h * 0.42}
            width={returnW}
            height={returnH}
            fill="#b8a68a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={4}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={armT + 2}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.6}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={armT + 2}
            height={h}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.6}
          />
        </Group>
      );
    }
    case "armchair":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#b8a68a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={5}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h * 0.28}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.6}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w * 0.15}
            height={h}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.6}
          />
          <Rect
            x={hw - w * 0.15}
            y={-hh}
            width={w * 0.15}
            height={h}
            fill="#a29179"
            stroke={stroke}
            strokeWidth={0.6}
          />
        </Group>
      );
    case "chair":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#c9b89a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={3}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h * 0.22}
            fill="#a89679"
            stroke={stroke}
            strokeWidth={0.7}
          />
        </Group>
      );
    case "table":
    case "coffee_table":
    case "dining":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#8b7355"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sy], i) => (
            <Circle key={i} x={sx * (hw - 5)} y={sy * (hh - 5)} radius={2} fill="#3d2f22" />
          ))}
        </Group>
      );
    case "desk":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#7a5d3a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          <Rect
            x={hw - w * 0.28 - 3}
            y={-hh + 3}
            width={w * 0.28}
            height={h - 6}
            fill="#5c4629"
            stroke={stroke}
            strokeWidth={0.6}
          />
        </Group>
      );
    case "bookshelf": {
      const cells = Math.max(3, Math.round(w / 40));
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#6b5842"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1}
          />
          {Array.from({ length: cells - 1 }).map((_, i) => (
            <Line
              key={i}
              points={[-hw + (w / cells) * (i + 1), -hh + 2, -hw + (w / cells) * (i + 1), hh - 2]}
              stroke={stroke}
              strokeWidth={0.5}
            />
          ))}
        </Group>
      );
    }
    case "tv_console":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#4a3a2a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          <Line points={[-hw, 0, hw, 0]} stroke={stroke} strokeWidth={0.5} />
        </Group>
      );
    case "tv":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#0a0a0a"
            stroke={stroke}
            strokeWidth={lw}
          />
          <Rect
            x={-hw + 2}
            y={-hh + 2}
            width={w - 4}
            height={h - 4}
            fill="#1e2a35"
            stroke={stroke}
            strokeWidth={0.4}
          />
        </Group>
      );
    case "toilet": {
      const bowlR = Math.min(w, h) * 0.42;
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h * 0.35}
            fill="#f6f6f2"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          <Circle
            x={0}
            y={hh - bowlR}
            radius={bowlR}
            fill="#f6f6f2"
            stroke={stroke}
            strokeWidth={lw}
          />
        </Group>
      );
    }
    case "bidet":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#f6f6f2"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={hw * 0.6}
          />
          <Rect
            x={-hw + 3}
            y={-hh + 3}
            width={w - 6}
            height={h - 6}
            fill="#dfe6ea"
            stroke={stroke}
            strokeWidth={0.5}
            cornerRadius={hw * 0.5}
          />
        </Group>
      );
    case "sink":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#c9b89a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          <Rect
            x={-hw + 5}
            y={-hh + 5}
            width={w - 10}
            height={h - 10}
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={0.8}
            cornerRadius={2}
          />
          {w > 80 && <Line points={[0, -hh + 6, 0, hh - 6]} stroke={stroke} strokeWidth={0.5} />}
          <Circle x={0} y={-hh + 4} radius={1.6} fill="#3d2f22" />
        </Group>
      );
    case "vanity":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#c9b89a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          {w > 100 ? (
            <>
              <Circle
                x={-w * 0.22}
                y={0}
                radius={Math.min(w, h) * 0.16}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={0.8}
              />
              <Circle
                x={w * 0.22}
                y={0}
                radius={Math.min(w, h) * 0.16}
                fill="#ffffff"
                stroke={stroke}
                strokeWidth={0.8}
              />
            </>
          ) : (
            <Circle
              x={0}
              y={0}
              radius={Math.min(w, h) * 0.32}
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={0.8}
            />
          )}
        </Group>
      );
    case "bath":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#f6f6f2"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={8}
          />
          <Rect
            x={-hw + 6}
            y={-hh + 6}
            width={w - 12}
            height={h - 12}
            fill="#dfe6ea"
            stroke={stroke}
            strokeWidth={0.8}
            cornerRadius={5}
          />
          <Circle x={-hw + 8} y={0} radius={1.6} fill="#3d2f22" />
        </Group>
      );
    case "shower":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#dfe6ea"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1}
          />
          <Line points={[-hw, -hh, hw, hh]} stroke={stroke} strokeWidth={0.5} dash={[3, 2]} />
          <Line points={[hw, -hh, -hw, hh]} stroke={stroke} strokeWidth={0.5} dash={[3, 2]} />
          <Circle
            x={hw - 5}
            y={-hh + 5}
            radius={2}
            fill="#8a8a8a"
            stroke={stroke}
            strokeWidth={0.5}
          />
        </Group>
      );
    case "radiator":
    case "towel_rack": {
      const bars = Math.max(4, Math.round(w / 10));
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#e8e8e8"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1}
          />
          {Array.from({ length: bars }).map((_, i) => (
            <Line
              key={i}
              points={[-hw + (w / bars) * (i + 0.5), -hh + 1, -hw + (w / bars) * (i + 0.5), hh - 1]}
              stroke={stroke}
              strokeWidth={0.4}
            />
          ))}
        </Group>
      );
    }
    case "washer":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#e0e0e0"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          <Circle
            x={0}
            y={h * 0.05}
            radius={Math.min(w, h) * 0.32}
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={0.8}
          />
          <Circle
            x={0}
            y={h * 0.05}
            radius={Math.min(w, h) * 0.22}
            fill="#c0d4e0"
            stroke={stroke}
            strokeWidth={0.5}
          />
        </Group>
      );
    case "fridge":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#d5d5d5"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          <Line
            points={[-hw, -hh + h * 0.35, hw, -hh + h * 0.35]}
            stroke={stroke}
            strokeWidth={0.7}
          />
          {w > 80 && <Line points={[0, -hh, 0, hh]} stroke={stroke} strokeWidth={0.7} />}
        </Group>
      );
    case "stove":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#1a1a1a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sy], i) => (
            <Circle
              key={i}
              x={sx * (hw * 0.45)}
              y={sy * (hh * 0.45)}
              radius={Math.min(w, h) * 0.13}
              fill="#3a3a3a"
              stroke="#6a6a6a"
              strokeWidth={0.4}
            />
          ))}
        </Group>
      );
    case "oven":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#2a2a2a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          <Rect
            x={-hw + 4}
            y={-hh + 4}
            width={w - 8}
            height={h * 0.55}
            fill="#1a1a1a"
            stroke={stroke}
            strokeWidth={0.5}
          />
          <Rect x={-hw + 6} y={hh - h * 0.25} width={w - 12} height={4} fill="#6a6a6a" />
        </Group>
      );
    case "microwave":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#2a2a2a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          <Rect
            x={-hw + 3}
            y={-hh + 3}
            width={w * 0.65}
            height={h - 6}
            fill="#1a1a1a"
            stroke={stroke}
            strokeWidth={0.5}
          />
          <Rect
            x={hw - w * 0.28}
            y={-hh + 3}
            width={w * 0.24}
            height={h * 0.5}
            fill="#4a4a4a"
            stroke={stroke}
            strokeWidth={0.4}
          />
        </Group>
      );
    case "hood":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#a0a0a0"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1}
          />
          <Rect
            x={-hw + 4}
            y={-hh + 4}
            width={w - 8}
            height={h - 8}
            fill="transparent"
            stroke={stroke}
            strokeWidth={0.4}
            dash={[3, 2]}
          />
          <Line points={[-hw + 4, 0, hw - 4, 0]} stroke={stroke} strokeWidth={0.4} />
        </Group>
      );
    case "dishwasher":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#d0d0d0"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1.5}
          />
          <Rect
            x={-hw + 3}
            y={-hh + 6}
            width={w - 6}
            height={h - 12}
            fill="#e8e8e8"
            stroke={stroke}
            strokeWidth={0.5}
          />
          <Line points={[-hw + 3, -hh + 4, hw - 3, -hh + 4]} stroke={stroke} strokeWidth={0.5} />
        </Group>
      );
    case "kitchen_island":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#c9b89a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={2}
          />
          <Rect
            x={-hw + 3}
            y={-hh + 3}
            width={w - 6}
            height={h - 6}
            fill="transparent"
            stroke={stroke}
            strokeWidth={0.4}
            dash={[4, 3]}
          />
        </Group>
      );
    case "kitchen_base":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#e8e4dc"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1}
          />
          <Line
            points={[-hw, -hh + h * 0.15, hw, -hh + h * 0.15]}
            stroke={stroke}
            strokeWidth={0.4}
          />
        </Group>
      );
    case "kitchen_upper":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#e8e4dc"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={1}
            dash={[3, 2]}
            opacity={0.85}
          />
        </Group>
      );
    case "plant":
      return (
        <Group>
          <Circle
            x={0}
            y={0}
            radius={Math.min(hw, hh) * 0.95}
            fill="#5a7c4f"
            stroke={stroke}
            strokeWidth={lw}
          />
          <Circle
            x={0}
            y={0}
            radius={Math.min(hw, hh) * 0.45}
            fill="#8a5a3a"
            stroke={stroke}
            strokeWidth={0.6}
          />
        </Group>
      );
    case "rug":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#c9a961"
            stroke={stroke}
            strokeWidth={lw}
            dash={[6, 4]}
            opacity={0.6}
            cornerRadius={2}
          />
          <Rect
            x={-hw + 8}
            y={-hh + 8}
            width={w - 16}
            height={h - 16}
            fill="transparent"
            stroke={stroke}
            strokeWidth={0.6}
            dash={[3, 3]}
          />
        </Group>
      );
    case "staircase": {
      const steps = Math.max(6, Math.round(h / 25));
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#a08a6c"
            stroke={stroke}
            strokeWidth={lw}
          />
          {Array.from({ length: steps }).map((_, i) => (
            <Line
              key={i}
              points={[-hw, -hh + (h / steps) * (i + 1), hw, -hh + (h / steps) * (i + 1)]}
              stroke={stroke}
              strokeWidth={0.6}
            />
          ))}
          <Line points={[0, hh, 0, -hh + 6]} stroke={stroke} strokeWidth={1} />
          <Line points={[-6, -hh + 12, 0, -hh + 6, 6, -hh + 12]} stroke={stroke} strokeWidth={1} />
        </Group>
      );
    }
    case "fireplace":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#c8b89a"
            stroke={stroke}
            strokeWidth={lw}
          />
          <Rect
            x={-hw + w * 0.2}
            y={-hh + h * 0.25}
            width={w * 0.6}
            height={h * 0.65}
            fill="#1a1a1a"
            stroke={stroke}
            strokeWidth={0.5}
          />
          <Line
            points={[-hw + w * 0.28, hh - 3, hw - w * 0.28, hh - 3]}
            stroke="#ffb069"
            strokeWidth={2}
          />
        </Group>
      );
    case "wood_stove":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#1a1a1a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={4}
          />
          <Circle
            x={0}
            y={0}
            radius={Math.min(w, h) * 0.3}
            fill="#ffb069"
            stroke={stroke}
            strokeWidth={0.5}
            opacity={0.85}
          />
        </Group>
      );
    case "bbq":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#2a2a2a"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={hh * 0.4}
          />
          <Rect
            x={-hw + 5}
            y={-hh + 5}
            width={w - 10}
            height={h - 10}
            fill="#3a3a3a"
            stroke={stroke}
            strokeWidth={0.5}
            cornerRadius={hh * 0.3}
          />
          {Array.from({ length: 5 }).map((_, i) => (
            <Line
              key={i}
              points={[-hw + 8, -hh + 8 + (i * (h - 16)) / 4, hw - 8, -hh + 8 + (i * (h - 16)) / 4]}
              stroke="#6a6a6a"
              strokeWidth={0.5}
            />
          ))}
        </Group>
      );
    case "garden_table":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#8a7350"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={4}
          />
          {Array.from({ length: 6 }).map((_, i) => (
            <Line
              key={i}
              points={[-hw + (w / 6) * (i + 0.5), -hh + 3, -hw + (w / 6) * (i + 0.5), hh - 3]}
              stroke={stroke}
              strokeWidth={0.4}
            />
          ))}
        </Group>
      );
    case "garden_chair":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#8b7355"
            stroke={stroke}
            strokeWidth={lw}
            cornerRadius={3}
          />
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h * 0.22}
            fill="#6b5842"
            stroke={stroke}
            strokeWidth={0.6}
          />
        </Group>
      );
    case "parasol":
      return (
        <Group>
          <Circle
            x={0}
            y={0}
            radius={Math.min(hw, hh)}
            fill="#c9b89a"
            stroke={stroke}
            strokeWidth={lw}
            opacity={0.7}
          />
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Line
                key={deg}
                points={[0, 0, Math.cos(rad) * Math.min(hw, hh), Math.sin(rad) * Math.min(hw, hh)]}
                stroke={stroke}
                strokeWidth={0.6}
              />
            );
          })}
          <Circle x={0} y={0} radius={3} fill={stroke} />
        </Group>
      );
    case "pool":
      return (
        <Group>
          <Rect
            x={-hw}
            y={-hh}
            width={w}
            height={h}
            fill="#6ec2e0"
            stroke={stroke}
            strokeWidth={lw * 1.5}
            cornerRadius={8}
          />
          <Rect
            x={-hw + 8}
            y={-hh + 8}
            width={w - 16}
            height={h - 16}
            fill="transparent"
            stroke="#ffffff"
            strokeWidth={0.6}
            dash={[6, 4]}
            cornerRadius={5}
          />
        </Group>
      );
    default:
      return (
        <Rect
          x={-hw}
          y={-hh}
          width={w}
          height={h}
          fill="#c9b89a"
          stroke={stroke}
          strokeWidth={lw}
          cornerRadius={2}
        />
      );
  }
}
