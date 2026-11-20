
"use client";

import * as React from "react";
import { NumberRoll } from "./number-roll";
import { GLYPH, ReactionTray, TRAY_H, trayWidth, type ReactionChoice, type TrayHandle, type TrayPlacement } from "./reactions-tray";
import { EASE_OUT, EASE_THROW, INTERACTION_FOCUS, INTERACTION_PRESS, createSpring, useInteractionReducedMotion, type Spring } from "./ui-interaction-motion";

export type { ReactionChoice } from "./reactions-tray";


export interface Reaction {
  emoji: string;
  count: number;
  mine?: boolean;
  people?: string[];
}

export interface ReactionsHandle {
  pick: (emoji: string) => void;
  open: (anchor?: HTMLElement) => void;
  close: () => void;
  react: (emoji: string) => void;
}

export interface ReactionsProps {
  value?: Reaction[];
  defaultValue?: Reaction[];
  onValueChange?: (value: Reaction[]) => void;
  onReact?: (emoji: string, on: boolean) => Promise<unknown> | unknown;
  choices?: ReactionChoice[];
  label?: string;
  onMore?: (anchor: HTMLElement) => void;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  labelFor?: (emoji: string) => string | undefined;
  className?: string;
  ref?: React.Ref<ReactionsHandle>;
}

export const DEFAULT_REACTION_CHOICES: ReactionChoice[] = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Funny" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "🙏", label: "Thanks" },
  { emoji: "👀", label: "Looking" },
];

const CHIP_GLYPH = 16;
const NONE: Reaction[] = [];
const ROLL_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 0 };
const FLY_X = { stiffness: 360, damping: 36 };
const FLY_Y = { stiffness: 280, damping: 33 };
const FLY_S = { stiffness: 320, damping: 34 };
const GIVE = { stiffness: 640, damping: 30 };

function toggle(list: Reaction[], emoji: string, on: boolean): Reaction[] {
  const i = list.findIndex((r) => r.emoji === emoji);
  if (i < 0) return on ? [...list, { emoji, count: 1, mine: true }] : list;
  const r = list[i];
  if (Boolean(r.mine) === on) return list;
  const next = list.slice();
  next[i] = { ...r, count: Math.max(0, r.count + (on ? 1 : -1)), mine: on };
  return next;
}

