import { useCelebrations } from "@/lib/celebrations";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast-manager";
import { cn } from "@/lib/utils";
import { scrollerOf } from "@/features/feed/feed-floaters";
import {
  ADVENT_DOORS,
  adventDay,
  openAdventCalendar,
  setGiftHidden,
  useAdventNow,
  useAdventState,
} from "./advent-store";

const sparkles = [
  { x: 14, y: 30, r: 3.2, delay: "0s" },
  { x: 104, y: 24, r: 2.6, delay: ".5s" },
  { x: 110, y: 78, r: 2.2, delay: "1s" },
  { x: 8, y: 84, r: 2.4, delay: ".8s" },
  { x: 92, y: 104, r: 1.8, delay: ".3s" },
  { x: 26, y: 110, r: 1.6, delay: "1.3s" },
];
const dots = [
  { x: 22, y: 50, delay: ".2s" },
  { x: 100, y: 44, delay: ".9s" },
  { x: 112, y: 98, delay: ".6s" },
  { x: 6, y: 64, delay: "1.4s" },
  { x: 40, y: 18, delay: "1.1s" },
];

const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

export function GiftArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={cn("overflow-visible", className)}
    >
      <ellipse cx="60" cy="108" rx="34" ry="7" className="fill-black/15 dark:fill-black/45" />
      <g>
        <path d="M24 56 60 70v34L24 90Z" fill="#ecebf1" />
        <path d="M60 70 96 56v34l-36 14Z" fill="#d5d3de" />
        <path d="M38.3 61.6 45.7 64.4v34l-7.4-2.9Z" fill="#2fcc6b" />
        <path d="M74.3 64.4 81.7 61.6v34l-7.4 2.9Z" fill="#1f9a4f" />
        <path d="M60 70v34" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" />
      </g>
      <g className="transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/gift:-translate-y-2 group-focus-visible/gift:-translate-y-2">
        <path d="M20 50 60 66v8L20 58Z" fill="#f4f3f8" />
        <path d="M60 66 100 50v8L60 74Z" fill="#dddbe5" />
        <path d="M60 34 100 50 60 66 20 50Z" fill="#ffffff" />
        <path d="M36.3 56.5 43.7 59.5v8l-7.4-3Z" fill="#38d675" />
        <path d="M76.3 59.5 83.7 56.5v8l-7.4 3Z" fill="#22a457" />
        <path d="M36.3 56.5 43.7 59.5 83.7 43.5 76.3 40.5Z" fill="#4ade80" />
        <path d="M76.3 59.5 83.7 56.5 43.7 40.5 36.3 43.5Z" fill="#4ade80" />
        <path d="M60 48C52 34 34 28 34 38c0 7 14 11 26 10Z" fill="#38d675" />
        <path d="M60 48C68 34 86 28 86 38c0 7-14 11-26 10Z" fill="#26b35c" />
        <path d="M58 46C51 37 40 33 39 38" fill="none" stroke="#157a3c" strokeWidth="1.4" strokeLinecap="round" opacity=".45" />
        <path d="M62 46c7-9 18-13 19-8" fill="none" stroke="#157a3c" strokeWidth="1.4" strokeLinecap="round" opacity=".45" />
        <path d="M40 36c2-3 7-2 10 0" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".45" />
        <ellipse cx="60" cy="47.5" rx="6" ry="4.6" fill="#2fcc6b" />
        <ellipse cx="58.4" cy="46.2" rx="2" ry="1.2" fill="#fff" opacity=".5" />
      </g>
      <g fill="#f5c451">
        {sparkles.map((spark, index) => (
          <path
            key={index}
            className="advent-twinkle"
            style={{ animationDelay: spark.delay }}
            d={star(spark.x, spark.y, spark.r)}
          />
        ))}
      </g>
      <g className="fill-rose-300 dark:fill-white">
        {dots.map((dot, index) => (
          <circle
            key={index}
            className="advent-twinkle"
            style={{ animationDelay: dot.delay }}
            cx={dot.x}
            cy={dot.y}
            r="1.2"
          />
        ))}
      </g>
    </svg>
  );
}

