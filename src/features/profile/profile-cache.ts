import type { Profile } from "@/lib/api";

const MAX_ENTRIES = 24;
const entries = new Map<string, Profile>();

export const profileCacheKey = (handle: string, viewerId: string | null) =>
  `${viewerId ?? "anonymous"}|${handle.toLowerCase()}`;

export function peekProfile(key: string) {
  return entries.get(key) ?? null;
}

export function storeProfile(key: string, profile: Profile) {
  entries.delete(key);
  entries.set(key, profile);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}
