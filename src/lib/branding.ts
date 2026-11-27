import { useSyncExternalStore } from "react";
import { useCelebrations } from "@/lib/celebrations";

export type BrandingId =
  | "world-cancer-day"
  | "black-history-month"
  | "earth-day"
  | "pride-month"
  | "christmas-eve"
  | "anniversary";

type Artwork = { src: string; width: number; height: number };

export type Variation = {
  id: BrandingId;
  name: string;
  href: string;
  wordmark: Artwork;
  logo: Artwork;
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
    occasion: "February 4",
  },
  {
    id: "earth-day",
    name: "Earth Day",
    href: "https://www.earthday.org/",
    wordmark: art("earth-day", "wordmark", 427, 191),
    logo: art("earth-day", "logo", 306, 189),
    occasion: "April 22",
  },
  {
    id: "black-history-month",
    name: "Black History Month",
    href: "https://www.blackhistorymonth.gov/",
    wordmark: art("black-history-month", "wordmark", 427, 161),
    logo: art("black-history-month", "logo", 306, 189),
    occasion: "February",
  },
  {
    id: "pride-month",
    name: "Pride Month",
    href: "https://www.loc.gov/lgbt-pride-month/",
    wordmark: art("pride-month", "wordmark", 427, 161),
    logo: art("pride-month", "logo", 306, 189),
    occasion: "June",
  },
];

export const christmasEve: Variation = {
  id: "christmas-eve",
  name: "Merry Christmas",
  href: "/",
  wordmark: { src: "/branding/christmas-eve-wordmark.svg", width: 427, height: 193 },
  logo: { src: "/favicon-christmas.png", width: 320, height: 320 },
  occasion: "December 24",
};

export const ANNIVERSARY_MESSAGE = "It's ysocial's 1 month anniversary!";

export const anniversary: Variation = {
  id: "anniversary",
  name: "ysocial turns one month",
  href: "/",
  wordmark: { src: "/branding/anniversary-wordmark.png", width: 427, height: 185 },
  logo: { src: "/favicon.png", width: 320, height: 320 },
  occasion: "December 17",
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

export function resolveBranding(preference: BrandingPreference, automatic: Variation | null): Variation | null {
  if (preference === "default") return null;
  if (preference === "auto") return automatic;
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

export function useBranding() {
  const preference = useSyncExternalStore(subscribe, () => current, () => "auto" as const);
  const celebrations = useCelebrations();
  const automatic = variations.find((variation) => variation.id === celebrations.branding) ?? null;
  return {
    preference,
    active: celebrations.anniversary
      ? anniversary
      : celebrations.christmasEve
        ? christmasEve
        : resolveBranding(preference, automatic),
    automatic,
    setPreference: setBrandingPreference,
  };
}
