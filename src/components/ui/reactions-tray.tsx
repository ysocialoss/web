
"use client";

import * as React from "react";
import { TextMorph } from "./text-morph";
import { INTERACTION_FOCUS, createSpring, type Spring } from "./ui-interaction-motion";


export interface ReactionChoice {
  emoji: string;
  label: string;
  more?: boolean;
  icon?: React.ReactNode;
}

export interface TrayPlacement {
  left: number;
  top: number;
  cell: number;
  viewportWidth: number;
  viewportHeight: number;
  originX: number;
  originY: number;
  side: "top" | "bottom";
}

export interface TrayHandle {
  setActive: (index: number) => void;
  indexAt: (x: number, y: number) => number;
  origin: (index: number) => { x: number; y: number; s: number };
  focus: (index: number) => void;
}

export const CELL = 42;
export const PAD = 4;
export const TRAY_H = 50;
const BUTTON = 32;
export const GLYPH = 34;
const REST = 0.66;
const NEAR = 0.8;
const LIFT = -10;
const NEAR_LIFT = -3;

const OPEN = { stiffness: 320, damping: 29 };
const SWELL = { stiffness: 620, damping: 38 };
const TAG = { stiffness: 520, damping: 42 };

interface TrayProps {
  id: string;
  choices: ReactionChoice[];
  mine: ReadonlySet<string>;
  place: TrayPlacement;
  closing: boolean;
  reduced: boolean;
  autoFocus: boolean;
  onPick: (index: number, keyboard: boolean) => void;
  onClose: (returnFocus: boolean) => void;
  onClosed: () => void;
  ref?: React.Ref<TrayHandle>;
}

