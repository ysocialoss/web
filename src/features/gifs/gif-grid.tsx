import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { GifSearchItem } from "@/lib/api";
import { GifPreview } from "./gif-preview";

const gap = 8;
const overscan = 200;

type Tile = { item: GifSearchItem; index: number; top: number; left: number; width: number; height: number };

function firstVisible(tiles: Tile[], top: number) {
  let first = 0;
  let end = tiles.length;
  while (first < end) {
    const middle = Math.floor((first + end) / 2);
    const tile = tiles[middle];
    if (tile.top + tile.height < top) first = middle + 1;
    else end = middle;
  }
  return first;
}

export function GifGrid({
  items,
  scrollRoot,
  disabled,
  onSelect,
}: {
  items: GifSearchItem[];
  scrollRoot: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  onSelect: (item: GifSearchItem) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 320, top: 0 });
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const pendingFocus = useRef<number | null>(null);

  useLayoutEffect(() => {
    const root = scrollRoot.current;
    if (!root) return;
    let frame = 0;
    function measure() {
      frame = 0;
      if (!root) return;
      const next = {
        width: root.clientWidth,
        height: root.clientHeight,
        top: root.scrollTop,
      };
      setViewport((current) =>
        current.width === next.width &&
        current.height === next.height &&
        current.top === next.top
          ? current
          : next,
      );
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    root.addEventListener("scroll", schedule, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      root.removeEventListener("scroll", schedule);
    };
  }, [scrollRoot]);

  const columns = viewport.width >= 400 ? 3 : 2;
  const layout = useMemo(() => {
    const width = Math.max(0, (viewport.width - gap * (columns - 1)) / columns);
    const heights = Array<number>(columns).fill(0);
    const byColumn = Array.from({ length: columns }, (): Tile[] => []);
    const tiles = items.map((item, index) => {
      const column = heights.indexOf(Math.min(...heights));
      const top = heights[column];
      const height =
        (Math.max(0, width - 4) * (item.height ?? 165)) / (item.width ?? 220) +
        4;
      heights[column] += height + gap;
      const tile = { item, index, top, left: column * (width + gap), width, height };
      byColumn[column].push(tile);
      return tile;
    });
    return { tiles, byColumn, height: Math.max(0, ...heights) };
  }, [items, viewport.width, columns]);
  const visible = useMemo(() => {
    const top = viewport.top - overscan;
    const bottom = viewport.top + viewport.height + overscan;
    const window = new Map<number, Tile>();
    for (const column of layout.byColumn) {
      for (let index = firstVisible(column, top); index < column.length && column[index].top <= bottom; index++) {
        const tile = column[index];
        window.set(tile.index, tile);
      }
    }
    const focused = focusedIndex === null ? undefined : layout.tiles[focusedIndex];
    if (focused) window.set(focused.index, focused);
    return [...window.values()].sort((a, b) => a.index - b.index);
  }, [focusedIndex, layout, viewport.height, viewport.top]);

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    grid.current
      ?.querySelector<HTMLButtonElement>(
        `[data-gif-index="${pendingFocus.current}"]`,
      )
      ?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [focusedIndex, layout]);

  return (
    <div
      ref={grid}
      className="relative w-full"
      style={{ height: layout.height, overflowAnchor: "none" }}
      data-gif-count={items.length}
    >
      {viewport.width > 0 &&
        visible.map(({ item, index, top, left, width, height }) => (
            <button
              key={item.id}
              type="button"
              data-gif-index={index}
              aria-label={item.title}
              disabled={disabled}
              onClick={() => onSelect(item)}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                let next: number;
                switch (event.key) {
                  case "Tab":
                    next = index + (event.shiftKey ? -1 : 1);
                    break;
                  case "ArrowRight":
                    next = index + 1;
                    break;
                  case "ArrowLeft":
                    next = index - 1;
                    break;
                  case "ArrowDown":
                    next = index + columns;
                    break;
                  case "ArrowUp":
                    next = index - columns;
                    break;
                  case "Home":
                    next = 0;
                    break;
                  case "End":
                    next = items.length - 1;
                    break;
                  default:
                    return;
                }
                if (next < 0 || next >= items.length) return;
                if (next === index) {
                  event.preventDefault();
                  return;
                }
                const tile = layout.tiles[next];
                const root = scrollRoot.current;
                if (!root) return;
                event.preventDefault();
                pendingFocus.current = next;
                setFocusedIndex(next);
                if (tile.top < root.scrollTop) root.scrollTop = tile.top;
                else if (
                  tile.top + tile.height >
                  root.scrollTop + root.clientHeight
                )
                  root.scrollTop = tile.top + tile.height - root.clientHeight;
              }}
              className="absolute overflow-hidden rounded-lg border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ top, left, width, height, contain: "layout paint" }}
            >
              <GifPreview
                src={item.previewUrl}
                width={item.width}
                height={item.height}
                alt={item.title}
              />
            </button>
          ))}
    </div>
  );
}
