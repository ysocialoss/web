import { useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

type Item = { id: string; estimatedHeight: number };
type Measurement = { height: number; bodyTop: number };
type Range = { start: number; end: number };

const overscan = 480;
const batchSize = 8;

function buildLayout(items: Item[], measurements: ReadonlyMap<string, Measurement>) {
  const index = new Map<string, number>();
  const offsets = [0];
  for (const [position, item] of items.entries()) {
    index.set(item.id, position);
    offsets.push(offsets[position] + (measurements.get(item.id)?.height ?? item.estimatedHeight));
  }
  return { items, index, offsets, measurements, height: offsets[items.length] };
}

type Layout = ReturnType<typeof buildLayout>;
type Anchor = { id: string; offset: number };
type View = { layout: Layout; origin: number; scrollTop: number; anchor?: Anchor };

function rowAt({ offsets, items }: Layout, offset: number) {
  let left = 0;
  let right = items.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (offsets[middle + 1] <= offset) left = middle + 1;
    else right = middle;
  }
  return Math.min(left, items.length - 1);
}

function listOrigin(scroller: HTMLElement, list: HTMLElement) {
  return scroller.scrollTop + list.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop;
}

function captureAnchor(view: View, scrollTop: number, next = view.layout, first = rowAt(view.layout, scrollTop - view.origin + 1)): Anchor | undefined {
  const { items, offsets, measurements } = view.layout;
  // Prefer the next surviving row if the anchor was deleted.
  for (let index = first; index >= 0 && index < items.length; index++) {
    const { id } = items[index];
    if (next.index.has(id)) return { id, offset: view.origin + offsets[index] + (measurements.get(id)?.bodyTop ?? 0) - scrollTop };
  }
}

