import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage, type GifSearchItem } from "@/lib/api";
import { GifGrid } from "./gif-grid";

type Search = { filter: { query: string }; page: number };
type Outcome = { search: Search; items: GifSearchItem[] } & (
  { kind: "results"; hasNext: boolean } | { kind: "error"; message: string }
);

export function GifPicker({
  onSelect,
  infiniteScroll = false,
}: {
  onSelect: (gif: GifSearchItem) => void;
  infiniteScroll?: boolean;
}) {
  const searchId = useId();
  const scrollRoot = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ filter: { query: "" }, page: 1 });
  const [outcome, setOutcome] = useState<Outcome>();

  useEffect(() => {
    const controller = new AbortController();
    const retained = (previous: Outcome | undefined) => infiniteScroll && previous?.search.filter === search.filter ? previous.items : [];
    api
      .searchGifs(search.filter.query, search.page, controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return;
        setOutcome((previous) => {
          const unique = new Map(retained(previous).map((item) => [item.id, item]));
          for (const item of results.items) {
            if (!unique.has(item.id)) unique.set(item.id, item);
          }
          return { search, kind: "results", items: [...unique.values()], hasNext: results.hasNext && results.items.length > 0 };
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setOutcome((previous) => ({ search, kind: "error", items: retained(previous), message: errorMessage(error) }));
      });
    return () => controller.abort();
  }, [infiniteScroll, search]);

  const current = outcome?.search === search ? outcome : undefined;
  const items = infiniteScroll && outcome?.search.filter === search.filter ? outcome.items : current?.items;
  const more = current?.kind === "results" && current.hasNext && search.page < 100;

  useEffect(() => {
    const root = scrollRoot.current;
    const target = bottom.current;
    if (!infiniteScroll || !root || !target || !more) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(({ isIntersecting }) => isIntersecting)) {
        observer.disconnect();
        setSearch((active) => active === search ? { ...search, page: search.page + 1 } : active);
      }
    }, { root, rootMargin: "0px 0px 200px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [infiniteScroll, more, search]);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Choose a GIF</DialogTitle>
      </DialogHeader>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          scrollRoot.current?.scrollTo({ top: 0 });
          setSearch({ filter: { query: query.trim() }, page: 1 });
        }}
      >
        <label className="sr-only" htmlFor={searchId}>
          Search KLIPY
        </label>
        <Input
          id={searchId}
          type="search"
          value={query}
          maxLength={100}
          placeholder="Search KLIPY"
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <div
        ref={scrollRoot}
        className="h-[min(36dvh,20rem)] overflow-y-auto overscroll-contain"
        role="region"
        aria-label="GIF results"
        tabIndex={infiniteScroll ? 0 : undefined}
        aria-busy={!current}
      >
        {!current && (
          <p className={infiniteScroll ? "sr-only" : "p-3 text-muted-foreground"} role="status">
            Loading GIFs…
          </p>
        )}
        {items && items.length > 0 && (
          <GifGrid items={items} scrollRoot={scrollRoot} disabled={false} onSelect={onSelect} />
        )}
        {current?.kind === "error" && (
          <div className="space-y-2 p-3">
            <p className="text-destructive" role="alert">
              {current.message}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearch({ ...search })}
            >
              Retry
            </Button>
          </div>
        )}
        {current?.kind === "results" && !current.items.length && (
          <p className="p-3 text-muted-foreground" role="status">No GIFs found.</p>
        )}
        {infiniteScroll && more && <div ref={bottom} aria-hidden="true" className="h-px" />}
      </div>
      <div className="flex items-center justify-between gap-2">
        <a
          href="https://klipy.com"
          target="_blank"
          rel="noreferrer"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <img
            src="/klipy/powered-by-klipy.svg"
            alt="Powered by KLIPY"
            className="h-5 w-auto"
          />
        </a>
        {!infiniteScroll && <div className="flex gap-2">
          {search.page > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSearch({ ...search, page: search.page - 1 })}
            >
              Previous
            </Button>
          )}
          {more && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSearch({ ...search, page: search.page + 1 })}
            >
              Next
            </Button>
          )}
        </div>}
      </div>
    </DialogContent>
  );
}
