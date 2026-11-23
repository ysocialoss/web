import { useSyncExternalStore } from "react";

const key = "ysocial:show-hidden-navigation";
const changeEvent = "ysocial:show-hidden-navigation-change";

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(key) === "on";
}

export function useShowHiddenNavigation() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setShowHiddenNavigation(show: boolean) {
  window.localStorage.setItem(key, show ? "on" : "off");
  window.dispatchEvent(new Event(changeEvent));
}
