import { useContext, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ViewerIdContext } from "@/lib/viewer";
import { useCelebrations } from "@/lib/celebrations";
import { useRewards } from "./advent-store";

export const EVE_DAY = 24;
export const EVE_DOORS = EVE_DAY - 1;

export type EveStar = { year: number; doors: number };
export type EveTierId = "paper" | "tin" | "gold" | "crystal" | "guiding";
export type EveTier = { id: EveTierId; name: string; min: number; accent: string };

export const eveTiers: readonly EveTier[] = [
  { id: "paper", name: "Paper star", min: 0, accent: "#b07f3c" },
  { id: "tin", name: "Tin star", min: 8, accent: "#6f7d8c" },
  { id: "gold", name: "Golden star", min: 15, accent: "#c08a14" },
  { id: "crystal", name: "Crystal star", min: 20, accent: "#3f8fc6" },
  { id: "guiding", name: "Guiding star", min: EVE_DOORS, accent: "#2fa58a" },
];

export function eveTierFor(doors: number): EveTier {
  return eveTiers.findLast((tier) => doors >= tier.min) ?? eveTiers[0];
}

export function eveTierRange(tier: EveTier) {
  const next = eveTiers[eveTiers.indexOf(tier) + 1];
  if (!next) return `All ${EVE_DOORS}`;
  return tier.min === next.min - 1 ? `${tier.min}` : `${tier.min}-${next.min - 1}`;
}

export const eveStarShown = (year: number, since: number) => year >= since;

type Point = readonly [number, number];
const fmt = (point: Point) => `${point[0].toFixed(2)} ${point[1].toFixed(2)}`;
const along = (from: Point, to: Point, t: number): Point => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];

function foldedStar(cx: number, cy: number, radii: readonly number[], inner: number) {
  const step = (Math.PI * 2) / radii.length;
  const at = (radius: number, angle: number): Point => [
    cx + radius * Math.cos(angle - Math.PI / 2),
    cy + radius * Math.sin(angle - Math.PI / 2),
  ];
  const center: Point = [cx, cy];
  const tips = radii.map((radius, index) => at(radius, index * step));
  const valleys = radii.map((_, index) => at(inner, index * step + step / 2));
  const litFacets = tips.map((tip, index) => `M${fmt(center)}L${fmt(valleys.at(index - 1)!)}L${fmt(tip)}Z`);
  const shadeFacets = tips.map((tip, index) => `M${fmt(center)}L${fmt(tip)}L${fmt(valleys[index])}Z`);
  const outline = `M${tips.map((tip, index) => `${fmt(tip)}L${fmt(valleys[index])}`).join("L")}Z`;
  const ridges = tips.map((tip) => `M${fmt(center)}L${fmt(tip)}`).join("");
  const folds = valleys.map((valley) => `M${fmt(center)}L${fmt(valley)}`).join("");
  return { center, tips, valleys, lit: litFacets.join(""), shade: shadeFacets.join(""), litFacets, shadeFacets, outline, ridges, folds };
}

const fivePoint = foldedStar(12, 12.9, [11, 11, 11, 11, 11], 4.7);
const fiveInset = foldedStar(12, 12.9, [6.2, 6.2, 6.2, 6.2, 6.2], 2.65);
const guiding = foldedStar(12, 11, [10.5, 5, 9, 5, 12.5, 5, 9, 5], 2.4);

type Palette = { lit: [string, string]; shade: [string, string]; edge: string; sheen: string };
const palettes: Record<EveTierId, Palette> = {
  paper: { lit: ["#fffaf0", "#f1dfbd"], shade: ["#ebd3a8", "#cfa96e"], edge: "#93703a", sheen: "#fff" },
  tin: { lit: ["#fafcfd", "#d2dae3"], shade: ["#b9c3ce", "#76828f"], edge: "#56616e", sheen: "#fff" },
  gold: { lit: ["#fff3c4", "#ffd257"], shade: ["#eeb041", "#b47410"], edge: "#865705", sheen: "#fff8dc" },
  crystal: { lit: ["#ffffff", "#d8f0ff"], shade: ["#b2ddf7", "#64abdd"], edge: "#3678ab", sheen: "#fff" },
  guiding: { lit: ["#fffef6", "#fbe6a0"], shade: ["#f5d06a", "#d39a23"], edge: "#946509", sheen: "#fff" },
};

