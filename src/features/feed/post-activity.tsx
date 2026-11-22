import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { LoadingSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage, type Poll } from "@/lib/api";
import { useLoadMore } from "@/hooks/use-load-more";

type ActivityPage = Awaited<ReturnType<typeof api.postActivity>>;
type ActivityType = Parameters<typeof api.postActivity>[1];
const emptyActivity: Record<ActivityType, string> = {
  likes: "No likes yet.",
  reposts: "No reposts yet.",
  quotes: "No quotes yet.",
  voters: "No votes yet.",
};

function ActivityList({
  postId,
  type,
  onNavigate,
  options,
}: {
  postId: string;
  type: ActivityType;
  onNavigate: () => void;
  options?: readonly number[];
}) {
  const [page, setPage] = useState<ActivityPage>({
    users: [],
    nextCursor: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const loadMoreRef = useLoadMore(() => {
    if (!page.nextCursor) return;
    setLoading(true);
    setCursor(page.nextCursor);
  }, Boolean(page.nextCursor) && !loading && !error);
  useEffect(() => {
    const controller = new AbortController();
    void api.postActivity(postId, type, { cursor, options, signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return;
        setPage((previous) => ({
          users: cursor
            ? [
                ...previous.users,
                ...result.users.filter(
                  (user) =>
                    !previous.users.some((existing) => existing.id === user.id),
                ),
              ]
            : result.users,
          nextCursor: result.nextCursor,
        }));
        setLoading(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason));
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [postId, type, cursor, options, attempt]);

  return (
    <div
      className="relative h-full min-h-0 overflow-y-auto overscroll-contain"
      aria-busy={loading}
    >
      <div
        aria-hidden={!loading || page.users.length > 0}
        className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${loading && page.users.length === 0 ? "opacity-100" : "opacity-0"}`}
      >
        <LoadingSkeleton label={`Loading ${type}…`}>
          <div className="divide-y">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex items-center gap-3 px-2 py-3">
                <Skeleton className="size-9 shrink-0 rounded-[30%] [corner-shape:squircle]" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </LoadingSkeleton>
      </div>
      <ul className="divide-y">
        {page.users.map((user) => (
          <li
            key={user.id}
            className="transition-opacity duration-300 ease-in-out starting:opacity-0 motion-reduce:transition-none"
          >
            <Link
              to={type === "quotes" && user.quoteId ? `/posts/${user.quoteId}` : `/@${user.handle}`}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="size-9 shrink-0" aria-hidden="true">
                {user.avatarUrl && (
                  <AvatarImage
                    src={user.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="text-xs">
                  {(user.displayName || user.handle).slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {user.displayName || user.handle}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user.handle}
                </p>
                {type === "quotes" && (
                  <p className="mt-1 text-xs">Quoted this post · view quote</p>
                )}
                {user.optionLabel && (
                  <p className="mt-1 text-xs wrap-anywhere">Voted for {user.optionLabel}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && !error && page.users.length === 0 && (
        <p
          role="status"
          className="py-6 text-center text-sm text-muted-foreground transition-opacity duration-300 ease-in-out starting:opacity-0 motion-reduce:transition-none"
        >
          {options?.length ? "No votes for the selected options." : emptyActivity[type]}
        </p>
      )}
      {error && (
        <div className="space-y-2 py-4 text-center transition-opacity duration-300 ease-in-out starting:opacity-0 motion-reduce:transition-none">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {loading && page.users.length > 0 && (
        <div role="status" aria-label={`Loading more ${type}`} className="divide-y">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3 px-2 py-3">
              <Skeleton className="size-9 shrink-0 rounded-[30%] [corner-shape:squircle]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      )}
      <div ref={loadMoreRef} aria-hidden="true" className="h-px" />
    </div>
  );
}

function VoterActivity({
  postId,
  options,
  onNavigate,
}: {
  postId: string;
  options: Poll["options"];
  onNavigate: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const filters = [
    { label: "All", index: undefined },
    ...options.map(({ label }, index) => ({ label, index })),
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="group"
        aria-label="Filter voters by option"
        className="flex shrink-0 gap-1.5 overflow-x-auto p-1"
      >
        {filters.map(({ label, index }) => (
          <Chip
            key={index ?? "all"}
            as="button"
            selected={index === undefined ? !selected.length : selected.includes(index)}
            size="sm"
            className="min-h-8 max-w-40 px-2.5 pointer-coarse:min-h-9"
            title={label}
            onClick={() =>
              setSelected((current) => {
                if (index === undefined) return current.length ? [] : current;
                return current.includes(index)
                  ? current.filter((option) => option !== index)
                  : [...current, index].sort((a, b) => a - b);
              })
            }
          >
            <span className="truncate">{label}</span>
          </Chip>
        ))}
      </div>
      <ActivityList
        key={selected.join(",")}
        postId={postId}
        type="voters"
        options={selected}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export function PostActivity({
  postId,
  poll,
}: {
  postId: string;
  poll: Poll | null;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const voterOptions = poll && !poll.anonymous ? poll.options : null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="ml-auto" />}
      >
        <Activity aria-hidden="true" />
        Activity
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post activity</DialogTitle>
          <DialogDescription>
            {voterOptions ? "See who liked, reposted, quoted, or voted." : "See who liked, reposted, or quoted this post."}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="likes" className="min-w-0 gap-3">
          <TabsList className="w-full rounded-full" aria-label="Post activity">
            <TabsTrigger value="likes" className="rounded-full">
              Likes
            </TabsTrigger>
            <TabsTrigger value="reposts" className="rounded-full">
              Reposts
            </TabsTrigger>
            <TabsTrigger value="quotes" className="rounded-full">
              Quotes
            </TabsTrigger>
            {voterOptions && (
              <TabsTrigger value="voters" className="rounded-full">
                Voters
              </TabsTrigger>
            )}
          </TabsList>
          {/* Outgoing panels stay mounted during fades; share one grid cell. */}
          <div className="grid h-[min(55dvh,24rem)] min-h-0 overflow-hidden">
            <TabsContent
              value="likes"
              keepMounted
              className="col-start-1 row-start-1 min-h-0 transition-opacity duration-300 ease-in-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
            >
              <ActivityList postId={postId} type="likes" onNavigate={close} />
            </TabsContent>
            <TabsContent
              value="reposts"
              keepMounted
              className="col-start-1 row-start-1 min-h-0 transition-opacity duration-300 ease-in-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
            >
              <ActivityList postId={postId} type="reposts" onNavigate={close} />
            </TabsContent>
            <TabsContent
              value="quotes"
              keepMounted
              className="col-start-1 row-start-1 min-h-0 transition-opacity duration-300 ease-in-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
            >
              <ActivityList postId={postId} type="quotes" onNavigate={close} />
            </TabsContent>
            {voterOptions && (
              <TabsContent
                value="voters"
                className="col-start-1 row-start-1 min-h-0 transition-opacity duration-300 ease-in-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
              >
                <VoterActivity postId={postId} options={voterOptions} onNavigate={close} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
