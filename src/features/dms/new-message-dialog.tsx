import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type SearchUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { dmError } from "./dm-api";
import type { LocalDevice } from "./dm-crypto";
import { openConversation } from "./dm-send";
import { nameOf, PersonAvatar } from "./message-row";

export function NewMessageDialog({
  open, onOpenChange, device, selfId, onOpened, onPick, title = "New message", description = "Find someone by their name or @handle.",
}: {
  onPick?: (user: SearchUser) => Promise<void> | void;
  title?: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: LocalDevice;
  selfId: string;
  onOpened: () => void;
}) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const term = query.trim().replace(/^@/, "");

  useEffect(() => {
    if (!open) return;
    const reset = setTimeout(() => {
      setQuery("");
      setResults([]);
      setError("");
      setActive(0);
    }, 0);
    return () => clearTimeout(reset);
  }, [open]);

  useEffect(() => {
    if (!open || !term) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      api.searchUsers(term, undefined, controller.signal).then(({ users }) => {
        if (controller.signal.aborted) return;
        setResults(users.filter((user) => user.id !== selfId).slice(0, 8));
        setActive(0);
        setError("");
      }).catch(() => {
        if (!controller.signal.aborted) setResults([]);
      }).finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, term, selfId]);

  const shown = term ? results : [];

  async function choose(user: SearchUser) {
    if (busy) return;
    setBusy(user.handle);
    setError("");
    try {
      if (onPick) {
        await onPick(user);
        onOpenChange(false);
      } else {
        const id = await openConversation(user.handle, device);
        onOpened();
        onOpenChange(false);
        void navigate(`/messages/${id}`);
      }
    } catch (reason) {
      setError(dmError(reason));
    } finally {
      setBusy("");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && shown.length) {
      event.preventDefault();
      setActive((active + 1) % shown.length);
    } else if (event.key === "ArrowUp" && shown.length) {
      event.preventDefault();
      setActive((active + shown.length - 1) % shown.length);
    } else if (event.key === "Enter" && shown[active] && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void choose(shown[active]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-md" initialFocus={input}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search people"
            aria-label="Recipient"
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls={listId}
            aria-activedescendant={shown.length ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={40}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
          {searching && <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />}
        </label>
        <div id={listId} role="listbox" aria-label="People" className="-mx-1 max-h-72 min-h-24 overflow-y-auto overscroll-contain px-1">
          {shown.map((user, index) => (
            <div
              key={user.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerMove={() => setActive(index)}
              onClick={() => void choose(user)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                index === active && "bg-muted",
                busy === user.handle && "opacity-60",
              )}
            >
              <PersonAvatar user={user} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nameOf(user)}</p>
                <p className="truncate text-xs text-muted-foreground">@{user.handle}{user.bio ? ` · ${user.bio}` : ""}</p>
              </div>
            </div>
          ))}
          {term && !searching && shown.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No one found for “{term}”.</p>}
          {!term && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Start typing a name or handle.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
