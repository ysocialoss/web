import { Fragment, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DmUser } from "./dm-api";
import type { LocalDevice } from "./dm-crypto";
import { fold, noFilters, useMessageSearch, type SearchFilters, type SearchHit } from "./message-search";
import { nameOf, PersonAvatar } from "./message-row";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

type FilterOption<Value extends string> = { value: Value; label: string };

const contentOptions: FilterOption<SearchFilters["has"]>[] = [
  { value: "any", label: "Anything" },
  { value: "link", label: "Links" },
  { value: "poll", label: "Polls" },
  { value: "voice", label: "Voice messages" },
  { value: "gif", label: "GIFs" },
];

function DrawerFilterGroup<Value extends string>({ label, options, value, onChange }: {
  label: string;
  options: FilterOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="px-2 text-xs font-medium text-muted-foreground">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="size-4 shrink-0 accent-primary" />
          <span className="wrap-anywhere">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

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
  const mobile = useIsMobile();
  const input = useRef<HTMLInputElement>(null);
  const searchable = useMemo(() => [{ id: conversationId, peer, lastMessageAt }], [conversationId, peer, lastMessageAt]);
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
  const filtered = filters.sender !== "anyone" || filters.has !== "any";
  const active = !!query.trim() || filtered;
  const { search, progress, failed, retry } = useMessageSearch(device, searchable, active);
  const hits = useDeferredValue(useMemo(() => active ? search(query, filters) : [], [active, search, query, filters]));
  const senderOptions: FilterOption<SearchFilters["sender"]>[] = [
    { value: "anyone", label: "Anyone" },
    { value: "me", label: `${nameOf(self)} (you)` },
    { value: "them", label: nameOf(peer) },
  ];
  const setSender = (sender: SearchFilters["sender"]) => setFilters((current) => ({ ...current, sender }));
  const setContent = (has: SearchFilters["has"]) => setFilters((current) => ({ ...current, has }));
  const trigger = (
    <IconButton label="Filter results" className="relative shrink-0">
      <SlidersHorizontal aria-hidden="true" />
      {filtered && <span aria-hidden="true" className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />}
    </IconButton>
  );

  return (
    <div className="relative shrink-0 border-b border-border" onKeyDown={(event) => {
      if (event.key === "Escape" && event.target instanceof Node && event.currentTarget.contains(event.target)) onClose();
    }}>
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
        {mobile ? (
          <Drawer showSwipeHandle>
            <DrawerTrigger render={trigger} />
            <DrawerContent>
              <DrawerHeader><DrawerTitle>Filter results</DrawerTitle></DrawerHeader>
              <div className="min-h-0 space-y-3 overflow-y-auto px-4 py-3">
                <DrawerFilterGroup label="From" options={senderOptions} value={filters.sender} onChange={setSender} />
                <DrawerFilterGroup label="Contains" options={contentOptions} value={filters.has} onChange={setContent} />
              </div>
              <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
                <DrawerClose render={<Button type="button" />}>Done</DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger render={trigger} />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>From</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filters.sender} onValueChange={(sender) => {
                  const option = senderOptions.find(({ value }) => value === sender);
                  if (option) setSender(option.value);
                }}>
                  {senderOptions.map(({ value, label }) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Contains</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filters.has} onValueChange={(has) => {
                  const option = contentOptions.find(({ value }) => value === has);
                  if (option) setContent(option.value);
                }}>
                  {contentOptions.map(({ value, label }) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <IconButton label="Close search" className="shrink-0" onClick={onClose}><X aria-hidden="true" /></IconButton>
      </div>

      {active && showing && progress.total > 0 && <p role="status" className="sr-only">Reading this conversation…</p>}
      {active && showing && (progress.total === 0 || hits.length > 0) && (
        <div role="region" aria-label="Search results" aria-busy={progress.total > 0} className="absolute inset-x-0 top-full z-20 max-h-80 overflow-y-auto overscroll-contain border-b border-border bg-background p-1.5 shadow-md">
          {failed && (
            <div className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
              <p role="alert">Couldn’t search this conversation.</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => void retry()}>Retry search</Button>
            </div>
          )}
          {!failed && hits.length === 0 && progress.total === 0 && (
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
