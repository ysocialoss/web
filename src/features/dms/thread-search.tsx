import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DmUser } from "./dm-api";
import type { LocalDevice } from "./dm-crypto";
import { fold, noFilters, useMessageSearch, type SearchFilters, type SearchHit } from "./message-search";
import { nameOf, PersonAvatar } from "./message-row";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function Snippet({ hit, query }: { hit: SearchHit; query: string }) {
  const start = Math.max(0, hit.at - 32);
  const text = (start > 0 ? "…" : "") + hit.text.slice(start, start + 160).replace(/\s+/g, " ");
  const terms = fold(query).split(/\s+/).filter(Boolean).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return <>{text}</>;
  return (
    <>
      {text.split(new RegExp(`(${terms.join("|")})`, "gi")).map((part, index) => index % 2
        ? <mark key={index} className="rounded-sm bg-primary/20 px-0.5 font-medium text-foreground">{part}</mark>
        : <Fragment key={index}>{part}</Fragment>)}
    </>
  );
}

export function ThreadSearch({ device, conversationId, peer, self, lastMessageAt, onPick, onClose }: {
  device: LocalDevice;
  conversationId: string;
  peer: DmUser;
  self: DmUser;
  lastMessageAt: string | null;
  onPick: (messageId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(noFilters);
  const [showing, setShowing] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const searchable = useMemo(() => [{ id: conversationId, peer, lastMessageAt }], [conversationId, peer, lastMessageAt]);
  const { search, progress, enable } = useMessageSearch(device, searchable);
  useEffect(() => { enable(); input.current?.focus({ preventScroll: true }); }, [enable]);
  const filtered = filters.sender !== "anyone" || filters.has !== "any";
  const active = !!query.trim() || filtered;
  const hits = useDeferredValue(useMemo(() => active ? search(query, filters) : [], [active, search, query, filters]));

  return (
    <div className="relative shrink-0 border-b border-border" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setShowing(true); }}
            onFocus={() => setShowing(true)}
            placeholder={`Search messages with ${nameOf(peer)}`}
            aria-label="Search this conversation"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {query && <IconButton label="Clear search" size="icon-xs" type="button" onClick={() => { setQuery(""); input.current?.focus(); }}><X aria-hidden="true" /></IconButton>}
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <IconButton label="Filter results" className="relative shrink-0">
                <SlidersHorizontal aria-hidden="true" />
                {filtered && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
              </IconButton>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
            <DropdownMenuLabel>From</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={filters.sender} onValueChange={(sender) => setFilters({ ...filters, sender: sender as SearchFilters["sender"] })}>
              <DropdownMenuRadioItem value="anyone">Anyone</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="me">{nameOf(self)} (you)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="them">{nameOf(peer)}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
            <DropdownMenuLabel>Contains</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={filters.has} onValueChange={(has) => setFilters({ ...filters, has: has as SearchFilters["has"] })}>
              <DropdownMenuRadioItem value="any">Anything</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="link">Links</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="poll">Polls</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="voice">Voice messages</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="gif">GIFs</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton label="Close search" className="shrink-0" onClick={onClose}><X aria-hidden="true" /></IconButton>
      </div>

      {active && showing && (
        <div role="region" aria-label="Search results" className="absolute inset-x-0 top-full z-20 max-h-80 overflow-y-auto overscroll-contain border-b border-border bg-background p-1.5 shadow-md">
          {progress.total > 0 && (
            <p role="status" className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> Reading this conversation…
            </p>
          )}
          {hits.length === 0 && progress.total === 0 && (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <SearchX aria-hidden="true" className="size-4" /> No messages match.
            </p>
          )}
          <ul>
            {hits.map((hit) => {
              const mine = hit.senderId === self.id;
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => { onPick(hit.id); setShowing(false); }}
                    className={cn("flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring")}
                  >
                    <PersonAvatar user={mine ? self : peer} className="mt-0.5 size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{nameOf(mine ? self : peer)}</span>
                        <time dateTime={hit.createdAt} className="shrink-0 text-[0.65rem] text-muted-foreground">{dateFormat.format(new Date(hit.createdAt))}</time>
                      </span>
                      <span dir="auto" className="line-clamp-2 text-xs leading-relaxed text-muted-foreground wrap-anywhere"><Snippet hit={hit} query={query} /></span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
