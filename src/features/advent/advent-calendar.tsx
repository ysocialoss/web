import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import NumberFlow from "@number-flow/react";
import { Check, Lock, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast-manager";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCelebrations } from "@/lib/celebrations";
import { ConfettiLayer, launchConfetti } from "./advent-confetti";
import { GiftArt } from "./advent-gift";
import { EveReveal, EveTileStar } from "./advent-eve";
import { RewardPreview, type Viewer } from "./advent-previews";
import { EVE_DAY } from "./eve-star";
import { SnowField } from "./snow";
import {
  ADVENT_DOORS,
  adventDay,
  closeAdventCalendar,
  loadAdvent,
  loadRewards,
  openDoor,
  resetAdventState,
  setRewardEnabled,
  useAdventNow,
  useAdventSecond,
  useAdventState,
  useRewards,
} from "./advent-store";

type DoorStatus = "locked" | "today" | "opened" | "missed";
type Today = ReturnType<typeof adventDay>;
type Box = { top: number; left: number; width: number; height: number };
type Stage = { day: number; year: number; from: Box; to: Box };

const days = Array.from({ length: ADVENT_DOORS }, (_, index) => index + 1);
const RED = "#c62f3b";
const BIG_DOORS = [1, 7, 14, EVE_DAY];
const bigRewards: Record<number, { title: (year: number) => string; text: string }> = {
  1: {
    title: () => "Snowy profile",
    text: "Let it snow over the top of your profile for everyone who visits.",
  },
  7: {
    title: (year) => `Christmas ${year} badge`,
    text: "A sparkling bauble for your profile. Everyone who visits sees it next to your name.",
  },
  14: {
    title: () => "Christmas garland frame",
    text: "Wrap your banner in a festive garland, shown everywhere your banner appears.",
  },
  [EVE_DAY]: {
    title: (year) => `Christmas Eve star ${year}`,
    text: "Every door you opened this December shaped the star next to your name.",
  },
};

const tileSpan: Record<number, string> = {
  1: "col-span-2 row-span-2 md:col-start-6 md:row-start-1",
  7: "col-span-2 row-span-2 md:col-start-3 md:row-start-2",
  13: "col-span-2 md:col-span-1",
  14: "col-span-2 row-span-2 md:col-start-6 md:row-start-3",
  19: "md:col-span-2",
  21: "col-span-2 md:col-span-1",
  22: "col-span-2 md:col-span-1",
  23: "col-span-2 md:col-span-1",
  24: "col-span-4 row-span-2 md:col-span-3 md:col-start-5 md:row-start-5",
};

const BEAT = { windUp: 0.8, untie: 0.55, swing: 1, swingFor: 1.1 };
const STAGE = { grow: 0.7, shrink: 0.75 };
const STREAK_LINGER_MS = 30_000;

function statusOf(day: number, today: Today, opened: ReadonlySet<number>): DoorStatus {
  if (opened.has(day)) return "opened";
  if (today.month !== 11 || day > today.day) return "locked";
  return day === today.day ? "today" : "missed";
}

function daysUntil(day: number, now: Date) {
  const target = new Date(now.getFullYear(), 11, day);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function tooltipFor(day: number, status: DoorStatus, now: Date) {
  if (status === "today") return `Open door ${day}`;
  if (status === "opened") return `Door ${day}, opened`;
  if (status === "missed") return `Door ${day}, missed`;
  const wait = daysUntil(day, now);
  return wait === 1 ? `Door ${day} opens tomorrow` : `Door ${day} opens in ${wait} days`;
}

const weekday = (year: number, day: number) =>
  new Date(year, 11, day).toLocaleDateString("en", { weekday: "short" });

function scrollParent(element: HTMLElement) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return document.documentElement;
}

export function AdventCalendar({ signedIn, viewer }: { signedIn: boolean; viewer: Viewer | null }) {
  const now = useAdventNow();
  const { adventSeason } = useCelebrations();
  const { open } = useAdventState();
  const year = now.getFullYear();
  const active = signedIn && adventSeason;
  const shown = open && active;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void loadAdvent(year, controller.signal);
    return () => controller.abort();
  }, [active, year, open]);

  const viewerId = signedIn ? (viewer?.id ?? null) : null;
  useEffect(() => {
    resetAdventState();
    if (!viewerId) return;
    const controller = new AbortController();
    void loadRewards(controller.signal);
    return () => controller.abort();
  }, [viewerId]);

  return (
    <>
      <Dialog open={shown} onOpenChange={(next) => { if (!next) closeAdventCalendar(); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-3xl">
          <CalendarBody now={now} viewer={viewer} />
        </DialogContent>
      </Dialog>
      <PageSnow active={shown} />
      <ConfettiLayer />
    </>
  );
}

function CalendarBody({ now, viewer }: { now: Date; viewer: Viewer | null }) {
  const { opened, year, loading, error } = useAdventState();
  const today = adventDay(now);
  const body = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const streakTimer = useRef<number | undefined>(undefined);
  const [opening, setOpening] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [streakShown, setStreakShown] = useState(false);
  const [poked, setPoked] = useState<{ day: number; key: number } | null>(null);
  const reduceMotion = useReducedMotion();
  const ready = year === today.year && !(loading && opened.size === 0 && !error);
  const counted = opening === null ? opened : new Set([...opened].filter((day) => day !== opening));

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(streakTimer.current);
    },
    [],
  );
  const later = (seconds: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, seconds * 1000));
  };
  const showStreak = () => {
    window.clearTimeout(streakTimer.current);
    setStreakShown(true);
  };
  const lingerStreak = () => {
    window.clearTimeout(streakTimer.current);
    streakTimer.current = window.setTimeout(() => setStreakShown(false), STREAK_LINGER_MS);
  };

  const poke = (day: number) => setPoked((previous) => ({ day, key: (previous?.key ?? 0) + 1 }));

  const press = (day: number, status: DoorStatus, door: HTMLElement) => {
    if (opening !== null) return;
    if (status !== "today") return poke(day);
    showStreak();
    openDoor(today.year, day).catch((failure: unknown) => {
      setStage(null);
      setOpening(null);
      lingerStreak();
      poke(day);
      toast.add({ type: "error", title: "That door is stuck", description: errorMessage(failure) });
    });
    if (reduceMotion) return lingerStreak();
    navigator.vibrate?.([10, 80, 20]);
    setOpening(day);
    const tile = door.getBoundingClientRect();
    if (!BIG_DOORS.includes(day) || !body.current || !viewer) {
      later(BEAT.swing + 0.05, () => launchConfetti(tile.left + tile.width / 2, tile.top + tile.height / 2));
      return;
    }
    const frame = body.current.getBoundingClientRect();
    const view = scrollParent(body.current).getBoundingClientRect();
    const top = Math.max(frame.top, view.top) - frame.top + 10;
    const bottom = Math.min(frame.bottom, view.bottom) - frame.top - 10;
    const to = { top, left: 10, width: frame.width - 20, height: bottom - top };
    setStage({
      day,
      year: today.year,
      from: { top: tile.top - frame.top, left: tile.left - frame.left, width: tile.width, height: tile.height },
      to,
    });
    later(STAGE.grow + BEAT.swing + 0.05, () =>
      launchConfetti(frame.left + to.left + to.width / 2, frame.top + to.top + to.height / 2, true),
    );
  };

  const doorOpened = (day: number) => {
    setOpening((current) => (current === day ? null : current));
    lingerStreak();
  };

  const landed = (day: number) => {
    setStage(null);
    setOpening(null);
    lingerStreak();
    poke(day);
  };

  return (
    <div ref={body} className="relative min-w-0 p-4 sm:p-6">
      <DialogHeader className="mb-4 pr-10 text-left sm:mb-5">
        <DialogTitle className="text-xl font-semibold sm:text-2xl">Advent calendar</DialogTitle>
        <DialogDescription className="sr-only">
          Open one door a day from December 1 until Christmas Eve.
        </DialogDescription>
      </DialogHeader>

      {error && !ready ? (
        <p role="alert" className="text-sm text-destructive">{errorMessage(error)}</p>
      ) : (
        <ol
          aria-label="Doors"
          className="grid auto-rows-[4.5rem] grid-cols-4 gap-2 md:auto-rows-[5.75rem] md:grid-cols-7 md:gap-2.5"
        >
          <li className="col-span-4 md:col-span-3">
            <Countdown />
          </li>
          {days.map((day, index) => {
            const status = ready ? statusOf(day, today, opened) : "locked";
            return (
              <m.li
                key={day}
                className={cn("relative", tileSpan[day], opening === day && "z-20")}
                initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.04 + index * 0.015, type: "spring", stiffness: 380, damping: 28 }}
              >
                <Door
                  day={day}
                  year={today.year}
                  status={status}
                  tooltip={ready ? tooltipFor(day, status, now) : "Loading…"}
                  opening={opening === day && stage === null}
                  lifted={stage?.day === day}
                  pokedKey={poked?.day === day ? poked.key : null}
                  onPress={(door) => press(day, status, door)}
                  onOpened={() => doorOpened(day)}
                />
              </m.li>
            );
          })}
        </ol>
      )}
      {stage && viewer && <BigStage key={stage.day} stage={stage} viewer={viewer} onDone={() => landed(stage.day)} />}
      <StreakPopup shown={streakShown} now={now} opened={counted} />
    </div>
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

