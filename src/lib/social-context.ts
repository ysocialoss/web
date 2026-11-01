import type { Accessor } from "solid-js";
import type { AuthState } from "~/lib/auth";
import { createContext, useContext } from "solid-js";

type SocialState = {
  auth: Accessor<AuthState>;
  reloadAuth: () => Promise<AuthState>;
  scrollRoot: () => HTMLElement | undefined;
  observeComposer: (element: HTMLElement) => () => void;
};

export const SocialContext = createContext<SocialState>();

export function useSocial() {
  const social = useContext(SocialContext);
  if (!social) throw new Error("Social pages must render within SocialLayout.");
  return social;
}
