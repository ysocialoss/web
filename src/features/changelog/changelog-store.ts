import { useSyncExternalStore } from "react";
import { z } from "zod/mini";
import { sendRequest } from "@/lib/api";

type State = { open: boolean; unseen: boolean };
let state: State = { open: false, unseen: false };
// Set by the console helper below, so dismissing a forced banner does not tell the server anything.
let forced = false;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useChangelogState = () => useSyncExternalStore(subscribe, () => state, () => state);

/** Opens the What's new modal; opening it counts as having seen the latest changes. */
export function openChangelog() {
  set({ open: true });
  markChangelogSeen();
}

export const closeChangelog = () => set({ open: false });

export function markChangelogSeen() {
  if (!state.unseen) return;
  set({ unseen: false });
  if (forced) {
    forced = false;
    return;
  }
  sendRequest("/api/changelog/seen", z.undefined(), "PUT").catch(() => {});
}

export async function checkChangelogUnseen(signal?: AbortSignal) {
  const { unseen } = await sendRequest(
    "/api/changelog/unseen",
    z.object({ unseen: z.boolean() }),
    "GET",
    undefined,
    signal,
  );
  if (forced) return;
  set({ unseen });
}

/** Console helper: `showUpdateBanner()` shows the "ysocial has updated!" banner for testing. */
(window as Window & { showUpdateBanner?: () => void }).showUpdateBanner = () => {
  forced = true;
  set({ unseen: true });
};
