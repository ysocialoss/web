import { useSyncExternalStore } from "react";
import { z } from "zod/mini";
import { sendRequest } from "@/lib/api";

const schema = z.object({
  anniversary: z._default(z.boolean(), false),
  christmasSeason: z._default(z.boolean(), false),
  christmasEve: z._default(z.boolean(), false),
  adventSeason: z._default(z.boolean(), false),
  giftSeason: z._default(z.boolean(), false),
  eveStarSince: z._default(z.number(), Infinity),
  branding: z._default(z.nullable(z.string()), null),
  hatSide: z._default(z.nullable(z.enum(["left", "right"])), null),
});

export type Celebrations = z.infer<typeof schema>;

const responseSchema = z.object({ ...schema.shape, now: z.iso.datetime() });

const REFRESH_MS = 5 * 60_000;
const none: Celebrations = {
  anniversary: false,
  christmasSeason: false,
  christmasEve: false,
  adventSeason: false,
  giftSeason: false,
  eveStarSince: Infinity,
  branding: null,
  hatSide: null,
};

let current = none;
let clock: { server: number; local: number } | null = null;
const listeners = new Set<() => void>();
let timer: number | undefined;

export async function refreshCelebrations() {
  try {
    const { now, ...next } = await sendRequest("/api/celebrations", responseSchema);
    clock = { server: Date.parse(now), local: performance.now() };
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next;
    listeners.forEach((listener) => listener());
  } catch {
    return;
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") void refreshCelebrations();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshCelebrations();
    timer = window.setInterval(refreshCelebrations, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

export const serverNow = () => (clock ? clock.server + (performance.now() - clock.local) : 0);

export const useCelebrations = () => useSyncExternalStore(subscribe, () => current, () => none);