const sparks = [
  { x: 1.6, y: 4.2, r: 2.1 },
  { x: 22.4, y: 6.6, r: 1.6 },
  { x: 21, y: 21.6, r: 1.9 },
];
const spark = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

const tinHoles = fivePoint.tips.flatMap((tip) => [along(fivePoint.center, tip, 0.45), along(fivePoint.center, tip, 0.7)]);
const guidingRays = [45, 135, 225, 315].map((degrees) => {
  const angle = (degrees * Math.PI) / 180;
  return `M${fmt(along([12, 11], [12 + Math.sin(angle) * 8.5, 11 - Math.cos(angle) * 8.5], 0.3))}L${fmt([12 + Math.sin(angle) * 8.5, 11 - Math.cos(angle) * 8.5])}`;
}).join("");

export function EveStarArt({ tier, className }: { tier: EveTierId; className?: string }) {
  const id = useId();
  const ref = (name: string) => `${id}-${name}`;
  const url = (name: string) => `url(#${ref(name)})`;
  const shape = tier === "guiding" ? guiding : fivePoint;
  const colors = palettes[tier];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("overflow-visible", className)}>
      <defs>
        <clipPath id={ref("clip")}>
          <path d={shape.outline} />
        </clipPath>
        <linearGradient id={ref("lit")} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors.lit[0]} />
          <stop offset="1" stopColor={colors.lit[1]} />
        </linearGradient>
        <linearGradient id={ref("shade")} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors.shade[0]} />
          <stop offset="1" stopColor={colors.shade[1]} />
        </linearGradient>
        <radialGradient id={ref("gem")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff8a8a" />
          <stop offset="0.55" stopColor="#d8222f" />
          <stop offset="1" stopColor="#7d0b14" />
        </radialGradient>
        <radialGradient id={ref("rivet")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#8f9aa6" />
        </radialGradient>
        <radialGradient id={ref("core")}>
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fff8d8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff2b0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {tier === "paper" && (
        <g stroke={colors.edge} strokeLinecap="round" fill="none">
          <path d="M12 1.9V-1.1" strokeWidth="0.4" />
          <circle cx="12" cy="-1.75" r="0.65" strokeWidth="0.35" />
        </g>
      )}
      {tier === "guiding" && (
        <g fill="none" strokeLinecap="round">
          <circle cx="12" cy="11" r="7.2" stroke="#efcf73" strokeWidth="0.3" strokeOpacity="0.75" />
          <path d={guidingRays} stroke="#e9bf4f" strokeWidth="0.45" />
        </g>
      )}

      <path d={shape.lit} fill={url("lit")} />
      <path d={shape.shade} fill={url("shade")} />

      {tier === "paper" && (
        <g fill="none" strokeLinecap="round">
          <path d={fivePoint.folds} stroke={colors.edge} strokeOpacity="0.35" strokeWidth="0.3" />
          <path d={fivePoint.ridges} stroke="#fff" strokeOpacity="0.8" strokeWidth="0.3" />
        </g>
      )}
      {tier === "tin" && (
        <>
          <path d={fivePoint.ridges} stroke="#fff" strokeOpacity="0.55" strokeWidth="0.3" fill="none" />
          {tinHoles.map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r={index % 2 ? 0.36 : 0.46} fill="#4b5560" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.15" />
          ))}
          <circle cx="12" cy="12.9" r="1.3" fill={url("rivet")} stroke={colors.edge} strokeWidth="0.3" />
        </>
      )}
      {tier === "gold" && (
        <>
          <path d={fiveInset.outline} fill="none" stroke="#fff5cc" strokeOpacity="0.9" strokeWidth="0.4" strokeLinejoin="round" />
          <path d={fivePoint.ridges} stroke="#8a5a06" strokeOpacity="0.25" strokeWidth="0.25" fill="none" />
          <circle cx="12" cy="12.9" r="1.55" fill={url("gem")} stroke="#7a4b04" strokeWidth="0.35" />
          <circle cx="11.5" cy="12.35" r="0.42" fill="#fff" fillOpacity="0.85" />
        </>
      )}
      {tier === "crystal" && (
        <>
          <path d={fivePoint.litFacets[1]} fill="#ffc9e6" fillOpacity="0.45" />
          <path d={fivePoint.shadeFacets[3]} fill="#b6fff0" fillOpacity="0.5" />
          <path d={fivePoint.litFacets[4]} fill="#fff0b3" fillOpacity="0.45" />
          <path d={fiveInset.outline} fill="#fff" fillOpacity="0.3" stroke="#fff" strokeOpacity="0.9" strokeWidth="0.35" strokeLinejoin="round" />
          <path d={`${fivePoint.ridges}${fivePoint.folds}`} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="0.35" />
        </>
      )}

      <g clipPath={url("clip")}>
        <rect className="eve-star-sheen" x="-9" y="-4" width="5" height="32" fill={colors.sheen} transform="rotate(20 12 12)" />
      </g>
      <path d={shape.outline} fill="none" stroke={colors.edge} strokeWidth="0.75" strokeLinejoin="round" />

      {tier === "guiding" && (
        <>
          <path d={guiding.ridges} stroke="#fff" strokeOpacity="0.8" strokeWidth="0.3" fill="none" />
          <circle cx="12" cy="11" r="2.6" fill={url("core")} />
          <circle cx="12" cy="11" r="0.85" fill="#fff" />
        </>
      )}
      {tier === "crystal" &&
        sparks.map((item, index) => (
          <path
            key={index}
            className="eve-star-spark"
            style={{ animationDelay: `${index * 0.28}s` }}
            d={spark(item.x, item.y, item.r)}
            fill="#bfe6ff"
          />
        ))}
    </svg>
  );
}

