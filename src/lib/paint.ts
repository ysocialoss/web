import type { CSSProperties } from "react";
import type { PaintDefinition } from "./api";

export function paintGradient(definition: PaintDefinition) {
  const stops = definition.stops
    .map((stop) => `${stop.color} ${Math.round(stop.at * 10000) / 100}%`)
    .join(", ");
  return definition.kind === "linear"
    ? `linear-gradient(${definition.angle}deg, ${stops})`
    : `radial-gradient(${definition.shape}, ${stops})`;
}

/**
 * Clips the gradient to the text. Kept as classes (not inline styles) so forced-colors
 * mode and print can drop the gradient and show plain text instead of invisible text.
 */
export const paintClassName =
  "name-paint bg-clip-text text-transparent [-webkit-box-decoration-break:clone] [box-decoration-break:clone] forced-colors:bg-none forced-colors:text-[CanvasText] print:bg-none print:text-inherit";

type PaintStyle = CSSProperties & { "--paint-gradient": string };

/** Per-paint styles that fill text with a paint; use together with `paintClassName`. */
export function paintStyle(definition: PaintDefinition): PaintStyle {
  return {
    "--paint-gradient": paintGradient(definition),
    // Keep hover lines visible
    textDecorationColor: definition.stops[0]?.color,
  };
}
