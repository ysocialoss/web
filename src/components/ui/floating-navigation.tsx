import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

type FloatingNavigationItem = {
  to: string;
  label: string;
  icon: ReactNode;
  activeIcon?: ReactNode;
  badge?: number;
};

export function FloatingNavigation({
  items,
  activeTo,
  label = "Navigation",
  className,
}: {
  items: readonly FloatingNavigationItem[];
  activeTo: string | null;
  label?: string;
  className?: string;
}) {
  const activeIndex = items.findIndex(({ to }) => to === activeTo);

  return (
    <nav
      aria-label={label}
      className={cn(
        "isolate rounded-full border border-white/15 bg-zinc-950/90 p-1 text-white shadow-[0_8px_32px_-8px_rgb(0_0_0/0.5),inset_0_1px_1px_rgb(255_255_255/0.12)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="relative grid auto-cols-fr grid-flow-col">
        <span
          aria-hidden="true"
          data-slot="floating-navigation-indicator"
          className="pointer-events-none absolute inset-y-0 left-0 -z-10 rounded-full bg-white/20 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            width: `${100 / items.length}%`,
            transform: `translate3d(${Math.max(0, activeIndex) * 100}%,0,0)`,
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
        {items.map(({ to, label: itemLabel, icon, activeIcon, badge }) => {
          const active = to === activeTo;
          return (
            <Link
              key={to}
              to={to}
              aria-label={badge ? `${itemLabel}, ${badge} unread` : itemLabel}
              aria-current={active ? "page" : undefined}
              data-active={active}
              className="group relative flex h-12 min-w-11 items-center justify-center rounded-full outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <span className="pointer-events-none relative flex size-7 items-center justify-center text-white/75 transition-[transform,color] duration-300 ease-out group-hover:text-white group-active:scale-90 group-data-[active=true]:text-white motion-reduce:transition-none [&_svg]:size-6 [&_svg]:stroke-[2] group-data-[active=true]:[&_svg]:stroke-[2.75]">
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-opacity duration-200 motion-reduce:transition-none",
                    active && activeIcon ? "opacity-0" : "opacity-100",
                  )}
                >
                  {icon}
                </span>
                {activeIcon && (
                  <span
                    className={cn(
                      "absolute inset-0 flex items-center justify-center transition-opacity duration-200 motion-reduce:transition-none",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {activeIcon}
                  </span>
                )}
                {!!badge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-2 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-bold text-primary-foreground ring-2 ring-zinc-950"
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
