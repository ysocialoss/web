
"use client";

import * as React from "react";


export interface NumberRollProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  value: number;
  format?: Intl.NumberFormatOptions;
  locales?: string | string[];
  prefix?: string;
  suffix?: string;
  from?: number;
  duration?: number;
  direction?: "up" | "down";
}

type Column = { key: string; char: string; digit: number | null };

const EASE = "cubic-bezier(0.16,1,0.3,1)";
const SETS = 5;
const MIDDLE = 20;
const STRIP = Array.from({ length: SETS * 10 }, (_, i) => i % 10).join("\n");

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useReducedMotion = () =>
  React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);

const HYDRATION_LOCALE = "en-US";
const subscribeNothing = () => () => {};
const useHydrated = () =>
  React.useSyncExternalStore(subscribeNothing, () => true, () => false);

function columns(text: string): Column[] {
  const chars = [...text];
  const seen = new Map<string, number>();
  let place = 0;
  const out: Column[] = [];
  for (let i = chars.length - 1; i >= 0; i--) {
    const char = chars[i];
    if (/\d/.test(char)) out.push({ key: `d${place++}`, char, digit: Number(char) });
    else {
      const n = seen.get(char) ?? 0;
      seen.set(char, n + 1);
      out.push({ key: `s${char}${n}`, char, digit: null });
    }
  }
  return out.reverse();
}

const Digit = React.memo(function Digit({ digit, trend, duration, reduced, rollIn }: { digit: number; trend: number; duration: number; reduced: boolean; rollIn: boolean }) {
  const [start] = React.useState(() => MIDDLE + (rollIn ? 0 : digit));
  const posRef = React.useRef(start);
  const stripRef = React.useRef<HTMLSpanElement>(null);

  const place = React.useCallback(
    (pos: number, animate: boolean) => {
      const strip = stripRef.current;
      if (!strip) return;
      strip.style.transition = animate ? `transform ${duration}ms ${EASE}` : "none";
      strip.style.transform = `translateY(${(-pos * 100) / (SETS * 10)}%)`;
    },
    [duration],
  );

  React.useLayoutEffect(() => {
    const current = posRef.current;
    const showing = ((current % 10) + 10) % 10;
    if (showing === digit) return;
    if (reduced) {
      posRef.current = MIDDLE + digit;
      place(posRef.current, false);
      return;
    }
    const up = trend > 0 || (trend === 0 && digit > showing);
    let target = up ? current + ((digit - showing + 10) % 10) : current - ((showing - digit + 10) % 10);
    if (target < 10 || target > SETS * 10 - 11) {
      const shift = Math.round((target - MIDDLE) / 10) * 10;
      const strip = stripRef.current;
      if (strip?.offsetHeight) {
        let visual: number;
        try {
          visual = -new DOMMatrixReadOnly(getComputedStyle(strip).transform).m42 / (strip.offsetHeight / (SETS * 10));
        } catch {
          visual = current;
        }
        strip.style.transition = "none";
        strip.style.transform = `translateY(${(-(visual - shift) * 100) / (SETS * 10)}%)`;
        void strip.offsetHeight;
      }
      target -= shift;
    }
    posRef.current = target;
    place(target, true);
  }, [digit, trend, reduced, place]);

  const settle = () => {
    posRef.current = MIDDLE + (((posRef.current % 10) + 10) % 10);
    place(posRef.current, false);
  };

  return (
    <span className="relative inline-block [clip-path:inset(0)]">
      <span className="invisible">{digit}</span>
      <span
        ref={stripRef}
        aria-hidden="true"
        onTransitionEnd={settle}
        className="absolute inset-x-0 top-0 block whitespace-pre text-center"
        style={{ transform: `translateY(${(-start * 100) / (SETS * 10)}%)` }}
      >
        {STRIP}
      </span>
    </span>
  );
});

function Place({ enter, children }: { enter: boolean; children: React.ReactNode }) {
  const [entering] = React.useState(enter);
  return (
    <span className={`inline-block ${entering ? "[clip-path:inset(0)] animate-[ui-col-in_500ms_cubic-bezier(0.16,1,0.3,1)_both]" : ""}`}>
      {children}
    </span>
  );
}

const NOTHING_NEW: ReadonlySet<string> = new Set();

export function NumberRoll({ value, format, locales, prefix = "", suffix = "", from, duration = 900, direction, className = "", ...props }: NumberRollProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(from ?? value);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const hydrated = useHydrated();
  const locale = locales ?? (hydrated ? undefined : HYDRATION_LOCALE);
  const localeKey = String(locale);
  const formatter = React.useMemo(() => new Intl.NumberFormat(locale, format), [localeKey, format && JSON.stringify(format)]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = `${prefix}${formatter.format(shown)}${suffix}`;
  const cols = React.useMemo(() => columns(text), [text]);

  const [last, setLast] = React.useState({ text, cols, shown, localeKey, snap: false, moved: 0, entering: NOTHING_NEW, leaving: [] as Column[] });
  let view = last;
  if (last.text !== text || last.shown !== shown || last.localeKey !== localeKey) {
    const before = new Set(last.cols.map((c) => c.key));
    const after = new Set(cols.map((c) => c.key));
    const snap = last.localeKey !== localeKey && last.shown === shown;
    view = {
      text,
      cols,
      shown,
      localeKey,
      snap,
      moved: Math.sign(shown - last.shown),
      entering: snap ? NOTHING_NEW : new Set(cols.filter((c) => !before.has(c.key)).map((c) => c.key)),
      leaving: reduced || snap ? [] : last.cols.filter((c) => !after.has(c.key)),
    };
    setLast(view);
  }
  const still = reduced || view.snap;
  const trend = direction === "up" ? 1 : direction === "down" ? -1 : view.moved;

  React.useEffect(() => {
    if (!last.leaving.length) return;
    const timer = window.setTimeout(() => setLast((l) => ({ ...l, leaving: [] })), 420);
    return () => window.clearTimeout(timer);
  }, [last.leaving]);

  return (
    <span className={`inline-flex tabular-nums [contain:paint] ${className}`} {...props}>
      <span className="sr-only">{`${prefix}${formatter.format(value)}${suffix}`}</span>
      <span aria-hidden="true" className="inline-flex items-baseline whitespace-pre">
        {view.leaving.map((c) => (
          <span key={`out-${c.key}`} className="inline-block [clip-path:inset(0)] animate-[ui-col-out_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
            {c.char}
          </span>
        ))}
        {cols.map((c) => {
          const isNew = view.entering.has(c.key);
          return (
            <Place key={c.key} enter={isNew && !still}>
              {c.digit === null ? c.char : <Digit digit={c.digit} trend={trend} duration={duration} reduced={still} rollIn={isNew} />}
            </Place>
          );
        })}
      </span>
    </span>
  );
}