export function EveStarBadge({
  star,
  lit = false,
  tooltip = true,
  className,
}: {
  star: EveStar;
  lit?: boolean;
  tooltip?: boolean;
  className?: string;
}) {
  const tier = eveTierFor(star.doors);
  const label = `${tier.name}, ${star.doors} of ${EVE_DOORS} advent doors opened in ${star.year}`;
  const body = (
    <>
      <span className="eve-star-glow" aria-hidden="true" />
      <EveStarArt tier={tier.id} />
    </>
  );
  const [hovered, setHovered] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!hovered) return;
    const drop = () => setHovered(null);
    window.addEventListener("scroll", drop, true);
    window.addEventListener("resize", drop);
    return () => {
      window.removeEventListener("scroll", drop, true);
      window.removeEventListener("resize", drop);
    };
  }, [hovered]);
  const props = {
    role: "img",
    "aria-label": label,
    "data-tier": tier.id,
    "data-lit": lit || undefined,
    className: cn("eve-star", className),
  };
  if (!tooltip) return <span {...props}>{body}</span>;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            {...props}
            data-floating={hovered ? "" : undefined}
            onPointerEnter={(event) => setHovered(event.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setHovered(null)}
          />
        }
      >
        {body}
      </TooltipTrigger>
      {hovered &&
        createPortal(
          <span
            aria-hidden="true"
            data-tier={tier.id}
            data-hover=""
            className="eve-star pointer-events-none z-[100]"
            style={{ position: "fixed", left: hovered.left, top: hovered.top, fontSize: hovered.width / 1.1 }}
          >
            {body}
          </span>,
          document.body,
        )}
      <TooltipContent positionerClassName="z-[101]">
        <span className="grid gap-0.5 py-0.5">
          <span className="font-semibold">{tier.name}</span>
          <span className="opacity-75">
            Opened {star.doors} of {EVE_DOORS} advent doors in {star.year}
          </span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

type StarUser = { id?: string; eveStar?: EveStar | null };

export function useEveStar(user: StarUser): EveStar | null {
  const viewerId = useContext(ViewerIdContext);
  const rewards = useRewards();
  const { eveStarSince } = useCelebrations();
  let star = user.eveStar ?? null;
  if (user.id && user.id === viewerId && rewards) {
    const own = rewards
      .filter((reward) => reward.day === EVE_DAY && reward.enabled && reward.doorsOpened !== null)
      .sort((a, b) => b.year - a.year)[0];
    star = own ? { year: own.year, doors: own.doorsOpened ?? 0 } : null;
  }
  return star && eveStarShown(star.year, eveStarSince) ? star : null;
}