function who(r: Reaction, label: string) {
  const others = Math.max(0, r.count - (r.mine ? 1 : 0));
  const named = (r.people ?? []).slice(0, others);
  const names = [...(r.mine ? ["You"] : []), ...named.slice(0, r.mine ? 2 : 3)];
  const rest = r.count - names.length;
  if (!names.length) return `${r.count} ${r.count === 1 ? "person" : "people"} reacted with ${label}`;
  const list = rest > 0 ? `${names.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return `${list} reacted with ${label}`;
}

interface ChipApi {
  slot: () => HTMLElement | null;
  land: () => void;
  shake: () => void;
}

interface ChipProps {
  reaction: Reaction;
  label: string;
  leaving: boolean;
  animateIn: boolean;
  awaiting: boolean;
  quiet: boolean;
  reduced: boolean;
  register: (emoji: string, api: ChipApi | null) => void;
  onToggle: (emoji: string) => void;
}

const Chip = React.memo(function Chip({ reaction, label, leaving, animateIn, awaiting, quiet, reduced, register, onToggle }: ChipProps) {
  const { emoji, count, mine = false } = reaction;
  const [open, setOpen] = React.useState(() => !animateIn);
  const button = React.useRef<HTMLButtonElement>(null);
  const glyph = React.useRef<HTMLSpanElement>(null);
  const give = React.useRef<Spring | null>(null);
  const lastCount = React.useRef(count);
  const tipId = React.useId();
  const shown = open && !leaving;

  React.useEffect(() => {
    if (open || leaving) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOpen(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open, leaving]);

  React.useLayoutEffect(() => {
    const paint = () => {
      const v = give.current?.get() ?? 1;
      if (button.current) button.current.style.transform = v === 1 ? "" : `scale(${v.toFixed(4)})`;
      if (glyph.current) glyph.current.style.transform = v === 1 ? "" : `scale(${(1 + (1 - v) * 2.6).toFixed(4)})`;
    };
    const spring = createSpring(1, GIVE, paint, 0.0005);
    give.current = spring;
    const api: ChipApi = {
      slot: () => glyph.current,
      land: () => !reduced && spring.push(-2.6),
      shake: () => {
        if (reduced) return;
        button.current?.animate([{ translate: "0" }, { translate: "-4px" }, { translate: "4px" }, { translate: "-3px" }, { translate: "2px" }, { translate: "0" }], { duration: 380, easing: "ease-out" });
      },
    };
    register(emoji, api);
    return () => {
      spring.stop();
      give.current = null;
      register(emoji, null);
    };
  }, [emoji, reduced, register]);

  React.useEffect(() => {
    const before = lastCount.current;
    lastCount.current = count;
    if (count > before && !awaiting && !reduced) give.current?.push(-1.4);
  }, [count, awaiting, reduced]);

  return (
    <span
      className="group/chip relative inline-grid"
      style={{
        gridTemplateColumns: shown ? "1fr" : "0fr",
        opacity: shown ? 1 : 0,
        transition: reduced ? "none" : `grid-template-columns 340ms ${EASE_OUT} ${leaving ? "110ms" : "0ms"}, opacity ${shown ? "220ms" : "180ms"} ${EASE_OUT}`,
      }}
    >
      <span className="min-w-0 [clip-path:inset(-8px_-3px)]">
        <span className="flex w-max py-0.5 pr-1.5">
          <button
            ref={button}
            type="button"
            aria-pressed={mine}
            aria-label={`${label}, ${count} ${count === 1 ? "reaction" : "reactions"}${mine ? ", including yours" : ""}`}
            aria-describedby={tipId}
            tabIndex={leaving ? -1 : undefined}
            onClick={() => onToggle(emoji)}
            className={`inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-full pl-2 pr-2.5 text-[13px] font-medium tabular-nums will-change-transform ${INTERACTION_PRESS} ${INTERACTION_FOCUS} ${
              mine
                ? "bg-[color-mix(in_oklab,var(--foreground)_11%,var(--background))] text-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_15%,var(--background))]"
                : "bg-background text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:bg-accent hover:text-foreground"
            }`}
          >
            <span
              ref={glyph}
              aria-hidden="true"
              className="block leading-none"
              style={{
                fontSize: CHIP_GLYPH,
                opacity: awaiting ? 0 : 1,
                scale: shown ? 1 : 0.4,
                transition: reduced ? "none" : `scale 420ms ${EASE_THROW}`,
              }}
            >
              {emoji}
            </span>
            <NumberRoll value={count} format={ROLL_FORMAT} duration={620} aria-hidden="true" />
          </button>
        </span>
      </span>
      <span
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-[calc(50%_-_3px)] z-10 mb-1 whitespace-nowrap rounded-[10px] bg-popover px-2 py-1 text-[12px] leading-[16px] text-popover-foreground opacity-0 shadow-[0_0_0_1px_var(--border)] transition-[opacity,translate] delay-0 duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] [translate:-50%_4px] motion-reduce:transition-none ${
          quiet || leaving ? "" : "group-hover/chip:opacity-100 group-hover/chip:delay-300 group-hover/chip:[translate:-50%_0] group-has-[:focus-visible]/chip:opacity-100 group-has-[:focus-visible]/chip:[translate:-50%_0]"
        }`}
      >
        {who(reaction, label)}
      </span>
    </span>
  );
});

