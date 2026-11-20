import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LayoutGrid, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { searchEmojis } from "@/lib/emoji";
import { useEmojiIndex } from "@/lib/use-emoji-index";

const categories: ({ group: "all"; label: string } | { group: number; emoji: string; label: string })[] = [
  { group: "all", label: "All" },
  { group: 0, emoji: "😀", label: "Smileys and emotion" },
  { group: 1, emoji: "👋", label: "People and body" },
  { group: 3, emoji: "🐻", label: "Animals and nature" },
  { group: 4, emoji: "🍎", label: "Food and drink" },
  { group: 5, emoji: "🚗", label: "Travel and places" },
  { group: 6, emoji: "⚽", label: "Activities" },
  { group: 7, emoji: "💡", label: "Objects" },
  { group: 8, emoji: "💟", label: "Symbols" },
  { group: 9, emoji: "🏁", label: "Flags" },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<number | "all">(0);
  const index = useEmojiIndex(true);
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [active, setActive] = useState(0);
  useEffect(() => input.current?.focus({ preventScroll: true }), []);
  const term = query.trim().toLowerCase().replace(/^:|:$/g, "");
  const shown = useMemo(() => {
    if (!index) return [];
    if (term) return searchEmojis(index, term, 96);
    return group === "all" ? index.entries : index.entries.filter((entry) => entry.group === group);
  }, [group, index, term]);
  const selected = Math.min(active, Math.max(0, shown.length - 1));

  function resetSelection() {
    setActive(0);
    if (grid.current) grid.current.scrollTop = 0;
  }

  function moveSelection(offset: number) {
    const list = grid.current;
    if (!list || !shown.length) return;
    const next = Math.max(0, Math.min(selected + offset, shown.length - 1));
    setActive(next);
    const option = list.children.item(next);
    if (!(option instanceof HTMLElement)) return;
    const bottom = option.offsetTop + option.offsetHeight;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <label className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-input bg-background px-2.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          value={query}
          onChange={(event) => { setQuery(event.target.value); resetSelection(); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && shown[selected]) {
              event.preventDefault();
              onPick(shown[selected].emoji);
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              moveSelection(event.key === "ArrowDown" ? 8 : 1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              moveSelection(event.key === "ArrowUp" ? -8 : -1);
            }
          }}
          placeholder="Search emoji"
          aria-label="Search emoji"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown.length > 0 ? `${listId}-${selected}` : undefined}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div role="group" aria-label="Emoji categories" className="grid shrink-0 grid-cols-10 gap-0.5 border-b border-border pb-1.5">
        {categories.map((category) => (
          <Tooltip key={category.group}>
            <TooltipTrigger
              type="button"
              aria-label={category.label}
              aria-pressed={!term && group === category.group}
              onClick={() => { setGroup(category.group); setQuery(""); resetSelection(); }}
              className="grid h-7 min-w-0 place-items-center rounded-md text-base leading-none outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-pressed:bg-accent"
            >
              {category.group === "all"
                ? <LayoutGrid aria-hidden="true" className="size-4" />
                : <span aria-hidden="true">{category.emoji}</span>}
            </TooltipTrigger>
            <TooltipContent positionerClassName="z-[63]">{category.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div ref={grid} id={listId} role="listbox" aria-label="Emoji" className="relative grid h-56 min-h-0 min-w-0 auto-rows-[minmax(2.25rem,max-content)] grid-cols-8 content-start gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
        {!index && <p role="status" className="col-span-8 py-6 text-center text-sm text-muted-foreground">Loading emoji…</p>}
        {index && shown.length === 0 && <p className="col-span-8 py-6 text-center text-sm text-muted-foreground">No emoji found.</p>}
        {shown.map(({ emoji, name }, position) => (
          <button
            key={emoji}
            id={`${listId}-${position}`}
            type="button"
            role="option"
            aria-selected={position === selected}
            aria-label={name.replace(/_/g, " ")}
            title={name.replace(/_/g, " ")}
            onClick={() => onPick(emoji)}
            onPointerMove={() => setActive(position)}
            className={`grid min-w-0 place-items-center overflow-hidden rounded-md text-[clamp(0.875rem,6vw,1.25rem)] leading-none outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${position === selected && (term || active > 0) ? "bg-accent" : ""}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
