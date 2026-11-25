import { useEffect, useState } from "react";
import { z } from "zod/mini";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, sendRequest } from "@/lib/api";
import { closeChangelog, useChangelogState } from "./changelog-store";

const categories = ["new", "improved", "fixed", "removed", "technical"] as const;
type Category = (typeof categories)[number];
const categoryLabels: Record<Category, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  removed: "Removed",
  technical: "Technical",
};

const entrySchema = z.object({
  id: z.string(),
  category: z.enum(categories),
  title: z.string(),
  body: z.string(),
});
const releaseSchema = z.object({
  id: z.string(),
  tag: z.string(),
  createdAt: z.string(),
  entries: z.array(entrySchema),
});
const pageSchema = z.object({
  upcoming: z.array(entrySchema),
  releases: z.array(releaseSchema),
  nextCursor: z.nullable(z.string()),
});
type Entry = z.infer<typeof entrySchema>;
type Release = z.infer<typeof releaseSchema>;

const loadPage = (before?: string, signal?: AbortSignal) =>
  sendRequest(
    "/api/changelog" + (before ? "?before=" + encodeURIComponent(before) : ""),
    pageSchema,
    "GET",
    undefined,
    signal,
  );

const releaseDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

export function ChangelogDialog() {
  const { open } = useChangelogState();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeChangelog(); }}>
      <DialogContent className="max-h-[85dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            What's new
          </DialogTitle>
          <DialogDescription>The latest changes to ysocial.</DialogDescription>
        </DialogHeader>
        {open && <ChangelogContent />}
      </DialogContent>
    </Dialog>
  );
}

function ChangelogContent() {
  const [upcoming, setUpcoming] = useState<Entry[]>([]);
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadPage(undefined, controller.signal)
      .then((page) => {
        setUpcoming(page.upcoming);
        setReleases(page.releases);
        setCursor(page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, []);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await loadPage(cursor);
      setReleases((current) => [...(current ?? []), ...page.releases]);
      setCursor(page.nextCursor);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="-mx-1 flex min-h-0 flex-col gap-6 overflow-y-auto px-1">
      {upcoming.length > 0 && (
        <ReleaseGroup title="Coming soon" note="On staging, not live yet" entries={upcoming} />
      )}
      {releases?.map((release, index) => (
        <ReleaseGroup
          key={release.id}
          title={releaseDate(release.createdAt)}
          note={index === 0 && upcoming.length === 0 ? "Latest" : undefined}
          entries={release.entries}
        />
      ))}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!releases && !error && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2].map((key) => <Skeleton key={key} className="h-12 w-full" />)}
        </div>
      )}
      {releases?.length === 0 && upcoming.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No updates yet. Check back soon.</p>
      )}
      {cursor && (
        <Button variant="ghost" className="self-center" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? "Loading…" : "Show older updates"}
        </Button>
      )}
    </div>
  );
}

function ReleaseGroup({ title, note, entries }: { title: string; note?: string; entries: Entry[] }) {
  const groups = categories
    .map((category) => ({ category, items: entries.filter((entry) => entry.category === category) }))
    .filter((group) => group.items.length > 0);
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="flex items-baseline justify-between gap-2 font-semibold">
        {title}
        {note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}
      </h3>
      {groups.map(({ category, items }) => (
        <div key={category} className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {categoryLabels[category]}
          </h4>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
            {items.map((entry) => (
              <li key={entry.id}>
                <span className="font-medium">{entry.title}</span>
                {entry.body && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{entry.body}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