type Corner = { right: number; bottom: number };

function useScrollerCorner(anchor: React.RefObject<HTMLElement | null>) {
  const [corner, setCorner] = useState<Corner | null>(null);
  useEffect(() => {
    const scroller = scrollerOf(anchor.current);
    if (!scroller) return;
    const measure = () => {
      const rect = scroller.getBoundingClientRect();
      const next = {
        right: Math.round(window.innerWidth - rect.right),
        bottom: Math.round(window.innerHeight - rect.bottom),
      };
      setCorner((previous) =>
        previous?.right === next.right && previous.bottom === next.bottom
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchor]);
  return corner;
}

export function AdventGift() {
  const anchor = useRef<HTMLSpanElement>(null);
  const corner = useScrollerCorner(anchor);
  const now = useAdventNow();
  const { giftSeason } = useCelebrations();
  const { giftHidden, opened, year } = useAdventState();
  const today = adventDay(now);
  const visible = !giftHidden && giftSeason;
  const waiting =
    year === today.year &&
    today.month === 11 &&
    today.day <= ADVENT_DOORS &&
    !opened.has(today.day);
  const label = waiting
    ? `Advent calendar: door ${today.day} is waiting for you`
    : today.day > ADVENT_DOORS
      ? "Advent calendar: Merry Christmas!"
      : "Advent calendar: come back tomorrow for the next door";

  const hide = () => {
    setGiftHidden(true);
    toast.add({
      type: "info",
      title: "Gift hidden",
      description:
        "You can still open the advent calendar from your account menu.",
      actionProps: { children: "Undo", onClick: () => setGiftHidden(false) },
    });
  };

  return (
    <span ref={anchor} hidden>
      {corner &&
        createPortal(
          <div
            style={{ right: corner.right, bottom: corner.bottom }}
            className="pointer-events-none fixed z-30 mr-4 mb-4 sm:mr-5 max-md:mb-[calc(5rem+env(safe-area-inset-bottom))]"
          >
            <AnimatePresence>
              {visible && (
                <m.div
                  key="gift"
                  initial={{ opacity: 0, y: 32, scale: 0.5, rotate: -10 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                  exit={{
                    opacity: 0,
                    y: 16,
                    scale: 0.4,
                    rotate: 14,
                    transition: { duration: 0.25, ease: "easeIn" },
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    damping: 16,
                    delay: 0.4,
                  }}
                  className="pointer-events-auto"
                >
                  <div className="relative">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-label={label}
                            onClick={openAdventCalendar}
                            className="group/gift advent-float relative block size-24 rounded-3xl outline-none transition-transform duration-200 active:scale-90 focus-visible:ring-3 focus-visible:ring-ring/50 max-md:size-20"
                          >
                            <GiftArt className="size-full transition-transform duration-300 group-hover/gift:scale-105" />
                            {waiting && (
                              <span
                                aria-hidden="true"
                                className="absolute top-2 left-1 grid size-6 place-items-center"
                              >
                                <span className="relative grid size-6 place-items-center rounded-full bg-[#d92d3a] text-xs font-bold text-white tabular-nums shadow ring-2 ring-background">
                                  {today.day}
                                </span>
                              </span>
                            )}
                          </button>
                        }
                      />
                      <TooltipContent side="left">{label}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={hide}
                            aria-label="Hide the advent calendar gift"
                            className="absolute top-0 right-0 grid size-6 place-items-center rounded-full bg-background/60 text-muted-foreground opacity-60 shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm transition-[opacity,transform,background-color] duration-150 outline-none hover:scale-110 hover:bg-background/90 hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        }
                      />
                      <TooltipContent side="top">Hide for good</TooltipContent>
                    </Tooltip>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </span>
  );
}
