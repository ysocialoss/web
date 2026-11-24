import { cn } from "@/lib/utils";

/**
 * A blur that is strongest at the chosen edge and fades to nothing at the
 * opposite edge, after Magic UI's ProgressiveBlur: many stacked backdrop
 * blurs of doubling strength, each masked to its own band.
 *
 * The layers render as siblings (a fragment) and are absolutely positioned
 * against the nearest positioned ancestor; nest them inside another stacking
 * element and Chromium stops blurring the page behind them.
 */
export function ProgressiveBlur({
  height,
  blurLevels = [0.5, 1, 2, 4, 8, 14, 22, 32],
  edge = "top",
  enabled = true,
  className,
}: {
  /** Any CSS length. The blur never extends past it. */
  height: string;
  blurLevels?: number[];
  edge?: "top" | "bottom";
  enabled?: boolean;
  className?: string;
}) {
  const count = blurLevels.length;
  const step = 100 / count;
  return (
    <>
      {blurLevels.map((blur, index) => {
        // The mask runs from the weak edge to the strong edge.
        const from = index * step;
        const stops =
          index === count - 1
            ? `rgba(0,0,0,0) ${from}%, rgba(0,0,0,1) 100%`
            : `rgba(0,0,0,0) ${from}%, rgba(0,0,0,1) ${from + step}%, rgba(0,0,0,1) ${from + step * 2}%, rgba(0,0,0,0) ${from + step * 3}%`;
        const mask = `linear-gradient(to ${edge}, ${stops})`;
        const filter = enabled ? `blur(${blur}px)` : "none";
        return (
          <div
            key={blur}
            aria-hidden="true"
            data-slot="progressive-blur"
            data-edge={edge}
            className={cn(
              "pointer-events-none absolute inset-x-0 select-none",
              edge === "top" ? "top-0" : "bottom-0",
              className,
            )}
            style={{
              height,
              backdropFilter: filter,
              WebkitBackdropFilter: filter,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
    </>
  );
}