export function ReactionTray({ id, choices, mine, place, closing, reduced, autoFocus, onPick, onClose, onClosed, ref }: TrayProps) {
  const surface = React.useRef<HTMLDivElement>(null);
  const pill = React.useRef<HTMLSpanElement>(null);
  const tag = React.useRef<HTMLSpanElement>(null);
  const tagWidth = React.useRef(0);
  const glyphs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const cells = React.useRef<(HTMLButtonElement | null)[]>([]);
  const springs = React.useRef<{ open: Spring; tagX: Spring; scale: Spring[]; lift: Spring[] } | null>(null);
  const active = React.useRef(-1);
  const closingRef = React.useRef(closing);
  const finished = React.useRef(false);
  const closedRef = React.useRef(onClosed);
  const [label, setLabel] = React.useState(-1);
  const [focusIndex, setFocusIndex] = React.useState(0);
  const count = choices.length;
  const { cell } = place;
  const width = count * cell + PAD * 2;

  React.useLayoutEffect(() => {
    closedRef.current = onClosed;
  });

  const paint = React.useCallback(() => {
    const s = springs.current;
    const el = surface.current;
    if (!s || !el) return;
    const t = s.open.get();
    const g = Math.max(0, t);
    const w = BUTTON + (width - BUTTON) * Math.min(g, 1);
    const h = BUTTON + (TRAY_H - BUTTON) * Math.min(g, 1);
    const cx = place.originX + (width / 2 - place.originX) * Math.min(g, 1);
    const cy = place.originY + (TRAY_H / 2 - place.originY) * Math.min(g, 1);
    const left = Math.max(0, Math.min(width - w, cx - w / 2));
    const top = cy - h / 2;
    if (pill.current) {
      pill.current.style.width = `${w.toFixed(2)}px`;
      pill.current.style.height = `${h.toFixed(2)}px`;
      pill.current.style.transform = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
      pill.current.style.opacity = `${Math.min(1, g * 6)}`;
    }
    s.scale.forEach((spring, i) => {
      const glyph = glyphs.current[i];
      if (!glyph) return;
      glyph.style.transform = `translate3d(0, ${s.lift[i].get().toFixed(2)}px, 0) scale(${spring.get().toFixed(4)})`;
      const x = PAD + (i + 0.5) * cell;
      const inside = Math.min(x - left, left + w - x) - 6;
      glyph.style.opacity = `${Math.max(0, Math.min(1, inside / 14, (h - BUTTON) / 8))}`;
    });
    if (tag.current) {
      const inset = 4 + tagWidth.current / 2;
      const x = Math.max(inset, Math.min(place.left + s.tagX.get(), place.viewportWidth - inset));
      tag.current.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    }
    if (closingRef.current && t <= 0.02 && !finished.current) {
      finished.current = true;
      closedRef.current();
    }
  }, [cell, place, width]);

  React.useLayoutEffect(() => {
    const element = tag.current;
    if (!element) return;
    const measure = () => {
      tagWidth.current = element.offsetWidth;
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [paint]);

  const aim = React.useCallback(
    (index: number) => {
      const s = springs.current;
      if (!s || index === active.current) return;
      const was = active.current;
      active.current = index;
      s.scale.forEach((spring, i) => {
        const d = index < 0 ? 9 : Math.abs(i - index);
        const scale = d === 0 ? 1 : d === 1 ? NEAR : REST;
        const lift = d === 0 ? LIFT : d === 1 ? NEAR_LIFT : 0;
        if (reduced) {
          spring.jump(scale);
          s.lift[i].jump(lift);
        } else {
          spring.set(scale);
          s.lift[i].set(lift);
        }
      });
      if (index >= 0) {
        const x = PAD + (index + 0.5) * cell;
        if (was < 0 || reduced) s.tagX.jump(x);
        else s.tagX.set(x);
      }
      setLabel(index);
    },
    [cell, reduced],
  );

  React.useLayoutEffect(() => {
    const s = {
      open: createSpring(0, OPEN, paint, 0.004),
      tagX: createSpring(PAD + cell / 2, TAG, paint, 0.2),
      scale: choices.map(() => createSpring(0.3, SWELL, paint, 0.002)),
      lift: choices.map(() => createSpring(8, SWELL, paint, 0.05)),
    };
    springs.current = s;
    const timers: number[] = [];
    if (reduced) {
      s.open.jump(1);
      s.scale.forEach((spring) => spring.jump(REST));
      s.lift.forEach((spring) => spring.jump(0));
    } else {
      paint();
      s.open.set(1);
      s.scale.forEach((spring, i) =>
        timers.push(
          window.setTimeout(
            () => {
              if (active.current >= 0) return;
              spring.set(REST);
              s.lift[i].set(0);
            },
            30 + Math.abs(PAD + (i + 0.5) * cell - place.originX) * 0.42,
          ),
        ),
      );
    }
    return () => {
      timers.forEach(window.clearTimeout);
      s.open.stop();
      s.tagX.stop();
      s.scale.forEach((spring) => spring.stop());
      s.lift.forEach((spring) => spring.stop());
      springs.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    closingRef.current = closing;
    const s = springs.current;
    if (!s) return;
    if (closing) {
      finished.current = false;
      if (reduced) s.open.jump(0);
      else s.open.set(0);
    } else {
      finished.current = false;
      if (reduced) s.open.jump(1);
      else s.open.set(1);
    }
  }, [closing, reduced]);

  React.useEffect(() => {
    if (autoFocus) cells.current[0]?.focus({ preventScroll: true });
  }, [autoFocus]);

  React.useImperativeHandle(
    ref,
    () => ({
      setActive: aim,
      indexAt(x, y) {
        const local = x - place.left - PAD;
        if (local < -6 || local > count * cell + 6) return -1;
        if (y < place.top - 64 || y > place.top + TRAY_H + 64) return -1;
        return Math.max(0, Math.min(count - 1, Math.floor(local / cell)));
      },
      origin(index) {
        const s = springs.current;
        return {
          x: place.left + PAD + (index + 0.5) * cell,
          y: place.top + TRAY_H / 2 + (s?.lift[index].get() ?? 0),
          s: s?.scale[index].get() ?? REST,
        };
      },
      focus(index) {
        cells.current[index]?.focus({ preventScroll: true });
      },
    }),
    [aim, cell, count, place],
  );

  const move = (event: React.KeyboardEvent, index: number) => {
    event.preventDefault();
    const next = (index + count) % count;
    cells.current[next]?.focus({ preventScroll: true });
  };

  return (
    <>
      <div
        ref={surface}
        id={id}
        data-reaction-popup=""
        role="menu"
        aria-label="Add reaction"
        aria-orientation="horizontal"
        inert={closing}
        className={`fixed z-[60] flex p-1 text-popover-foreground ${closing ? "pointer-events-none" : ""}`}
        style={{
          left: place.left,
          top: place.top,
          height: TRAY_H,
          width,
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && !surface.current?.contains(document.activeElement)) aim(-1);
        }}
        onKeyDown={(event) => {
          const index = cells.current.findIndex((cell) => cell === document.activeElement);
          if (event.key === "ArrowRight") move(event, index + 1);
          else if (event.key === "ArrowLeft") move(event, index - 1);
          else if (event.key === "Home") move(event, 0);
          else if (event.key === "End") move(event, count - 1);
          else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose(true);
          } else if (event.key === "Tab") onClose(false);
        }}
      >
        <span
          ref={pill}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-full bg-popover shadow-[0_0_0_1px_var(--border)] will-change-transform"
          style={{ width: BUTTON, height: BUTTON, opacity: 0 }}
        />
        {choices.map((choice, i) => {
          const on = mine.has(choice.emoji);
          return (
            <button
              key={choice.emoji}
              ref={(el) => {
                cells.current[i] = el;
              }}
              type="button"
              role="menuitemcheckbox"
              aria-checked={on}
              aria-label={choice.label}
              tabIndex={i === focusIndex ? 0 : -1}
              className={`relative grid shrink-0 cursor-pointer place-items-center rounded-full outline-none ${INTERACTION_FOCUS} focus-visible:ring-offset-0`}
              style={{ width: cell, height: TRAY_H - PAD * 2 }}
              onFocus={() => {
                setFocusIndex(i);
                aim(i);
              }}
              onPointerMove={(event) => {
                if (event.pointerType === "mouse") aim(i);
              }}
              onClick={(event) => onPick(i, event.detail === 0)}
            >
              <span
                aria-hidden="true"
                className="absolute bottom-[3px] size-1 rounded-full bg-foreground transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ opacity: on ? 1 : 0, scale: on ? 1 : 0.4 }}
              />
              <span
                ref={(el) => {
                  glyphs.current[i] = el;
                }}
                aria-hidden="true"
                className="pointer-events-none block select-none text-center leading-none will-change-transform"
                style={{ fontSize: Math.min(GLYPH, cell - 2), transform: `translate3d(0, 8px, 0) scale(0.3)`, opacity: 0 }}
              >
                {choice.icon ? <span className="grid place-items-center text-muted-foreground [&_svg]:size-[0.72em] [&_svg]:stroke-[1.75]">{choice.icon}</span> : choice.emoji}
              </span>
            </button>
          );
        })}
      </div>
      <span
        ref={tag}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 z-[61] will-change-transform"
        style={{ top: Math.max(4, Math.min(place.side === "top" ? place.top - 30 : place.top + TRAY_H + 8, place.viewportHeight - 26)) }}
      >
        <span
          className="block whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[11.5px] font-medium leading-[18px] text-background transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ opacity: label >= 0 && !closing ? 1 : 0, translate: label >= 0 && !closing ? "-50% 0" : `-50% ${place.side === "top" ? 4 : -4}px` }}
        >
          <TextMorph duration={300} animateWidth={false}>
            {label >= 0 ? choices[label].label : choices[0].label}
          </TextMorph>
        </span>
      </span>
    </>
  );
}