function Countdown() {
  const now = useAdventSecond();
  const today = adventDay(now);
  const before = today.month !== 11;
  const finished = !before && today.day >= ADVENT_DOORS;
  const target = before ? new Date(today.year, 11, 1) : new Date(today.year, 11, today.day + 1);
  const left = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const parts: [number, string][] = [
    [Math.floor(left / 86_400), "d"],
    [Math.floor(left / 3600) % 24, "h"],
    [Math.floor(left / 60) % 60, "m"],
    [left % 60, "s"],
  ];
  const shownParts = parts[0][0] > 0 ? parts : parts.slice(1);
  return (
    <div className="relative flex h-full items-center justify-between gap-3 overflow-hidden rounded-xl bg-muted/50 px-3.5 md:px-4">
      {finished ? (
        <p className="text-xl font-semibold md:text-2xl">
          {today.day === ADVENT_DOORS ? "It's Christmas Eve" : "Merry Christmas"}
        </p>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground md:text-sm">
            {before ? "First door opens in" : "Next door opens in"}
          </p>
          <p className="flex items-baseline gap-2 font-semibold tabular-nums">
            {shownParts.map(([value, unit]) => (
              <span key={unit} className="text-2xl md:text-3xl">
                {unit === "d" ? value : pad(value)}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            ))}
          </p>
        </div>
      )}
      <GiftArt className="size-16 shrink-0 -rotate-3 md:size-20" />
    </div>
  );
}

