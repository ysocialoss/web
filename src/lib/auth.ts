import { createSignal } from "solid-js";
export type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "unavailable" }
  | { kind: "onboarding"; suggestedHandle: string }
  | {
      kind: "signedIn";
      user: { id: string; handle: string; displayName: string };
    };
export async function getAuth(): Promise<AuthState> {
  try {
    const response = await fetch("/auth/me", { cache: "no-store" });
    if (!response.ok) return { kind: "unavailable" };
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("authenticated" in body))
      return { kind: "unavailable" };
    if (body.authenticated === false) return { kind: "anonymous" };
    if ("needsOnboarding" in body && body.needsOnboarding === true) {
      return {
        kind: "onboarding",
        suggestedHandle:
          "suggestedHandle" in body && typeof body.suggestedHandle === "string"
            ? body.suggestedHandle
            : "",
      };
    }
    if ("user" in body && typeof body.user === "object" && body.user !== null) {
      const user = body.user;
      if (
        "id" in user &&
        typeof user.id === "string" &&
        "handle" in user &&
        typeof user.handle === "string" &&
        "displayName" in user &&
        typeof user.displayName === "string"
      ) {
        return {
          kind: "signedIn",
          user: {
            id: user.id,
            handle: user.handle,
            displayName: user.displayName,
          },
        };
      }
    }
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}
export function useAuth() {
  const [state, setState] = createSignal<AuthState>({ kind: "loading" });
  const reload = async () => setState(await getAuth());
  return { state, reload };
}
