import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { DisplayName } from "@/components/display-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DraftHighlight } from "./draft-highlight";
import { limitBlankLines } from "./post-content";
import { api } from "@/lib/api";
import {
  findEmojis,
  findShortcodes,
  renderShortcodes,
  searchEmojis,
  shortcodeQueryAt,
  type EmojiMatch,
} from "@/lib/emoji";
import { useEmojiIndex } from "@/lib/use-emoji-index";

type Suggestion = Awaited<
  ReturnType<typeof api.mentionSuggestions>
>["users"][number];

function swap(
  element: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
) {
  element.setSelectionRange(start, end);
  if (
    document.activeElement === element &&
    document.execCommand("insertText", false, text)
  )
    return;
  element.setRangeText(text, start, end, "end");
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

export function MentionTextarea({
  value,
  onValueChange,
  onChange,
  onKeyDown,
  onSelect,
  onBlur,
  onFocus,
  onClick,
  onScroll,
  ref,
  emojis = "render",
  topics = false,
  limitPostBlankLines = false,
  dropUp = false,
  wrapperClassName = "relative",
  className,
  style,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value"> & {
  value: string;
  onValueChange: (value: string) => void;
  emojis?: "render" | "plain";
  topics?: boolean;
  limitPostBlankLines?: boolean;
  dropUp?: boolean;
  wrapperClassName?: string;
}) {
  const input = useRef<HTMLTextAreaElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [emojiActive, setEmojiActive] = useState({ query: "", index: 0 });
  const index = useEmojiIndex(focused);
  const match = value
    .slice(0, caret)
    .match(/(?<![\p{L}\p{N}_@/.])@([a-z0-9_]{1,32})$/iu);
  const query =
    focused &&
    !props.disabled &&
    match &&
    !/[\p{L}\p{N}_]/u.test(value[caret] ?? "")
      ? match[1].toLowerCase()
      : null;
  const token = `${caret}:${value}`;
  const users = query !== null && dismissed !== token ? suggestions : [];
  const selected = Math.min(active, Math.max(0, users.length - 1));
  const emojiQuery =
    focused && !props.disabled && index && !match
      ? shortcodeQueryAt(value, caret)
      : null;
  const emojiList = useMemo<EmojiMatch[]>(
    () =>
      index && emojiQuery && dismissed !== token
        ? searchEmojis(index, emojiQuery.query)
        : [],
    [index, emojiQuery, dismissed, token],
  );
  const emojiSelected =
    emojiActive.query === emojiQuery?.query ? emojiActive.index : 0;
  const open = users.length ? "users" : emojiList.length ? "emojis" : null;
  const count = open === "users" ? users.length : emojiList.length;
  const current = open === "users" ? selected : emojiSelected;

  useEffect(() => {
    if (overlay.current && input.current)
      overlay.current.scrollTop = input.current.scrollTop;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-${current}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, current, listId]);

  useEffect(() => {
    if (query === null || dismissed === token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .mentionSuggestions(query, controller.signal)
        .then((response) => {
          if (controller.signal.aborted) return;
          setSuggestions(response.users);
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, dismissed, token]);

  function choose(user: Suggestion) {
    const element = input.current;
    if (!element || !match) return;
    const start = caret - match[0].length;
    const replacement = `@${user.handle} `;
    const next = value.slice(0, start) + replacement + value.slice(caret);
    onValueChange(next);
    setDismissed(token);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(
        start + replacement.length,
        start + replacement.length,
      );
      setCaret(start + replacement.length);
    });
  }

  function chooseEmoji(item: EmojiMatch) {
    const element = input.current;
    if (!element || !emojiQuery) return;
    const text = emojis === "render" ? item.emoji : `:${item.name}:`;
    const spacer = /^\s/.test(element.value.slice(emojiQuery.end)) ? "" : " ";
    swap(element, emojiQuery.start, emojiQuery.end, text + spacer);
    setDismissed(token);
  }

  function move(next: number) {
    if (open === "users") setActive(next);
    else setEmojiActive({ query: emojiQuery?.query ?? "", index: next });
  }

  function renderAway(element: HTMLTextAreaElement) {
    if (!index || emojis !== "render") return;
    if (element.selectionStart !== element.selectionEnd) return;
    const at = element.selectionStart;
    const away = findShortcodes(element.value, index).filter(
      (span) => at < span.start || at > span.end,
    );
    if (!away.length) return;
    let shift = 0;
    for (const span of away.reverse()) {
      swap(element, span.start, span.end, span.emoji);
      if (span.end <= at) shift += span.emoji.length - (span.end - span.start);
    }
    element.setSelectionRange(at + shift, at + shift);
  }

  function reveal(
    element: HTMLTextAreaElement,
    side: "before" | "after",
    caretAt: "edge" | "inside",
  ) {
    if (!index || emojis !== "render") return false;
    if (element.selectionStart !== element.selectionEnd) return false;
    const at = element.selectionStart;
    const span = findEmojis(element.value, index).find((item) =>
      side === "before" ? item.end === at : item.start === at,
    );
    if (!span) return false;
    const code = `:${span.name}:`;
    swap(element, span.start, span.end, code);
    const place =
      side === "before"
        ? span.start + code.length - (caretAt === "inside" ? 1 : 0)
        : span.start + (caretAt === "inside" ? 1 : 0);
    element.setSelectionRange(place, place);
    return true;
  }

  return (
    <div className={wrapperClassName}>
      <Textarea
        {...props}
        value={value}
        style={style}
        className={cn(className, "text-transparent caret-foreground")}
        onScroll={(event) => {
          if (overlay.current)
            overlay.current.scrollTop = event.currentTarget.scrollTop;
          onScroll?.(event);
        }}
        ref={(element) => {
          input.current = element;
          if (typeof ref === "function") return ref(element);
          if (ref) ref.current = element;
        }}
        onChange={(event) => {
          const element = event.currentTarget;
          if (limitPostBlankLines) {
            const next = limitBlankLines(element.value, element.selectionStart);
            if (next.value !== element.value) {
              element.value = next.value;
              element.setSelectionRange(next.caret, next.caret);
            }
          }
          setCaret(element.selectionStart);
          onChange?.(event);
          const native = event.nativeEvent as InputEvent;
          if (
            index &&
            emojis === "render" &&
            native.inputType === "insertText" &&
            native.data === ":" &&
            !native.isComposing
          ) {
            queueMicrotask(() => {
              if (element.selectionStart !== element.selectionEnd) return;
              const at = element.selectionStart;
              const span = findShortcodes(element.value, index).find(
                (item) => item.end === at,
              );
              if (span) swap(element, span.start, span.end, span.emoji);
            });
          }
        }}
        aria-autocomplete="list"
        aria-controls={open ? listId : props["aria-controls"]}
        aria-activedescendant={
          open ? `${listId}-${current}` : props["aria-activedescendant"]
        }
        onSelect={(event) => {
          setCaret(event.currentTarget.selectionStart);
          renderAway(event.currentTarget);
          onSelect?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          setCaret(event.currentTarget.selectionStart);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          const element = event.currentTarget;
          if (index && emojis === "render") {
            const rendered = renderShortcodes(element.value, index);
            if (rendered !== element.value)
              swap(element, 0, element.value.length, rendered);
          }
          onBlur?.(event);
        }}
        onClick={(event) => {
          const element = event.currentTarget;
          if (!reveal(element, "before", "edge"))
            reveal(element, "after", "edge");
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (open && !event.nativeEvent.isComposing) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(
                (current + (event.key === "ArrowDown" ? 1 : count - 1)) % count,
              );
              return;
            }
            if (
              (event.key === "Enter" || event.key === "Tab") &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey
            ) {
              event.preventDefault();
              if (open === "users") choose(users[selected]);
              else chooseEmoji(emojiList[emojiSelected]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDismissed(token);
              return;
            }
          }
          if (
            (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey &&
            !event.nativeEvent.isComposing &&
            reveal(
              event.currentTarget,
              event.key === "ArrowLeft" ? "before" : "after",
              "inside",
            )
          ) {
            event.preventDefault();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <div
        ref={overlay}
        aria-hidden="true"
        style={{ overflowY: style?.overflowY ?? "auto" }}
        className={cn(
          "pointer-events-none absolute inset-0 z-[1] border px-3 py-2 text-base break-words whitespace-pre-wrap md:text-sm",
          className,
          "block resize-none border-transparent bg-transparent text-foreground shadow-none ring-0 dark:bg-transparent",
        )}
      >
        <DraftHighlight text={value} topics={topics} />
      </div>
      {users.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Username suggestions"
          className={`absolute inset-x-0 z-50 max-h-56 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg ${dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
        >
          {users.map((user, index) => (
            <div
              key={user.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={selected === index}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm ${selected === index ? "bg-accent text-accent-foreground" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                choose(user);
              }}
              onPointerMove={() => setActive(index)}
            >
              <Avatar className="size-6" aria-hidden="true">
                {user.avatarUrl && (
                  <AvatarImage
                    src={user.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="text-[0.6rem]">
                  {(user.displayName || user.handle).slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 items-baseline gap-1.5">
                {user.displayName && (
                  <span className="truncate font-medium">
                    <DisplayName user={user} />
                  </span>
                )}
                <span
                  className={`shrink-0 ${user.displayName ? "text-xs text-muted-foreground" : "font-medium"}`}
                >
                  @{user.handle}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      {open === "emojis" && (
        <div
          id={listId}
          role="listbox"
          aria-label="Emoji suggestions"
          className={`absolute inset-x-0 z-50 max-h-48 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg ${dropUp ? "bottom-full mb-1.5" : "top-full mt-2"}`}
        >
          {emojiList.map((item, position) => (
            <div
              key={item.name}
              id={`${listId}-${position}`}
              role="option"
              aria-selected={emojiSelected === position}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-1.5 text-sm ${emojiSelected === position ? "bg-accent text-accent-foreground" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                chooseEmoji(item);
              }}
              onPointerMove={() =>
                setEmojiActive({
                  query: emojiQuery?.query ?? "",
                  index: position,
                })
              }
            >
              <span
                aria-hidden="true"
                className="w-6 text-center text-lg leading-none"
              >
                {item.emoji}
              </span>
              <span className="min-w-0 truncate">:{item.name}:</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
