import type { CSSProperties } from "react";
import type { PaintDefinition } from "./api";

/**
 * builds css from pain definition instruction
 */
export function paintGradient(definition: PaintDefinition) {
  const stops = definition.stops
    .map((stop) => `${stop.color} ${Math.round(stop.at * 10000) / 100}%`)
    .join(", ");
  return definition.kind === "linear"
    ? `linear-gradient(${definition.angle}deg, ${stops})`
    : `radial-gradient(${definition.shape}, ${stops})`;
}

/** Styles that fill text with a paint. */
export function paintStyle(definition: PaintDefinition): CSSProperties {
  return {
    backgroundImage: paintGradient(definition),
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
    // Keep hover lines visiblex
    textDecorationColor: definition.stops[0]!.color,
  };
}
