import type { FurnitureKind } from "@/lib/editor/types";

/** Small top-down iconic thumbnails per furniture kind (SVG). */
export function FurnitureThumb({ kind, size = 44 }: { kind: FurnitureKind; size?: number }) {
  const s = size;
  const stroke = "#3d2f22";
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 40 40",
    fill: "none",
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "bed":
      return (
        <svg {...common}>
          <rect x="6" y="8" width="28" height="24" rx="1.5" fill="#f4ede0" />
          <rect x="8" y="10" width="24" height="6" rx="1" fill="#ffffff" />
          <path d="M8 22h24" />
          <rect x="9" y="11" width="10" height="4" rx="0.5" fill="#e7dcc7" />
          <rect x="21" y="11" width="10" height="4" rx="0.5" fill="#e7dcc7" />
        </svg>
      );
    case "sofa":
      return (
        <svg {...common}>
          <rect x="4" y="12" width="32" height="20" rx="2" fill="#b8a68a" />
          <rect x="4" y="8" width="32" height="8" rx="2" fill="#a29179" />
          <rect x="4" y="14" width="4" height="16" rx="1" fill="#a29179" />
          <rect x="32" y="14" width="4" height="16" rx="1" fill="#a29179" />
          <path d="M12 18h6M22 18h6" />
        </svg>
      );
    case "chair":
      return (
        <svg {...common}>
          <rect x="10" y="12" width="20" height="20" rx="2" fill="#c9b89a" />
          <rect x="10" y="8" width="20" height="6" rx="1.5" fill="#a89679" />
        </svg>
      );
    case "table":
      return (
        <svg {...common}>
          <rect x="6" y="12" width="28" height="16" rx="1.5" fill="#8b7355" />
          <circle cx="9" cy="15" r="1.2" fill="#3d2f22" />
          <circle cx="31" cy="15" r="1.2" fill="#3d2f22" />
          <circle cx="9" cy="25" r="1.2" fill="#3d2f22" />
          <circle cx="31" cy="25" r="1.2" fill="#3d2f22" />
        </svg>
      );
    case "dining":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="32" height="20" rx="2" fill="#8b7355" />
          <rect x="12" y="4" width="16" height="4" rx="0.8" fill="#c9b89a" />
          <rect x="12" y="32" width="16" height="4" rx="0.8" fill="#c9b89a" />
        </svg>
      );
    case "desk":
      return (
        <svg {...common}>
          <rect x="4" y="14" width="32" height="14" rx="1.5" fill="#7a5d3a" />
          <rect x="26" y="16" width="10" height="10" rx="0.8" fill="#5c4629" />
          <path d="M28 19h6M28 22h6" />
        </svg>
      );
    case "toilet":
      return (
        <svg {...common}>
          <rect x="14" y="6" width="12" height="7" rx="1" fill="#f6f6f2" />
          <ellipse cx="20" cy="24" rx="9" ry="10" fill="#f6f6f2" />
        </svg>
      );
    case "sink":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="32" height="20" rx="2" fill="#c9b89a" />
          <rect x="8" y="14" width="24" height="12" rx="1.5" fill="#ffffff" />
          <circle cx="20" cy="12" r="1" fill="#3d2f22" />
        </svg>
      );
    case "bath":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="32" height="24" rx="3" fill="#f6f6f2" />
          <rect x="8" y="12" width="24" height="16" rx="2" fill="#dfe6ea" />
          <circle cx="10" cy="20" r="0.8" fill="#3d2f22" />
        </svg>
      );
    case "fridge":
      return (
        <svg {...common}>
          <rect x="10" y="4" width="20" height="32" rx="1.5" fill="#d5d5d5" />
          <path d="M10 16h20" />
          <rect x="26" y="8" width="1.6" height="6" rx="0.6" fill="#8a8a8a" />
          <rect x="26" y="20" width="1.6" height="10" rx="0.6" fill="#8a8a8a" />
        </svg>
      );
    case "stove":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="28" height="28" rx="1.5" fill="#b6b6b6" />
          <circle cx="14" cy="14" r="3" fill="#2a2a2a" />
          <circle cx="26" cy="14" r="3" fill="#2a2a2a" />
          <circle cx="14" cy="26" r="3" fill="#2a2a2a" />
          <circle cx="26" cy="26" r="3" fill="#2a2a2a" />
        </svg>
      );
    case "plant":
      return (
        <svg {...common}>
          <circle cx="20" cy="18" r="12" fill="#5a7c4f" />
          <path d="M14 26h12l-2 8h-8z" fill="#8a5a3a" />
          <path d="M20 8v20M14 14l6 4 6-4M14 24l6-4 6 4" stroke="#3d5a2f" />
        </svg>
      );
    case "rug":
      return (
        <svg {...common}>
          <rect x="4" y="8" width="32" height="24" rx="2" fill="#e0d4bc" strokeDasharray="2 2" />
          <rect x="10" y="14" width="20" height="12" rx="1" fill="#c9a961" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="6" y="6" width="28" height="28" rx="2" fill="#c9b89a" />
        </svg>
      );
  }
}
