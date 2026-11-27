import { useEffect, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { DisplayName } from "@/components/display-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { launchConfetti } from "./advent-confetti";
import { PreviewBanner, type Viewer } from "./advent-previews";
import { EVE_DAY, EVE_DOORS, type EveStar, EveStarArt, EveStarBadge, eveTierFor, eveTierRange, eveTiers } from "./eve-star";

export function eveTally(opened: ReadonlySet<number>) {
  const doors = [...opened].filter((day) => day < EVE_DAY).length;
  return { opened: doors, missed: EVE_DOORS - doors, tier: eveTierFor(doors) };
}

const days = Array.from({ length: EVE_DOORS }, (_, index) => index + 1);

export function EveReveal({
  opened,
  year,
  start,
  viewer,
}: {
  opened: ReadonlySet<number>;
  year: number;
  start: number;
  viewer: ProfileShotUser;
}) {
  const reduceMotion = useReducedMotion();
  const { opened: doors, missed } = eveTally(opened);
  const [counted, setCounted] = useState(reduceMotion ? doors : 0);
  const [done, setDone] = useState(Boolean(reduceMotion));
  const starRef = useRef<HTMLDivElement>(null);
  const shown = done ? doors : counted;
  const tier = eveTierFor(shown);
  const openedDays = days.filter((day) => opened.has(day));
  const lit = new Set(openedDays.slice(0, shown));

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let began = 0;
    const duration = 500 + doors * 75;
    const timer = window.setTimeout(() => {
      const tick = (time: number) => {
        began ||= time;
        const progress = Math.min(1, (time - began) / duration);
        setCounted(Math.round((1 - (1 - progress) ** 2.4) * doors));
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        setDone(true);
        const box = starRef.current?.getBoundingClientRect();
        if (box) launchConfetti(box.left + box.width / 2, box.top + box.height / 2, eveTierFor(doors).min >= 15);
      };
      frame = requestAnimationFrame(tick);
    }, start * 1000);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [doors, reduceMotion, start]);

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div ref={starRef} className="relative my-5 grid size-36 place-items-center sm:size-40">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={tier.id}
            className="absolute grid place-items-center"
            initial={{ scale: 0.4, rotate: -35, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
          >
            <EveStarBadge
              star={{ year, doors: shown }}
              lit={done}
              tooltip={false}
              className="text-[5.5rem] sm:text-[6.25rem]"
            />
          </m.span>
        </AnimatePresence>
      </div>

      <p className="text-sm font-semibold tracking-tight" style={{ color: tier.accent }}>
        {tier.name}
      </p>
      <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-balance">
        You opened <span className="tabular-nums">{shown}</span> of {EVE_DOORS} doors this December.
      </h3>
      <m.p
        className="mt-2 max-w-sm text-sm text-pretty text-muted-foreground"
        initial={false}
        animate={{ opacity: done ? 1 : 0, y: done ? 0 : 4 }}
      >
        {missed === 0
          ? "Not a single one missed. "
          : `${missed} ${missed === 1 ? "door" : "doors"} stayed shut. `}
        That earns you the <span className="font-medium text-foreground">{tier.name}</span>. It now sits next to your
        name everywhere on ysocial, for everyone to see, through the cold season until February 1.
      </m.p>

      <ol aria-label={`Doors 1 to ${EVE_DOORS}`} className="mt-4 flex flex-wrap justify-center gap-1">
        {days.map((day) => (
          <li
            key={day}
            aria-label={`Door ${day}, ${opened.has(day) ? "opened" : "missed"}`}
            className={cn(
              "size-2 rounded-full transition-colors duration-300",
              lit.has(day) ? "bg-emerald-500" : opened.has(day) ? "bg-foreground/15" : "bg-rose-500/35",
            )}
          />
        ))}
      </ol>

      <ol aria-label="Star tiers" className="mt-5 grid w-full grid-cols-5 gap-1.5">
        {eveTiers.map((step) => {
          const reached = shown >= step.min;
          const current = step.id === tier.id;
          return (
            <li
              key={step.id}
              aria-current={current && done ? "true" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2 transition-[background-color,opacity,filter] duration-300",
                current ? "bg-muted ring-1 ring-foreground/10" : !reached && "opacity-40 grayscale",
              )}
            >
              <EveStarArt tier={step.id} className="size-6" />
              <span className="text-[0.68rem] leading-tight font-medium">{step.name}</span>
              <span className="text-[0.62rem] leading-none text-muted-foreground tabular-nums">{eveTierRange(step)}</span>
            </li>
          );
        })}
      </ol>

      <ProfileShot viewer={viewer} star={{ year, doors }} shown={done} className="mt-6" />
    </div>
  );
}

export function EveTileStar({ doors, year }: { doors: number; year: number }) {
  return <EveStarBadge star={{ year, doors }} tooltip={false} className="text-3xl md:text-4xl" />;
}

export type ProfileShotUser = Pick<Viewer, "id" | "handle" | "displayName" | "avatarUrl" | "bannerUrl" | "bannerCrop" | "paint">;

export function ProfileShot({
  viewer,
  star,
  shown = true,
  className,
}: {
  viewer: ProfileShotUser;
  star: EveStar;
  shown?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const name = viewer.displayName.trim() || viewer.handle;
  const angle = { rotateX: 9, rotateY: -15, rotateZ: -2, scale: 1.06 };
  return (
    <m.div
      className={cn(
        "relative h-60 w-full overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 sm:h-64",
        className,
      )}
      initial={false}
      animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 12 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <m.div
        className="absolute inset-0 origin-[72%_60%]"
        style={{ transformPerspective: 900 }}
        initial={false}
        animate={
          shown && !reduceMotion
            ? angle
            : { rotateX: 6, rotateY: -34, rotateZ: -1, scale: 1.18 }
        }
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <PreviewBanner
          viewer={viewer}
          className="absolute -inset-x-[10%] -top-[12%] h-[52%] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        />
        <div className="absolute top-[16%] right-[22%] flex max-w-none flex-col items-start">
          <Avatar userId={viewer.id} className="size-20 shrink-0 ring-[6px] ring-card">
            {viewer.avatarUrl && <AvatarImage src={viewer.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <AvatarFallback className="text-2xl">{name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <p className="mt-3 flex items-center text-[2.4rem] leading-none font-semibold tracking-tight whitespace-nowrap">
            <DisplayName user={viewer} name={name} star={false} />
            <EveStarBadge star={star} lit tooltip={false} className="ml-[0.28em] text-[3.1rem]" />
          </p>
          <p className="mt-2 text-lg whitespace-nowrap text-muted-foreground">@{viewer.handle}</p>
        </div>
      </m.div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 backdrop-blur-[1.5px] [mask-image:radial-gradient(ellipse_58%_62%_at_68%_58%,transparent_50%,black_95%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_72%_at_68%_58%,transparent_38%,rgb(0_0_0/0.14)_72%,rgb(0_0_0/0.42))] dark:bg-[radial-gradient(ellipse_62%_70%_at_68%_58%,transparent_30%,rgb(0_0_0/0.38)_70%,rgb(0_0_0/0.78))]"
      />
    </m.div>
  );
}
