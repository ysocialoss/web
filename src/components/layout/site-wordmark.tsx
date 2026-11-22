import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAIN_WORDMARK, useBranding, type Variation } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function SiteWordmark({
  rem,
  variation = null,
  className,
}: {
  rem: number;
  variation?: Variation | null;
  className?: string;
}) {
  const art = variation?.wordmark ?? MAIN_WORDMARK;
  const unit = rem / MAIN_WORDMARK.width;
  const image = {
    width: `${art.width * unit}rem`,
    maxWidth: "none",
  };
  return (
    <span
      className={cn("relative block", className)}
      style={{ width: `${rem}rem`, height: `${MAIN_WORDMARK.height * unit}rem` }}
    >
      <img
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        draggable={false}
        className="absolute bottom-0 left-0 block h-auto"
        style={image}
      />
      {!variation && (
        <img
          src={art.src}
          alt=""
          aria-hidden="true"
          width={art.width}
          height={art.height}
          draggable={false}
          className="site-wordmark-tint pointer-events-none absolute bottom-0 left-0 h-auto"
          style={image}
        />
      )}
    </span>
  );
}

export function SiteLogoMark({
  variation = null,
  className,
}: {
  variation?: Variation | null;
  className?: string;
}) {
  const logo = variation?.logo;
  return (
    <img
      src={logo?.src ?? "/favicon.png"}
      alt=""
      width={48}
      height={48}
      draggable={false}
      className={cn("size-12 object-contain", className)}
    />
  );
}

export function SiteLogoLink({
  onHomeClick,
  className,
  tooltipSide,
  children,
}: {
  onHomeClick: MouseEventHandler<HTMLAnchorElement>;
  className: string;
  tooltipSide: "right" | "bottom";
  children: (variation: Variation | null) => ReactNode;
}) {
  const { active } = useBranding();
  if (!active)
    return (
      <Link to="/" aria-label="ysocial home" onClick={onHomeClick} className={className}>
        {children(null)}
      </Link>
    );
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={active.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${active.name}, opens in a new tab`}
            className={cn("cursor-pointer", className)}
          >
            {children(active)}
          </a>
        }
      />
      <TooltipContent side={tooltipSide}>{active.name}</TooltipContent>
    </Tooltip>
  );
}
