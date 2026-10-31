import { createContext, useContext } from "solid-js";

type SocialState = {
  observeComposer: (element: HTMLElement) => () => void;
};

export const SocialContext = createContext<SocialState>();

export function useSocial() {
  const social = useContext(SocialContext);
  if (!social) throw new Error("Social pages must render within SocialLayout.");
  return social;
}
