import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchEmojis } from "@/lib/emoji";
import { useEmojiIndex } from "@/lib/use-emoji-index";

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const index = useEmojiIndex(true);
  const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => input.current?.focus(), []);
  const shown = useMemo(() => {
    if (!index) return [];
    const term = query.trim().toLowerCase().replace(/^:|:$/g, "");
    return term ? searchEmojis(index, term, 96) : index.entries.map(({ emoji, name }) => ({ emoji, name }));
  }, [index, query]);
  const selected = Math.min(active, Math.max(0, shown.length - 1));

  return (
    <div className="flex w-72 max-w-full flex-col gap-2">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-2.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && shown[selected]) {
              event.preventDefault();
              onPick(shown[selected].emoji);
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              setActive(Math.min(selected + (event.key === "ArrowDown" ? 8 : 1), shown.length - 1));
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              setActive(Math.max(selected - (event.key === "ArrowUp" ? 8 : 1), 0));
            }
          }}
          placeholder="Search emoji"
          aria-label="Search emoji"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div role="listbox" aria-label="Emoji" className="grid h-56 grid-cols-8 content-start gap-0.5 overflow-y-auto overscroll-contain pr-0.5">
        {!index && <p role="status" className="col-span-8 py-6 text-center text-sm text-muted-foreground">Loading emoji…</p>}
        {index && shown.length === 0 && <p className="col-span-8 py-6 text-center text-sm text-muted-foreground">No emoji found.</p>}
        {shown.map(({ emoji, name }, position) => (
          <button
            key={emoji}
            type="button"
            role="option"
            aria-selected={position === selected}
            aria-label={name.replace(/_/g, " ")}
            title={name.replace(/_/g, " ")}
            onClick={() => onPick(emoji)}
            onPointerMove={() => setActive(position)}
            ref={position === selected ? (element) => element?.scrollIntoView({ block: "nearest" }) : undefined}
            className={`grid aspect-square place-items-center rounded-md text-xl leading-none outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${position === selected && query ? "bg-accent" : ""}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
