import { createContext } from "react";

export const AccountSettingsContext = createContext<(trigger: HTMLButtonElement | null) => void>(() => {});
