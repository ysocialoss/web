import { useSyncExternalStore } from "react";
import { z } from "zod/mini";
import { sendRequest } from "@/lib/api";
import { useNow } from "@/hooks/use-now";
import { serverNow } from "@/lib/celebrations";

export const ADVENT_DOORS = 24;

const GIFT_HIDDEN_KEY = "advent:gift-hidden";

export type Reward = { year: number; day: number; enabled: boolean; doorsOpened: number | null };

type State = {
  open: boolean;
  rewards: readonly Reward[] | null;
  year: number | null;
  opened: ReadonlySet<number>;
  loading: boolean;
  error: unknown;
  giftHidden: boolean;
};

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked.
  }
}

let state: State = {
  open: false,
  rewards: null,
  year: null,
  opened: new Set(),
  loading: false,
  error: null,
  giftHidden: readFlag(GIFT_HIDDEN_KEY),
};
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useAdventState = () => useSyncExternalStore(subscribe, () => state, () => state);

const berlinFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function berlinClock() {
  const part = Object.fromEntries(berlinFormat.formatToParts(serverNow()).map((entry) => [entry.type, Number(entry.value)]));
  return new Date(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
}

export function useAdventNow() {
  useNow();
  return berlinClock();
}

const secondListeners = new Set<() => void>();
let second = Date.now();
let secondTimer: number | undefined;

function subscribeSecond(listener: () => void) {
  secondListeners.add(listener);
  if (secondTimer === undefined) {
    second = Date.now();
    secondTimer = window.setInterval(() => {
      second = Date.now();
      secondListeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    secondListeners.delete(listener);
    if (secondListeners.size === 0 && secondTimer !== undefined) {
      window.clearInterval(secondTimer);
      secondTimer = undefined;
    }
  };
}

export function useAdventSecond() {
  useSyncExternalStore(subscribeSecond, () => second, () => second);
  return berlinClock();
}

export function adventDay(date: Date) {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

const doorsSchema = z.object({ year: z.number(), opened: z.array(z.number()) });
const rewardsSchema = z.object({
  rewards: z.array(
    z.object({
      year: z.number(),
      day: z.number(),
      enabled: z.boolean(),
      doorsOpened: z._default(z.nullable(z.number()), null),
    }),
  ),
});

function apply(year: number, opened: number[]) {
  if (state.year !== year) return;
  set({ opened: new Set(opened), loading: false, error: null });
}

export async function loadAdvent(year: number, signal?: AbortSignal) {
  if (state.year !== year) set({ year, opened: new Set(), loading: true, error: null });
  else set({ loading: true, error: null });
  try {
    const result = await sendRequest(`/api/advent/${year}`, doorsSchema, "GET", undefined, signal);
    apply(year, result.opened);
  } catch (error) {
    if (signal?.aborted) return;
    if (state.year === year) set({ loading: false, error });
  }
}

export async function openDoor(year: number, day: number) {
  const previous = state.opened;
  set({ opened: new Set([...previous, day]) });
  try {
    const result = await sendRequest(
      `/api/advent/${year}/${day}`,
      doorsSchema,
      "POST",
    );
    apply(year, result.opened);
    void loadRewards();
  } catch (error) {
    if (state.year === year) set({ opened: previous });
    throw error;
  }
}

export async function loadRewards(signal?: AbortSignal) {
  try {
    const result = await sendRequest("/api/advent/rewards", rewardsSchema, "GET", undefined, signal);
    set({ rewards: result.rewards });
  } catch (error) {
    if (!signal?.aborted && state.rewards === null) set({ rewards: [] });
    if (!signal?.aborted) console.warn("[ysocial] could not load advent rewards", error);
  }
}

export async function setRewardEnabled(year: number, day: number, enabled: boolean) {
  const previous = state.rewards;
  const apply = (rewards: readonly Reward[] | null) => rewards?.map((reward) => (reward.year === year && reward.day === day ? { ...reward, enabled } : reward)) ?? null;
  set({ rewards: apply(previous) });
  try {
    const result = await sendRequest(`/api/advent/rewards/${year}/${day}`, rewardsSchema, "PUT", { enabled });
    set({ rewards: result.rewards });
  } catch (error) {
    set({ rewards: previous });
    throw error;
  }
}

export const useRewards = () => useAdventState().rewards;

export function resetAdventState() {
  set({ year: null, opened: new Set(), rewards: null, loading: false, error: null });
}

export const openAdventCalendar = () => set({ open: true });
export const closeAdventCalendar = () => set({ open: false });

export function setGiftHidden(hidden: boolean) {
  write(GIFT_HIDDEN_KEY, hidden ? "1" : null);
  set({ giftHidden: hidden });
}