function StreakPopup({ shown, now, opened }: { shown: boolean; now: Date; opened: ReadonlySet<number> }) {
  const today = adventDay(now);
  const day = today.month === 11 ? today.day : 0;
  const next = BIG_DOORS.find((big) => big > day || (big === day && !opened.has(big))) ?? null;
  const previous = next === null ? 0 : ([0, ...BIG_DOORS].filter((big) => big < next).at(-1) ?? 0);
  const todayLeft = day > previous && next !== null && day <= next && !opened.has(day) ? 1 : 0;
  const toGo = next === null ? 0 : Math.max(0, next - day) + todayLeft;
  const path = next === null ? [] : Array.from({ length: next - previous }, (_, index) => previous + index + 1);
  const label =
    next === null
      ? "Every big door is open"
      : next === day && toGo === 1
        ? "The big door is ready"
        : `${toGo === 1 ? "door" : "doors"} until big door ${next}`;
  return createPortal(
    <AnimatePresence>
      {shown && (
        <m.div
          key="streak"
          role="status"
          initial={{ opacity: 0, y: -60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -60, scale: 0.9, transition: { duration: 0.25, ease: "easeIn" } }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="pointer-events-none fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-[75] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-popover px-4 py-3 text-popover-foreground shadow-xl ring-1 ring-foreground/10">
            <div className="grid gap-1.5">
              <p className="flex items-baseline gap-2">
                {next !== null && !(next === day && toGo === 1) && (
                  <NumberFlow value={toGo} className="text-2xl leading-none font-semibold tabular-nums" />
                )}
                <span className="text-sm font-medium">{label}</span>
              </p>
              {path.length > 0 && (
                <ol aria-label={`Doors ${path[0]} to ${next}`} className="flex items-center gap-1">
                  {path.map((door) => {
                    const status = statusOf(door, today, opened);
                    if (door === next)
                      return (
                        <li key={door} aria-label={`Big door ${door}`}>
                          <Star
                            aria-hidden="true"
                            className={cn("size-3.5 text-[#e6b65a]", status === "opened" && "fill-current")}
                          />
                        </li>
                      );
                    return (
                      <li
                        key={door}
                        aria-label={`Door ${door}, ${status}`}
                        className={cn(
                          "size-2 rounded-full transition-colors duration-500",
                          status === "opened" && "bg-emerald-500",
                          status === "missed" && "bg-rose-500/40",
                          status === "today" && "bg-[#c62f3b] ring-2 ring-[#c62f3b]/30",
                          status === "locked" && "bg-foreground/15",
                        )}
                      />
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Door({
  day,
  year,
  status,
  tooltip,
  opening,
  lifted,
  pokedKey,
  onPress,
  onOpened,
}: {
  day: number;
  year: number;
  status: DoorStatus;
  tooltip: string;
  opening: boolean;
  lifted: boolean;
  pokedKey: number | null;
  onPress: (door: HTMLElement) => void;
  onOpened: () => void;
}) {
  const big = BIG_DOORS.includes(day);
  const shownStatus = opening ? "opened" : status;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={(event) => onPress(event.currentTarget)}
            aria-label={tooltip}
            aria-disabled={status === "today" ? undefined : true}
            className={cn(
              "group/door relative block size-full rounded-xl text-left outline-none [perspective:800px] focus-visible:ring-3 focus-visible:ring-ring/50",
              "transition-transform duration-200 ease-out active:scale-[0.97]",
              status === "today" && !opening && !lifted && "advent-nudge hover:-translate-y-0.5",
              status === "opened" && "hover:-translate-y-0.5",
            )}
          >
            {lifted && <span className="absolute inset-0 rounded-xl border-2 border-dashed border-foreground/15" />}
            <span
              key={pokedKey ?? "idle"}
              className={cn(
                "absolute inset-0 block rounded-xl transition-opacity duration-150",
                lifted && "opacity-0",
                pokedKey !== null && (status === "opened" ? "[animation:pop_.45s_ease-out]" : "advent-shake"),
              )}
            >
              <TileFace day={day} year={year} status={shownStatus} fresh={opening} />
              {opening && <RevealLight start={0} />}
              {(status === "today" || opening) && (
                <GiftDoors day={day} size={big ? "big" : "tile"} opening={opening} start={0} onOpened={onOpened} />
              )}
            </span>
          </button>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function StatusMark({ status, fresh }: { status: DoorStatus; fresh: boolean }) {
  if (status === "opened")
    return (
      <m.span
        initial={fresh ? { scale: 0, rotate: -45 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 14, delay: fresh ? BEAT.swing + 0.85 : 0 }}
        className="grid size-4 place-items-center rounded-full bg-emerald-500 text-white"
      >
        <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
      </m.span>
    );
  if (status === "missed")
    return (
      <span className="grid size-4 place-items-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
        <X className="size-2.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  return (
    <Lock
      className="size-3.5 opacity-60 transition-transform duration-200 group-hover/door:-rotate-12"
      aria-hidden="true"
    />
  );
}

function TileFace({
  day,
  year,
  status,
  fresh,
}: {
  day: number;
  year: number;
  status: DoorStatus;
  fresh: boolean;
}) {
  const big = BIG_DOORS.includes(day);
  const eve = day === ADVENT_DOORS;
  const pop = {
    initial: fresh ? { scale: 0.3, opacity: 0, y: 6 } : false,
    animate: { scale: 1, opacity: 1, y: 0 },
    transition: { type: "spring", stiffness: 420, damping: 13, delay: fresh ? BEAT.swing + 0.5 : 0 },
  } as const;
  return (
    <span
      className={cn(
        "absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl p-2.5 ring-1 transition-colors md:p-3",
        status === "opened" && "bg-background text-foreground ring-foreground/10 dark:bg-muted",
        status === "locked" && "bg-muted/50 text-muted-foreground ring-transparent group-hover/door:bg-muted/80",
        status === "missed" && "bg-muted/25 text-muted-foreground/50 ring-transparent",
        status === "today" && "ring-transparent",
        big && status !== "today" && (eve ? "ring-[#c62f3b]/25 dark:ring-rose-400/20" : "ring-[#e6b65a]/35"),
      )}
    >
      {eve && <EveSparkles />}
      {eve && status === "opened" && <OpenedEveStar year={year} fresh={fresh} />}
      {big ? (
        <m.span {...pop} className="relative grid flex-1 place-content-center text-center">
          <span
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              eve ? "text-6xl md:text-7xl" : "text-5xl md:text-6xl",
              status === "missed" && "line-through decoration-4",
            )}
          >
            {day}
          </span>
          {eve && <span className="mt-1 text-xs md:text-sm">Christmas Eve</span>}
        </m.span>
      ) : (
        <m.span
          {...pop}
          className={cn("origin-bottom-left text-xl leading-none font-semibold tabular-nums md:text-2xl", status === "missed" && "line-through decoration-2")}
        >
          {day}
        </m.span>
      )}
      <span className="relative flex items-end justify-between gap-1">
        <span className="text-[0.7rem] md:text-xs">{big ? "" : weekday(year, day)}</span>
        <StatusMark status={status} fresh={fresh} />
      </span>
    </span>
  );
}

function OpenedEveStar({ year, fresh }: { year: number; fresh: boolean }) {
  const reward = useRewards()?.find((item) => item.year === year && item.day === EVE_DAY);
  if (!reward || reward.doorsOpened === null) return null;
  return (
    <m.span
      className="absolute top-2.5 right-2.5 md:top-3 md:right-3"
      initial={fresh ? { scale: 0, rotate: -40 } : false}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 14, delay: fresh ? BEAT.swing + 0.6 : 0 }}
    >
      <EveTileStar year={year} doors={reward.doorsOpened} />
    </m.span>
  );
}

const eveSparkles = [
  { left: "14%", top: "28%", delay: "0s" },
  { left: "82%", top: "22%", delay: ".6s" },
  { left: "72%", top: "74%", delay: "1.1s" },
  { left: "24%", top: "70%", delay: ".3s" },
  { left: "90%", top: "52%", delay: "1.5s" },
  { left: "8%", top: "50%", delay: ".9s" },
  { left: "50%", top: "12%", delay: "1.3s" },
];

function EveSparkles() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {eveSparkles.map((spark, index) => (
        <span
          key={index}
          className="advent-twinkle absolute size-1 rounded-full bg-[#c62f3b]/50 dark:bg-rose-300/70"
          style={{ left: spark.left, top: spark.top, animationDelay: spark.delay }}
        />
      ))}
    </span>
  );
}

const doorSizes = {
  tile: { ribbon: "w-3 md:w-3.5", band: "h-3 md:h-3.5", seal: "size-10 text-lg md:size-12 md:text-xl", knob: "size-1.5" },
  big: { ribbon: "w-4 md:w-5", band: "h-4 md:h-5", seal: "size-20 text-4xl md:size-24 md:text-5xl", knob: "size-2" },
  stage: { ribbon: "w-8 md:w-10", band: "h-8 md:h-10", seal: "size-36 text-6xl md:size-44 md:text-7xl", knob: "size-3" },
};

function GiftDoors({
  day,
  size,
  opening,
  start,
  onOpened,
}: {
  day: number;
  size: keyof typeof doorSizes;
  opening: boolean;
  start: number;
  onOpened?: () => void;
}) {
  const parts = doorSizes[size];
  const still = { duration: 0 };
  const swing = { duration: BEAT.swingFor, ease: [0.22, 0.9, 0.25, 1], delay: start + BEAT.swing } as const;
  const untie = { duration: 0.4, ease: "easeIn", delay: start + BEAT.untie } as const;
  return (
    <m.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] [transform-style:preserve-3d]"
      initial={{ scale: 1, rotate: 0 }}
      animate={
        opening
          ? { scale: [1, 1.08, 0.95, 1.06, 0.98, 1.03], rotate: [0, -3, 3, -2, 1.5, 0] }
          : { scale: 1, rotate: 0 }
      }
      transition={opening ? { duration: BEAT.windUp, delay: start, ease: "easeInOut" } : still}
    >
      {(["left", "right"] as const).map((side) => (
        <m.span
          key={side}
          className={cn(
            "absolute inset-y-0 w-1/2 overflow-hidden [outline:1px_solid_transparent] [backface-visibility:hidden]",
            side === "left" ? "left-0 origin-left rounded-l-[inherit]" : "right-0 origin-right rounded-r-[inherit]",
          )}
          style={{ backgroundColor: RED }}
          initial={{ rotateY: 0, opacity: 1 }}
          animate={opening ? { rotateY: side === "left" ? -120 : 120, opacity: [1, 1, 0] } : { rotateY: 0, opacity: 1 }}
          transition={opening ? { ...swing, opacity: { ...swing, times: [0, 0.75, 1] } } : still}
          onAnimationComplete={side === "left" ? () => { if (opening) onOpened?.(); } : undefined}
        >
          <span className={cn("absolute inset-y-0 w-px bg-black/20", side === "left" ? "right-0" : "left-0")} />
          <span
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-full bg-[#f3d58c]",
              parts.knob,
              side === "left" ? "right-[12%]" : "left-[12%]",
            )}
          />
        </m.span>
      ))}
      <m.span
        className={cn("absolute inset-y-0 left-1/2 -translate-x-1/2 bg-[#e6b65a]", parts.ribbon)}
        initial={{ scaleY: 1 }}
        animate={opening ? { scaleY: 0 } : { scaleY: 1 }}
        transition={opening ? untie : still}
      />
      <m.span
        className={cn("absolute inset-x-0 top-1/2 -translate-y-1/2 bg-[#e6b65a]", parts.band)}
        initial={{ scaleX: 1 }}
        animate={opening ? { scaleX: 0 } : { scaleX: 1 }}
        transition={opening ? untie : still}
      />
      <span className="absolute inset-0 grid place-items-center">
        <m.span
          className={cn(
            "grid place-items-center rounded-full bg-[#9b1d2c] font-bold text-white tabular-nums ring-2 ring-[#e6b65a]",
            parts.seal,
          )}
          initial={{ scale: 1, rotate: 0, opacity: 1 }}
          animate={opening ? { scale: [1, 1.35, 0], rotate: [0, -12, 50], opacity: [1, 1, 0] } : { scale: 1, rotate: 0, opacity: 1 }}
          transition={opening ? { duration: 0.6, delay: start + BEAT.untie - 0.05, times: [0, 0.45, 1], ease: "easeIn" } : still}
        >
          {day}
        </m.span>
      </span>
    </m.span>
  );
}

function RevealLight({ start }: { start: number }) {
  const at = start + BEAT.swing;
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <m.span
        className="absolute top-1/2 left-1/2 size-[320%] -translate-1/2 bg-[repeating-conic-gradient(rgb(246_205_110/0.55)_0deg_7deg,transparent_7deg_30deg)]"
        initial={{ opacity: 0, rotate: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.9, 0.6, 0], rotate: 110, scale: 1 }}
        transition={{ duration: 2, delay: at, ease: "easeOut" }}
      />
      <m.span
        className="absolute inset-0 bg-[radial-gradient(circle,rgb(255_240_190/0.95),rgb(246_196_81/0.55)_35%,transparent_72%)]"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], scale: [0.3, 1.2, 1.6] }}
        transition={{ duration: 1.4, delay: at + 0.05, ease: "easeOut" }}
      />
      <m.span
        className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/25"
        initial={{ x: "-150%" }}
        animate={{ x: "420%" }}
        transition={{ duration: 0.9, delay: at + 0.85, ease: "easeInOut" }}
      />
    </span>
  );
}

