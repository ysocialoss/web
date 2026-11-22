import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bookmark, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconLink } from "@/components/ui/icon-button";
import { PostListSkeleton } from "@/components/loading-skeletons";
import { useGoBack } from "@/hooks/use-go-back";
import { useLoadMore } from "@/hooks/use-load-more";
import { usePageTitle } from "@/hooks/use-page-title";
import { api, errorMessage, type Post, type Session } from "@/lib/api";
import { PostCard } from "./post-card";
import { rememberPosts } from "./optimistic-actions";
import { useFeed } from "./use-feed";

export function SavedPage({ session }: { session: Session | null }) {
  usePageTitle("Saved posts");
  const feed = useFeed(session, undefined, false);
  const goBack = useGoBack();
  const [items, setItems] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { viewerId } = feed;
  const signedIn = session !== null && viewerId !== null;

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    void api.savedPosts(cursor, controller.signal).then(
      (page) => {
        if (controller.signal.aborted) return;
        rememberPosts(page.posts, viewerId);
        setItems((previous) =>
          cursor
            ? [...previous, ...page.posts.filter((post) => !previous.some(({ id }) => id === post.id))]
            : page.posts,
        );
        setNextCursor(page.nextCursor);
        setLoading(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason));
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [signedIn, viewerId, cursor, attempt]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setLoading(true);
    setCursor(nextCursor);
  }, [nextCursor]);
  const sentinel = useLoadMore(loadMore, Boolean(nextCursor) && !loading && !error);

  const posts = items
    .map(feed.resolvePost)
    .filter((post): post is Post => post !== null && post.saved);

  return (
    <div className="mx-auto w-full max-w-xl">
      <header>
        <IconLink to="/" label="Back" onClick={goBack}>
          <ArrowLeft />
        </IconLink>
        <h1 className="mt-2 text-2xl font-semibold">Saved posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Posts you saved. Only you can see this page.</p>
      </header>
      <div className="mt-6 divide-y divide-border">
        {!signedIn && session !== null && (
          <p className="py-4 text-muted-foreground">Sign in and choose your handle to see your saved posts.</p>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} feed={feed} />
        ))}
        {signedIn && loading && (
          <PostListSkeleton
            count={posts.length ? 2 : 4}
            label={posts.length ? "Loading more saved posts…" : "Loading saved posts…"}
            lockScroll={posts.length === 0}
          />
        )}
        {signedIn && !loading && !error && posts.length === 0 && (
          <div role="status" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="mb-1 rounded-full bg-muted p-4">
              <Bookmark className="size-6 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="font-medium">No saved posts yet</p>
            <p className="max-w-64 text-sm text-muted-foreground">Open a post's menu and choose Save to keep it here.</p>
          </div>
        )}
        {error && (
          <div className="space-y-2 py-4 text-center">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError("");
                setLoading(true);
                setAttempt((value) => value + 1);
              }}
            >
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
          </div>
        )}
      </div>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
    </div>
  );
}
