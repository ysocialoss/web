import { useRef, useState, type PointerEvent } from "react";

type Drag = {
  pointerId: number;
  from: number;
  to: number;
  startY: number;
  startScroll: number;
  scroller: HTMLElement | null;
};

function findScroller(list: HTMLOListElement) {
  for (let parent = list.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return null;
}

export function useShortcutDrag(onMove: (from: number, to: number) => void) {
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{
    from: number;
    to: number;
    offset: number;
  } | null>(null);

  function start(event: PointerEvent, from: number) {
    const list = listRef.current;
    if (!list || drag.current || !event.isPrimary || event.button !== 0) return;

    // Capture on the stable list so a touch gesture survives changes to its rows.
    list.setPointerCapture(event.pointerId);
    const scroller = findScroller(list);
    drag.current = {
      pointerId: event.pointerId,
      from,
      to: from,
      startY: event.clientY,
      startScroll: scroller?.scrollTop ?? 0,
      scroller,
    };
  }

  function move(event: PointerEvent<HTMLOListElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const scroll = current.scroller;
    const delta = event.clientY - current.startY;
    if (!preview && Math.abs(delta) < 4) return;

    if (scroll) {
      const { top, bottom } = scroll.getBoundingClientRect();
      const edge = 36;
      if (event.clientY < top + edge)
        scroll.scrollTop -= Math.min(18, top + edge - event.clientY);
      else if (event.clientY > bottom - edge)
        scroll.scrollTop += Math.min(18, event.clientY - (bottom - edge));
    }

    const to = [...event.currentTarget.children].filter((row, index) => {
      if (index === current.from) return false;
      const { top, height } = row.getBoundingClientRect();
      return event.clientY > top + height / 2;
    }).length;
    current.to = to;
    setPreview({
      from: current.from,
      to,
      offset: delta + (scroll?.scrollTop ?? 0) - current.startScroll,
    });
  }

  function cancel(event?: PointerEvent<HTMLOListElement>) {
    if (event && drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setPreview(null);
  }

  function finish(event: PointerEvent<HTMLOListElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    cancel();
    if (current.from !== current.to) onMove(current.from, current.to);
  }

  return { listRef, preview, start, move, cancel, finish };
}
