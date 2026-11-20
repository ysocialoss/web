import { useRef, type KeyboardEvent } from "react";
import type { GifSearchItem } from "@/lib/api";

export const EASTER_EGG_GIF: GifSearchItem = {
  id: "easter-egg",
  title: "ysocial easter egg",
  previewUrl: "/easter-egg.gif",
  url: "/easter-egg.gif",
  width: 480,
  height: 356,
  token: "ysocial:easter-egg",
};

const CHORD_MS = 500;
const HELD_MS = 5000;

type Snapshot = { value: string; start: number; end: number };
type Press = {
  at: number;
  down: boolean;
  swallow: boolean;
  before: Snapshot | null;
};

function newPresses(): Record<string, Press> {
  return {
    KeyG: { at: 0, down: false, swallow: false, before: null },
    KeyS: { at: 0, down: false, swallow: false, before: null },
  };
}

export function useEasterEggChord(onChord: (before: Snapshot | null) => void) {
  const state = useRef(newPresses());
  return {
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const presses = state.current;
      const press = presses[event.code];
      if (!press || event.nativeEvent.isComposing) return;
      if (event.repeat) {
        if (press.swallow) event.preventDefault();
        return;
      }
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const now = Date.now();
      const other = presses[event.code === "KeyG" ? "KeyS" : "KeyG"];
      const waited = now - other.at;
      if (waited < CHORD_MS || (other.down && waited < HELD_MS)) {
        event.preventDefault();
        const before = other.before;
        state.current = newPresses();
        state.current[event.code].down = true;
        state.current[event.code].swallow = true;
        onChord(before);
        return;
      }
      const field = event.target;
      press.at = now;
      press.down = true;
      press.before =
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLInputElement
          ? {
              value: field.value,
              start: field.selectionStart ?? field.value.length,
              end: field.selectionEnd ?? field.value.length,
            }
          : null;
    },
    onKeyUp(event: KeyboardEvent<HTMLElement>) {
      const press = state.current[event.code];
      if (!press) return;
      press.down = false;
      press.swallow = false;
    },
  };
}
