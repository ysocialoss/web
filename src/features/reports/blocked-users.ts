import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";

const blocked = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function markBlocked(userId: string, isBlocked: boolean) {
  if (isBlocked) blocked.add(userId);
  else blocked.delete(userId);
  emit();
}

export async function setBlocked(user: { id: string; handle: string }, isBlocked: boolean) {
  const result = await api.block(user.handle, isBlocked);
  markBlocked(user.id, result.blocking);
  return result.blocking;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBlockedUser(userId: string) {
  useSyncExternalStore(subscribe, () => version);
  return blocked.has(userId);
}