function SmilePlus({ open, reduced }: { open: boolean; reduced: boolean }) {
  const mouth = React.useRef<SVGPathElement>(null);
  const plus = React.useRef<SVGGElement>(null);
  const spring = React.useRef<Spring | null>(null);

  React.useLayoutEffect(() => {
    const paint = () => {
      const g = spring.current?.get() ?? 0;
      mouth.current?.setAttribute("d", `M${(7.7 - 0.5 * g).toFixed(2)} 14.6Q11 ${(17.6 + 1.8 * g).toFixed(2)} ${(14.3 + 0.5 * g).toFixed(2)} 14.6`);
      plus.current?.setAttribute("transform", `rotate(${(45 * g).toFixed(2)} 19 5)`);
    };
    spring.current = createSpring(0, { stiffness: 420, damping: 30 }, paint, 0.002);
    paint();
    return () => spring.current?.stop();
  }, []);

  React.useEffect(() => {
    if (reduced) spring.current?.jump(open ? 1 : 0);
    else spring.current?.set(open ? 1 : 0);
  }, [open, reduced]);

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px] overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M17.6 10.6A7.6 7.6 0 1 1 13.4 6" />
      <circle cx="8.4" cy="11.4" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="11.4" r="0.95" fill="currentColor" stroke="none" />
      <path ref={mouth} d="M7.7 14.6Q11 17.6 14.3 14.6" />
      <g ref={plus}>
        <path d="M19 2.4v5.2M16.4 5h5.2" />
      </g>
    </svg>
  );
}

type Phase = "closed" | "open" | "closing";
type Flight = { id: number; emoji: string; from: { x: number; y: number; s: number } };
type Press = { id: number; x: number; y: number; dragging: boolean; wasOpen: boolean; rootX: number; rootY: number };

