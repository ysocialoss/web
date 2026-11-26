import { useContext, useId } from "react";
import { cn } from "@/lib/utils";
import { ViewerIdContext } from "@/lib/viewer";
import { SnowField } from "./snow";
import { useRewards } from "./advent-store";

export const BADGE_DAY = 7;
export const FRAME_DAY = 14;
export const SNOW_DAY = 24;

type Received = { year: number; day: number };

export type Cosmetics = {
  badgeYears: number[];
  frame: boolean;
  snow: boolean;
};

const none: Cosmetics = { badgeYears: [], frame: false, snow: false };

export function cosmeticsOf(received: readonly Received[]): Cosmetics {
  if (received.length === 0) return none;
  return {
    badgeYears: received.filter((item) => item.day === BADGE_DAY).map((item) => item.year),
    frame: received.some((item) => item.day === FRAME_DAY),
    snow: received.some((item) => item.day === SNOW_DAY),
  };
}

export function useCosmetics(userId: string | null | undefined, fromServer: readonly Received[] = []): Cosmetics {
  const viewerId = useContext(ViewerIdContext);
  const rewards = useRewards();
  if (userId && userId === viewerId && rewards) return cosmeticsOf(rewards.filter((reward) => reward.enabled));
  return cosmeticsOf(fromServer);
}

const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y}Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r}Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y}Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z`;

export function ChristmasBadgeArt({ className }: { className?: string }) {
  const id = useId();
  const body = `${id}-body`;
  const cap = `${id}-cap`;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("shrink-0 overflow-visible", className)}>
      <defs>
        <radialGradient id={body} cx="0.32" cy="0.26" r="0.95">
          <stop offset="0" stopColor="#5fe58f" />
          <stop offset="0.6" stopColor="#1fa355" />
          <stop offset="1" stopColor="#0e6a36" />
        </radialGradient>
        <linearGradient id={cap} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#d9a238" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="14.2" r="8.8" fill={`url(#${body})`} />
      <ellipse cx="8.4" cy="9.8" rx="3.3" ry="1.9" fill="#fff" opacity="0.28" transform="rotate(-32 8.4 9.8)" />
      <rect x="8.9" y="3.9" width="6.2" height="3.4" rx="1.1" fill={`url(#${cap})`} />
      <ellipse cx="9.4" cy="2.5" rx="2.5" ry="1.5" fill="#e23a46" transform="rotate(-18 9.4 2.5)" />
      <ellipse cx="14.6" cy="2.5" rx="2.5" ry="1.5" fill="#e23a46" transform="rotate(18 14.6 2.5)" />
      <circle cx="12" cy="3" r="1.05" fill="#b9222f" />
      <g stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M12 9.6v9.2M8.02 11.9l7.96 4.6M8.02 16.5l7.96-4.6" />
      </g>
      <g fill="#f6cd5c">
        <path className="advent-twinkle" d={star(2.8, 7.2, 2.6)} />
        <path className="advent-twinkle [animation-delay:.6s]" d={star(21.4, 9.4, 2.1)} />
        <path className="advent-twinkle [animation-delay:1.2s]" d={star(20.6, 21.4, 1.7)} />
      </g>
    </svg>
  );
}

const FRAME = { width: 1810, height: 637, left: 178, right: 1632, top: 102 };
const frameBox = FRAME.right - FRAME.left;

export const FRAME_SPACE = { side: "10%", top: "6%" };

export function BannerFrame({ className }: { className?: string }) {
  return (
    <img
      src="/christmas-frame.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("pointer-events-none absolute z-[5] h-auto max-w-none select-none", className)}
      style={{
        left: `${(-FRAME.left / frameBox) * 100}%`,
        top: 0,
        width: `${(FRAME.width / frameBox) * 100}%`,
        transform: `translateY(${(-FRAME.top / FRAME.height) * 100}%)`,
      }}
    />
  );
}

export function ProfileSnow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-[6] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]",
        className,
      )}
    >
      <SnowField tone="any" density={1.2} detail={0.8} />
    </div>
  );
}
