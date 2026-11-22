import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis } from "lucide-react";
import { Reactions, type Reaction, type ReactionChoice, type ReactionsHandle } from "@/components/ui/reactions";
import { peekEmojiIndex } from "@/lib/emoji";
import type { WireReaction } from "./dm-api";
import { EmojiPicker } from "./emoji-picker";

const choices: ReactionChoice[] = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Funny" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "🙏", label: "Thanks" },
  { emoji: "👀", label: "Looking" },
  { emoji: "…", label: "More emoji", more: true, icon: <Ellipsis aria-hidden="true" /> },
];

function nameOf(emoji: string) {
  const name = peekEmojiIndex()?.byEmoji.get(emoji);
  return name?.replace(/_/g, " ");
}

function derive(reactions: WireReaction[], selfId: string, peerName: string): Reaction[] {
  const groups = new Map<string, Reaction>();
  for (const { emoji, userId } of reactions) {
    const group = groups.get(emoji) ?? { emoji, count: 0, people: [] };
    group.count += 1;
    if (userId === selfId) group.mine = true;
    else group.people?.push(peerName);
    groups.set(emoji, group);
  }
  return [...groups.values()];
}

function single(next: Reaction[], previous: Reaction[]) {
  const mine = next.filter((reaction) => reaction.mine);
  if (mine.length < 2) return next;
  const before = new Set(previous.filter((reaction) => reaction.mine).map((reaction) => reaction.emoji));
  const keep = mine.find((reaction) => !before.has(reaction.emoji)) ?? mine[0];
  return next
    .map((reaction) => reaction.mine && reaction !== keep ? { ...reaction, mine: false, count: reaction.count - 1 } : reaction)
    .filter((reaction) => reaction.count > 0);
}

export function MessageReactions({
  reactions, selfId, peerName, onReact, onFailed, onOpenChange,
}: {
  reactions: WireReaction[];
  selfId: string;
  peerName: string;
  onReact: (emoji: string | null) => Promise<unknown>;
  onFailed: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const server = useMemo(() => derive(reactions, selfId, peerName), [reactions, selfId, peerName]);
  const [local, setLocal] = useState(server);
  const [seen, setSeen] = useState(server);
  if (seen !== server) {
    setSeen(server);
    setLocal(server);
  }
  const handle = useRef<ReactionsHandle>(null);
  const [picking, setPicking] = useState(false);
  const [tray, setTray] = useState(false);
  useEffect(() => onOpenChange?.(tray || picking), [tray, picking, onOpenChange]);
  const [place, setPlace] = useState<{ left: number; width: number; maxHeight: number; top?: number; bottom?: number }>();
  useEffect(() => {
    if (!picking) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setPicking(false); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [picking]);
  const empty = local.length === 0;

  const change = useCallback((next: Reaction[]) => setLocal((previous) => single(next, previous)), []);
  const save = useCallback(async (emoji: string, on: boolean) => {
    try {
      await onReact(on ? emoji : null);
    } catch (error) {
      onFailed();
      throw error;
    }
  }, [onReact, onFailed]);

  return (
    <>
      <Reactions
        ref={handle}
        value={local}
        choices={choices}
        onValueChange={change}
        onReact={save}
        onOpenChange={(open) => {
          setTray(open);
          if (!open) setPicking(false);
        }}
        hideTrigger={empty}
        onMore={(anchor) => {
          const rect = anchor.getBoundingClientRect();
          const { clientWidth, clientHeight } = document.documentElement;
          const width = Math.min(308, clientWidth - 16);
          const left = Math.max(8, Math.min(rect.right - width, clientWidth - width - 8));
          const above = rect.top - 16;
          const below = clientHeight - rect.bottom - 16;
          setPlace(below < 340 && above > below
            ? { left, width, maxHeight: above, bottom: clientHeight - rect.top + 8 }
            : { left, width, maxHeight: below, top: rect.bottom + 8 });
          setPicking(true);
        }}
        labelFor={nameOf}
        className={empty ? "h-0 overflow-visible" : "-ml-0.5"}
      />
      {picking && place && createPortal(
        <div
          data-reaction-popup=""
          role="dialog"
          aria-label="Choose an emoji"
          style={place}
          className="fixed z-[62] flex flex-col rounded-xl bg-popover p-2.5 text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none"
        >
          <EmojiPicker onPick={(emoji) => {
            setPicking(false);
            handle.current?.react(emoji);
            handle.current?.close();
          }} />
        </div>,
        document.body,
      )}
    </>
  );
}
