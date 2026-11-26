import { useEffect, useState, useSyncExternalStore } from "react";

export type BrandingId =
  | "world-cancer-day"
  | "black-history-month"
  | "earth-day"
  | "pride-month"
  | "christmas-eve";

type Artwork = { src: string; width: number; height: number };

export type Variation = {
  id: BrandingId;
  name: string;
  href: string;
  wordmark: Artwork;
  logo: Artwork;
  when: (month: number, day: number) => boolean;
  priority: number;
  occasion: string;
};

const art = (slug: string, kind: "wordmark" | "logo", width: number, height: number): Artwork => ({
  src: `/branding/${slug}-${kind}.png`,
  width,
  height,
});

export const variations: readonly Variation[] = [
  {
    id: "world-cancer-day",
    name: "World Cancer Day",
    href: "https://www.worldcancerday.org/",
    wordmark: art("world-cancer-day", "wordmark", 538, 161),
    logo: art("world-cancer-day", "logo", 306, 189),
    when: (month, day) => month === 1 && day === 4,
    priority: 2,
    occasion: "February 4",
  },
  {
    id: "earth-day",
    name: "Earth Day",
    href: "https://www.earthday.org/",
    wordmark: art("earth-day", "wordmark", 427, 191),
    logo: art("earth-day", "logo", 306, 189),
    when: (month, day) => month === 3 && day === 22,
    priority: 2,
    occasion: "April 22",
  },
  {
    id: "black-history-month",
    name: "Black History Month",
    href: "https://www.blackhistorymonth.gov/",
    wordmark: art("black-history-month", "wordmark", 427, 161),
    logo: art("black-history-month", "logo", 306, 189),
    when: (month) => month === 1,
    priority: 1,
    occasion: "February",
  },
  {
    id: "pride-month",
    name: "Pride Month",
    href: "https://www.loc.gov/lgbt-pride-month/",
    wordmark: art("pride-month", "wordmark", 427, 161),
    logo: art("pride-month", "logo", 306, 189),
    when: (month) => month === 5,
    priority: 1,
    occasion: "June",
  },
];

export const christmasEve: Variation = {
  id: "christmas-eve",
  name: "Merry Christmas",
  href: "/",
  wordmark: { src: "/branding/christmas-eve-wordmark.svg", width: 427, height: 193 },
  logo: { src: "/favicon-christmas.png", width: 320, height: 320 },
  when: (month, day) => month === 11 && day === 24,
  priority: 3,
  occasion: "December 24",
};

export const MAIN_WORDMARK: Artwork = { src: "/wordmark.svg", width: 427, height: 161 };
export const MAIN_LOGO: Artwork = { src: "/favicon.png", width: 320, height: 320 };

export type BrandingPreference = "auto" | "default" | BrandingId;

export function isBrandingPreference(value: unknown): value is BrandingPreference {
  return (
    value === "auto" ||
    value === "default" ||
    variations.some((variation) => variation.id === value)
  );
}

export function variationOn(date: Date): Variation | null {
  const month = date.getMonth();
  const day = date.getDate();
  let best: Variation | null = null;
  for (const variation of variations) {
    if (variation.when(month, day) && (!best || variation.priority > best.priority))
      best = variation;
  }
  return best;
}

export function resolveBranding(preference: BrandingPreference, date: Date): Variation | null {
  if (preference === "default") return null;
  if (preference === "auto") return variationOn(date);
  return variations.find((variation) => variation.id === preference) ?? null;
}

const KEY = "branding";
const listeners = new Set<() => void>();

function readPreference(): BrandingPreference {
  try {
    const stored = localStorage.getItem(KEY);
    if (isBrandingPreference(stored)) return stored;
  } catch {
    return "auto";
  }
  return "auto";
}

let current = readPreference();

export function setBrandingPreference(next: BrandingPreference) {
  current = next;
  try {
    if (next === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    current = next;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY && event.key !== null) return;
    current = readPreference();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function useToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      const now = new Date();
      setToday((previous) =>
        previous.toDateString() === now.toDateString() ? previous : now,
      );
      window.clearTimeout(timer);
      const midnight = new Date(now);
      midnight.setHours(24, 0, 1, 0);
      timer = window.setTimeout(update, midnight.getTime() - now.getTime());
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}

export function useBranding() {
  const preference = useSyncExternalStore(subscribe, () => current, () => "auto" as const);
  const today = useToday();
  const { active: christmasEveOn } = useSeasonal("wordmark");
  return {
    preference,
    active: christmasEveOn ? christmasEve : resolveBranding(preference, today),
    automatic: variationOn(today),
    setPreference: setBrandingPreference,
  };
}

export function isChristmasSeason(date: Date) {
  return date.getMonth() === 11 && date.getDate() <= 24;
}

export type SeasonalFeature = "hats" | "favicon" | "wordmark";

export function useSeasonal(feature: SeasonalFeature) {
  const today = useToday();
  const natural = feature === "wordmark" ? christmasEve.when(today.getMonth(), today.getDate()) : isChristmasSeason(today);
  return { active: natural };
}

export const useSantaHats = () => useSeasonal("hats");
