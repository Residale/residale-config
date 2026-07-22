/**
 * UI chrome colors for canvas renderers (Konva / three.js), which need concrete
 * color strings and cannot consume Tailwind token classes. Values mirror the
 * accent tokens in styles.css — change both together.
 */
export const ACCENT = "#0f766e"; // hsl(175 77% 26%) — --accent (light)
export const ACCENT_CONTRAST = "#ffffff";
export const HANDLE_FILL = "#ffffff";
export const HANDLE_STROKE = ACCENT;

/** Accent fill with alpha, for selection zones / marquee fills. */
export function accentAlpha(alpha: number): string {
  return `rgba(15, 118, 110, ${alpha})`;
}