export function Reactions({
  value,
  defaultValue = NONE,
  onValueChange,
  onReact,
  choices = DEFAULT_REACTION_CHOICES,
  label = "Add reaction",
  onMore,
  hideTrigger = false,
  onOpenChange,
  labelFor,
  className = "",
  ref,
}: ReactionsProps) {
  const reduced = useInteractionReducedMotion();
  const [internal, setInternal] = React.useState(defaultValue);
  const raw = value ?? internal;
  const list = React.useMemo(() => raw.filter((r) => r.count > 0), [raw]);

  const [prevList, setPrevList] = React.useState(list);
  const [ghosts, setGhosts] = React.useState<{ reaction: Reaction; index: number }[]>([]);
  if (prevList !== list) {
    setPrevList(list);
    const gone = prevList.flatMap((reaction, index) => (list.some((r) => r.emoji === reaction.emoji) ? [] : [{ reaction, index }]));
    setGhosts((current) => [...current.filter((g) => !list.some((r) => r.emoji === g.reaction.emoji) && !gone.some((n) => n.reaction.emoji === g.reaction.emoji)), ...gone]);
  }
  React.useEffect(() => {
    if (!ghosts.length) return;
    const timer = window.setTimeout(() => setGhosts([]), 520);
    return () => window.clearTimeout(timer);
  }, [ghosts]);

  const rows = React.useMemo(() => {
    const out = list.map((reaction) => ({ reaction, leaving: false }));
    [...ghosts].sort((a, b) => a.index - b.index).forEach((g) => out.splice(Math.min(g.index, out.length), 0, { reaction: g.reaction, leaving: true }));
    return out;
  }, [list, ghosts]);

  const mine = React.useMemo(() => new Set(list.filter((r) => r.mine).map((r) => r.emoji)), [list]);
  const labelOf = React.useCallback((emoji: string) => choices.find((c) => c.emoji === emoji && !c.more)?.label ?? labelFor?.(emoji) ?? emoji, [choices, labelFor]);

  const [phase, setPhase] = React.useState<Phase>("closed");
  const [place, setPlace] = React.useState<TrayPlacement | null>(null);
  const [focusTray, setFocusTray] = React.useState(false);
  const [flight, setFlight] = React.useState<Flight | null>(null);
  const [ready, setReady] = React.useState(false);
  const [said, setSaid] = React.useState("");

  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const tray = React.useRef<TrayHandle>(null);
  const flyer = React.useRef<HTMLSpanElement>(null);
  const sparks = React.useRef<HTMLSpanElement>(null);
  const chips = React.useRef(new Map<string, ChipApi>());
  const press = React.useRef<Press | null>(null);
  const auto = React.useRef<number[]>([]);
  const flights = React.useRef(0);
  const trayId = React.useId();

  const latest = React.useRef({ list, phase, choices, reduced, onReact, onValueChange, onMore, labelOf, controlled: value !== undefined });
  React.useLayoutEffect(() => {
    latest.current = { list, phase, choices, reduced, onReact, onValueChange, onMore, labelOf, controlled: value !== undefined };
  });
  React.useEffect(() => {
    onOpenChange?.(phase === "open");
  }, [phase, onOpenChange]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  React.useEffect(
    () => () => {
      auto.current.forEach(window.clearTimeout);
    },
    [],
  );

  const register = React.useCallback((emoji: string, api: ChipApi | null) => {
    if (api) chips.current.set(emoji, api);
    else chips.current.delete(emoji);
  }, []);

  const burst = React.useCallback((emoji: string, x: number, y: number) => {
    const layer = sparks.current;
    if (!layer || latest.current.reduced || layer.childElementCount > 12) return;
    for (let k = 0; k < 5; k++) {
      const el = document.createElement("span");
      el.textContent = emoji;
      el.style.cssText = "position:absolute;left:0;top:0;font-size:12px;line-height:1;will-change:transform;pointer-events:none";
      layer.appendChild(el);
      const angle = -Math.PI / 2 + (k - 2) * 0.48 + (Math.random() - 0.5) * 0.3;
      const speed = 150 + Math.random() * 70;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const spin = (Math.random() - 0.5) * 120;
      const life = 0.6 + Math.random() * 0.12;
      const frames = Array.from({ length: 13 }, (_, f) => {
        const p = f / 12;
        const t = p * life;
        const px = x - 6 + vx * t;
        const py = y - 6 + vy * t + 0.5 * 560 * t * t;
        return { transform: `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${(spin * t).toFixed(1)}deg) scale(${f === 0 ? 0.4 : 1 - p * 0.25})`, opacity: p < 0.5 ? 1 : 1 - (p - 0.5) * 2, offset: p };
      });
      const run = el.animate(frames, { duration: life * 1000, easing: "linear", fill: "forwards" });
      run.finished.then(
        () => el.remove(),
        () => el.remove(),
      );
    }
  }, []);

  const centre = React.useCallback((el: HTMLElement) => {
    const r = root.current!.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 };
  }, []);

  const commit = React.useCallback((next: Reaction[]) => {
    const l = latest.current;
    l.list = next;
    if (!l.controlled) setInternal(next);
    l.onValueChange?.(next);
  }, []);

  const react = React.useCallback(
    async (emoji: string, on: boolean, from?: Flight["from"]) => {
      const l = latest.current;
      commit(toggle(l.list, emoji, on));
      const name = l.labelOf(emoji);
      setSaid(on ? `You reacted with ${name}` : `Removed your ${name} reaction`);
      if (on && from && !l.reduced) setFlight({ id: ++flights.current, emoji, from });
      else if (on && !l.reduced) {
        const slot = chips.current.get(emoji)?.slot();
        if (slot) {
          const c = centre(slot);
          burst(emoji, c.x, c.y);
        }
      }
      try {
        await l.onReact?.(emoji, on);
      } catch {
        commit(toggle(latest.current.list, emoji, !on));
        setSaid(on ? `Couldn't add ${name}` : `Couldn't remove ${name}`);
        const chip = chips.current.get(emoji);
        if (chip && latest.current.list.some((r) => r.emoji === emoji)) chip.shake();
        else if (!latest.current.reduced) trigger.current?.animate([{ translate: "0" }, { translate: "-4px" }, { translate: "4px" }, { translate: "-3px" }, { translate: "0" }], { duration: 380, easing: "ease-out" });
      }
    },
    [burst, centre, commit],
  );

  const anchorEl = React.useRef<HTMLElement | null>(null);
  const openTray = React.useCallback((keyboard: boolean, anchor?: HTMLElement) => {
    const r = root.current;
    const t = anchor ?? trigger.current;
    if (!r || !t) return;
    anchorEl.current = t;
    const count = latest.current.choices.length;
    const width = trayWidth(count);
    const box = r.getBoundingClientRect();
    const at = t.getBoundingClientRect();
    const cx = at.left - box.left + at.width / 2;
    const offsetTop = at.top - box.top;
    let minX = 0;
    let maxX = document.documentElement.clientWidth;
    let minY = 0;
    for (let el = r.parentElement; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.overflowX === "visible" && style.overflowY === "visible") continue;
      const clip = el.getBoundingClientRect();
      minX = Math.max(minX, clip.left);
      maxX = Math.min(maxX, clip.right);
      minY = Math.max(minY, clip.top);
    }
    let left = cx - width / 2;
    left = Math.min(left, maxX - 8 - box.left - width);
    left = Math.max(left, minX + 8 - box.left);
    const above = at.top - TRAY_H - 10 > minY + 8;
    const top = above ? offsetTop - TRAY_H - 6 : offsetTop + at.height + 6;
    setPlace({ left, top, side: above ? "top" : "bottom", originX: cx - left, originY: above ? TRAY_H + 6 + at.height / 2 : -6 - at.height / 2 });
    setFocusTray(keyboard);
    setPhase("open");
  }, []);

  const closeTray = React.useCallback((returnFocus: boolean) => {
    if (latest.current.phase === "closed") return;
    setPhase("closing");
    if (returnFocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  const pickIndex = React.useCallback(
    (index: number, keyboard: boolean) => {
      const choice = latest.current.choices[index];
      if (!choice) return;
      if (choice.more) {
        const from = anchorEl.current ?? trigger.current;
        if (from) latest.current.onMore?.(from);
        return;
      }
      const on = !latest.current.list.some((r) => r.emoji === choice.emoji && r.mine);
      const from = tray.current?.origin(index);
      closeTray(keyboard);
      void react(choice.emoji, on, from);
    },
    [closeTray, react],
  );

  const stopAuto = React.useCallback(() => {
    auto.current.forEach(window.clearTimeout);
    auto.current = [];
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      open(anchor) {
        stopAuto();
        if (latest.current.phase !== "open") openTray(false, anchor);
      },
      close() {
        closeTray(false);
      },
      react(emoji) {
        stopAuto();
        void react(emoji, !latest.current.list.some((r) => r.emoji === emoji && r.mine));
      },
      pick(emoji) {
        stopAuto();
        const index = latest.current.choices.findIndex((c) => c.emoji === emoji && !c.more);
        if (index < 0) return;
        if (latest.current.reduced) {
          void react(emoji, !latest.current.list.some((r) => r.emoji === emoji && r.mine));
          return;
        }
        if (latest.current.phase !== "open") openTray(false);
        let at = 300;
        for (let k = 0; k <= index; k++) {
          auto.current.push(window.setTimeout(() => tray.current?.setActive(k), at));
          at += 120;
        }
        auto.current.push(window.setTimeout(() => pickIndex(index, false), at + 320));
      },
    }),
    [openTray, closeTray, pickIndex, react, stopAuto],
  );

  React.useEffect(() => {
    if (phase !== "open") return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!root.current?.contains(target) && !target.closest?.("[data-reaction-popup]")) closeTray(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [phase, closeTray]);

  React.useLayoutEffect(() => {
    if (!flight) return;
    const el = flyer.current;
    const slot = chips.current.get(flight.emoji)?.slot();
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      if (el) el.style.visibility = "hidden";
      setFlight((f) => (f?.id === flight.id ? null : f));
    };
    if (!el || !slot || !root.current) {
      const frame = requestAnimationFrame(land);
      return () => cancelAnimationFrame(frame);
    }
    const to = centre(slot);
    const s = { x: null as Spring | null, y: null as Spring | null, s: null as Spring | null };
    const paint = () => {
      if (!s.x || !s.y || !s.s) return;
      el.style.transform = `translate3d(${(s.x.get() - GLYPH / 2).toFixed(2)}px, ${(s.y.get() - GLYPH / 2).toFixed(2)}px, 0) scale(${s.s.get().toFixed(4)})`;
      const resting = [s.x, s.y, s.s].every((spring) => spring.get() === spring.getTarget() && spring.getVelocity() === 0);
      if (resting && !landed) {
        chips.current.get(flight.emoji)?.land();
        burst(flight.emoji, to.x, to.y);
        land();
      }
    };
    s.x = createSpring(flight.from.x, FLY_X, paint, 0.4);
    s.y = createSpring(flight.from.y, FLY_Y, paint, 0.4);
    s.s = createSpring(flight.from.s, FLY_S, paint, 0.004);
    el.textContent = flight.emoji;
    el.style.visibility = "visible";
    paint();
    s.x.set(to.x);
    s.y.set(to.y);
    s.s.set(CHIP_GLYPH / GLYPH);
    return () => {
      s.x?.stop();
      s.y?.stop();
      s.s?.stop();
      el.style.visibility = "hidden";
    };
  }, [flight, burst, centre]);

  const toggleChip = React.useCallback(
    (emoji: string) => {
      stopAuto();
      const on = !latest.current.list.some((r) => r.emoji === emoji && r.mine);
      void react(emoji, on);
    },
    [react, stopAuto],
  );

  const open = phase === "open";

  return (
    <div ref={root} role="group" aria-label="Reactions" className={`relative flex flex-wrap items-center ${className}`}>
      {rows.map(({ reaction, leaving }) => (
        <Chip
          key={reaction.emoji}
          reaction={reaction}
          label={labelOf(reaction.emoji)}
          leaving={leaving}
          animateIn={ready}
          awaiting={flight?.emoji === reaction.emoji}
          quiet={phase !== "closed"}
          reduced={reduced}
          register={register}
          onToggle={toggleChip}
        />
      ))}

      <span className={hideTrigger ? "hidden" : "inline-flex py-0.5"} aria-hidden={hideTrigger || undefined}>
        <button
          ref={trigger}
          tabIndex={hideTrigger ? -1 : undefined}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? trayId : undefined}
          className={`grid size-8 cursor-pointer touch-none select-none place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--border)] transition-colors [-webkit-touch-callout:none] ${
            open ? "bg-accent text-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          } ${INTERACTION_PRESS} ${INTERACTION_FOCUS}`}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            stopAuto();
            const box = root.current?.getBoundingClientRect();
            press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, wasOpen: latest.current.phase === "open", rootX: box?.left ?? 0, rootY: box?.top ?? 0 };
            if (latest.current.phase !== "open") openTray(false);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const p = press.current;
            if (!p || p.id !== event.pointerId) return;
            if (!p.dragging && Math.hypot(event.clientX - p.x, event.clientY - p.y) < 7) return;
            p.dragging = true;
            tray.current?.setActive(tray.current.indexAt(event.clientX - p.rootX, event.clientY - p.rootY));
          }}
          onPointerUp={(event) => {
            const p = press.current;
            press.current = null;
            if (!p || p.id !== event.pointerId) return;
            if (p.dragging) {
              const index = tray.current?.indexAt(event.clientX - p.rootX, event.clientY - p.rootY) ?? -1;
              if (index >= 0) pickIndex(index, false);
              else closeTray(false);
            } else if (p.wasOpen) closeTray(false);
          }}
          onPointerCancel={() => {
            press.current = null;
          }}
          onClick={(event) => {
            if (event.detail !== 0) return;
            if (latest.current.phase === "open") closeTray(true);
            else openTray(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              closeTray(true);
            } else if ((event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowRight") && open) {
              event.preventDefault();
              tray.current?.focus(0);
            } else if (event.key === "ArrowUp" && !open) {
              event.preventDefault();
              openTray(true);
            }
          }}
        >
          <SmilePlus open={open} reduced={reduced} />
        </button>
      </span>

      {phase !== "closed" && place && (
        <ReactionTray
          ref={tray}
          id={trayId}
          choices={choices}
          mine={mine}
          place={place}
          closing={phase === "closing"}
          reduced={reduced}
          autoFocus={focusTray}
          onPick={pickIndex}
          onClose={closeTray}
          onClosed={() => setPhase((p) => (p === "closing" ? "closed" : p))}
        />
      )}

      <span ref={flyer} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-30 flex justify-center leading-none will-change-transform" style={{ fontSize: GLYPH, visibility: "hidden", width: GLYPH, height: GLYPH }} />
      <span ref={sparks} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-30" />
      <span role="status" className="sr-only">
        {said}
      </span>
    </div>
  );
}

export default Reactions;