export function useMessageWindow({
  items, list, scroller, content, stickToBottom, retained,
}: {
  items: Item[];
  list: RefObject<HTMLOListElement | null>;
  scroller: HTMLDivElement;
  content: HTMLDivElement;
  stickToBottom: RefObject<boolean>;
  retained: ReadonlySet<string>;
}) {
  const [measurements, setMeasurements] = useState(new Map<string, Measurement>());
  const [range, setRange] = useState<Range>();
  const [jump, setJump] = useState<string>();
  const nodes = useRef(new Map<string, HTMLElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const view = useRef<View | undefined>(undefined);
  const layout = useMemo(() => buildLayout(items, measurements), [items, measurements]);

  const updateRange = useCallback(({ layout, origin }: View, host: HTMLElement) => {
    const top = host.scrollTop - origin;
    const first = rowAt(layout, top - overscan);
    const last = rowAt(layout, top + host.clientHeight + overscan);
    const start = Math.max(0, Math.floor(first / batchSize) * batchSize);
    const end = Math.min(layout.items.length, Math.ceil((last + 1) / batchSize) * batchSize);
    setRange((current) => current?.start === start && current.end === end ? current : { start, end });
  }, []);

  const reconcile = useCallback((host: HTMLElement, element: HTMLElement, layout: Layout, follow: boolean, jump?: string) => {
    const next = { layout, origin: listOrigin(host, element), scrollTop: host.scrollTop };
    const previous = view.current;
    const target = jump && nodes.current.get(jump);
    let anchor: Anchor | undefined;
    if (target) {
      host.scrollTo({ top: host.scrollTop + target.getBoundingClientRect().top - host.getBoundingClientRect().top
        - (host.clientHeight - target.offsetHeight) / 2 });
    } else if (follow) {
      host.scrollTo({ top: host.scrollHeight });
    } else if (previous) {
      // Reuse the same anchor while new estimates settle. A prepend can put entirely new rows above it.
      const moved = Math.abs(next.scrollTop - previous.scrollTop) > 1;
      anchor = moved ? captureAnchor(previous, next.scrollTop, layout) : previous.anchor;
      if (anchor && !layout.index.has(anchor.id)) {
        anchor = captureAnchor(previous, previous.scrollTop, layout, previous.layout.index.get(anchor.id));
      }
      if (anchor) {
        const index = layout.index.get(anchor.id);
        if (index !== undefined) host.scrollTo({ top: next.origin + layout.offsets[index] + (layout.measurements.get(anchor.id)?.bodyTop ?? 0) - anchor.offset });
      }
    }
    next.scrollTop = host.scrollTop;
    const current = { ...next, anchor: anchor ?? captureAnchor(next, next.scrollTop) };
    view.current = current;
    updateRange(current, host);
    return target || undefined;
  }, [updateRange]);

  const measure = useCallback((elements: Iterable<Element>) => {
    const measured = new Map<string, Measurement>();
    for (const row of elements) {
      const id = row.getAttribute("data-virtual-message");
      if (!id || nodes.current.get(id) !== row) continue;
      const bounds = row.getBoundingClientRect();
      const body = row.querySelector("[data-message-body]");
      if (bounds.height) measured.set(id, {
        height: bounds.height,
        bodyTop: body ? body.getBoundingClientRect().top - bounds.top : 0,
      });
    }
    setMeasurements((current) => {
      let next: Map<string, Measurement> | undefined;
      for (const [id, size] of measured) {
        const previous = current.get(id);
        if (!previous || previous.height !== size.height || previous.bodyTop !== size.bodyTop) {
          next ??= new Map(current);
          next.set(id, size);
        }
      }
      return next ?? current;
    });
  }, []);

  const observeRow = useCallback((id: string, row: HTMLLIElement) => {
    nodes.current.set(id, row);
    observer.current?.observe(row, { box: "border-box" });
    return () => {
      nodes.current.delete(id);
      observer.current?.unobserve(row);
    };
  }, []);

  useLayoutEffect(() => {
    const host = scroller;
    const inner = content;
    const element = list.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const current = view.current;
        if (!current) return;
        if (Math.abs(current.scrollTop - host.scrollTop) > 1) {
          current.scrollTop = host.scrollTop;
          current.anchor = captureAnchor(current, host.scrollTop);
        }
        updateRange(current, host);
      });
    };
    host.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver((entries) => {
      const rows: Element[] = [];
      let sync = false;
      for (const { target } of entries) {
        if (target === host || target === inner) sync = true;
        else rows.push(target);
      }
      if (rows.length) measure(rows);
      if (sync && view.current) reconcile(host, element, view.current.layout, stickToBottom.current);
    });
    observer.current = resize;
    resize.observe(host);
    resize.observe(inner);
    for (const row of nodes.current.values()) resize.observe(row, { box: "border-box" });
    return () => {
      observer.current = null;
      resize.disconnect();
      cancelAnimationFrame(frame);
      host.removeEventListener("scroll", onScroll);
    };
  }, [content, list, scroller, stickToBottom, measure, reconcile, updateRange]);

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const target = reconcile(scroller, element, layout, stickToBottom.current, jump);
    if (jump && target && measurements.get(jump)?.height === target.getBoundingClientRect().height) {
      target.focus({ preventScroll: true });
      // The jump is complete once the mounted target has been measured and focused.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJump(undefined);
    }
    measure(nodes.current.values());
  }, [layout, jump, list, scroller, stickToBottom, measure, measurements, range, reconcile]);

  const start = range?.start ?? Math.max(0, items.length - 24);
  const end = Math.min(range?.end ?? items.length, items.length);
  const positions = new Set<number>();
  for (let position = start; position < end; position++) positions.add(position);
  for (const id of retained) {
    const position = layout.index.get(id);
    if (position !== undefined) positions.add(position);
  }
  if (jump) {
    const position = layout.index.get(jump);
    if (position !== undefined) positions.add(position);
  }

  return {
    height: layout.height, offsets: layout.offsets, positions: [...positions].sort((a, b) => a - b),
    observeRow, scrollToMessage: setJump,
  };
}
