import { useMemo } from "react";
import type { Session } from "@/lib/api";

export type SessionHint = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
};

const KEY = "session-hint";

function parse(value: string | null): SessionHint | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed && typeof parsed.id === "string" &&
      "handle" in parsed && typeof parsed.handle === "string" &&
      "displayName" in parsed && typeof parsed.displayName === "string" &&
      "avatarUrl" in parsed &&
      (parsed.avatarUrl === null || typeof parsed.avatarUrl === "string")
    )
      return {
        id: parsed.id,
        handle: parsed.handle,
        displayName: parsed.displayName,
        avatarUrl: parsed.avatarUrl,
      };
  } catch {
    return null;
  }
  return null;
}

let memory: SessionHint | null | undefined;

export function readSessionHint(): SessionHint | null {
  if (memory !== undefined) return memory;
  try {
    memory = parse(localStorage.getItem(KEY));
  } catch {
    memory = null;
  }
  return memory;
}

export function rememberSession(session: Session | null) {
  if (session === null) return;
  const next: SessionHint | null =
    session.authenticated && !session.needsOnboarding
      ? {
          id: session.user.id,
          handle: session.user.handle,
          displayName: session.user.displayName,
          avatarUrl: session.avatarUrl,
        }
      : null;
  const previous = readSessionHint();
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  memory = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    memory = next;
  }
}

export function useSessionHint(session: Session | null) {
  return useMemo(() => (session === null ? readSessionHint() : null), [session]);
}