function BigStage({ stage, viewer, onDone }: { stage: Stage; viewer: Viewer; onDone: () => void }) {
  const { opened } = useAdventState();
  const eve = stage.day === EVE_DAY;
  const [closing, setClosing] = useState(false);
  const [applying, setApplying] = useState(false);
  const reward = bigRewards[stage.day];
  const reveal = STAGE.grow + BEAT.swing + 0.45;
  const apply = async () => {
    setApplying(true);
    try {
      await setRewardEnabled(stage.year, stage.day, true);
      setClosing(true);
    } catch (error) {
      setApplying(false);
      toast.add({ type: "error", title: "Couldn't apply it", description: errorMessage(error) });
    }
  };
  return (
    <>
      <m.div
        aria-hidden="true"
        className="absolute inset-0 z-30 bg-background/80 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: closing ? STAGE.shrink : STAGE.grow }}
      />
      <m.div
        role="dialog"
        aria-label={reward.title(stage.year)}
        className="absolute z-40 overflow-hidden bg-background shadow-2xl ring-1 ring-foreground/10 [perspective:1600px] dark:bg-muted"
        initial={{ ...stage.from, borderRadius: 12 }}
        animate={closing ? { ...stage.from, borderRadius: 12 } : { ...stage.to, borderRadius: 28 }}
        transition={
          closing
            ? { duration: STAGE.shrink, ease: [0.6, 0, 0.3, 1] }
            : { duration: STAGE.grow, ease: [0.34, 1.25, 0.64, 1] }
        }
        onAnimationComplete={() => { if (closing) onDone(); }}
      >
        <m.div
          className="absolute inset-0 overflow-y-auto"
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={closing ? { opacity: 0, y: 0, scale: 0.9 } : { opacity: 1, y: 0, scale: 1 }}
          transition={closing ? { duration: 0.2 } : { delay: reveal, type: "spring", stiffness: 240, damping: 20 }}
        >
          <div className="flex min-h-full items-center justify-center p-5 sm:p-8">
            <div className="flex w-full max-w-md flex-col items-center text-center">
              {eve ? (
                <EveReveal opened={opened} year={stage.year} start={reveal} viewer={viewer} />
              ) : (
                <>
                  <RewardPreview day={stage.day} viewer={viewer} />
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight">{reward.title(stage.year)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{reward.text}</p>
                </>
              )}
              <div className="mt-6 flex w-full gap-2 sm:w-auto">
                {eve ? (
                  <Button size="lg" className="flex-1 sm:min-w-28" disabled={closing} onClick={() => setClosing(true)}>
                    Wonderful
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="lg" className="flex-1 sm:min-w-28" disabled={closing || applying} onClick={() => setClosing(true)}>
                      Save
                    </Button>
                    <Button size="lg" className="flex-1 sm:min-w-28" disabled={closing || applying} onClick={() => void apply()}>
                      Apply
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </m.div>
        {!closing && <RevealLight start={STAGE.grow} />}
        <GiftDoors day={stage.day} size="stage" opening start={STAGE.grow} />
      </m.div>
    </>
  );
}

function PageSnow({ active }: { active: boolean }) {
  return createPortal(
    <AnimatePresence>
      {active && (
        <m.div
          key="snow"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none fixed inset-0 z-[60]"
        >
          <SnowField tone="auto" />
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
