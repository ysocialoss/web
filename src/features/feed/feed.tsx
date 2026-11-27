import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { CircleCheck, Ellipsis, RotateCcw } from "lucide-react";
import {
  ComposerSkeleton,
  PostListSkeleton,
} from "@/components/loading-skeletons";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import type { Post } from "@/lib/api";
import type { FeedState } from "./use-feed";
import { PullToRefresh } from "./pull-to-refresh.tsx";
import { FeedTrackingContext } from "./tracking/tracking-context";
import type { FeedSurface } from "./tracking/tracker";
import {
  NewPostDialog,
  NewPostsNudge,
  useAtTop,
  useOutOfView,
} from "./feed-floaters";

// Start fetching the next page while the reader is still this far (in px)
// above the end of the list, so new posts are usually there before they scroll.
const PREFETCH_DISTANCE = 900;

export function Feed({
  feed,
  refreshKey,
  header,
  showComposer = true,
  emptyMessage = "No posts yet.",
  surface,
  floater,
}: {
  feed: FeedState;
  surface?: FeedSurface;
  refreshKey?: string;
  /** Shown where the composer would be, e.g. a topic's title. */
  header?: ReactNode;
  showComposer?: boolean;
  emptyMessage?: string;
  floater?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const composerBox = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const { loadMore, loading, error, feedPosts, unread, revealNew } = feed;
  useAtTop(anchor, () => {
    if (unread) revealNew();
  });
  const composerHidden = useOutOfView(
    composerBox,
    showComposer && feed.canPost,
  );
  const selfReplyIds = new Set(
    feedPosts.flatMap((post) => (post.selfReply ? [post.selfReply.id] : [])),
  );
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !loadMore || loading || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      {
        root: target.closest(".content-scroll"),
        rootMargin: `0px 0px ${PREFETCH_DISTANCE}px 0px`,
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
    // feedPosts.length: a fresh observer re-checks whether the end is still
    // close after every page, which keeps short pages loading until it isn't.
  }, [loadMore, loading, error, feedPosts.length]);
  return (
    <PullToRefresh
      disabled={feed.loading}
      onRefresh={feed.refresh}
      refreshKey={refreshKey}
    >
      <div ref={anchor} />
      <NewPostsNudge count={unread} anchor={anchor} onShow={revealNew} />
      {header}
      {showComposer && !feed.readOnly && (
        <div ref={composerBox} className="min-h-24">
          {feed.sessionLoading ? (
            <ComposerSkeleton />
          ) : (
            <PostComposer feed={feed} inspire />
          )}
        </div>
      )}
      <div className="mx-auto mt-6 w-full max-w-xl divide-y divide-border">
        {feed.error && (
          <div role="alert" className="py-3">
            <p>{feed.error}</p>
            <IconButton label="Reload posts" onClick={() => void feed.retry()}>
              <RotateCcw />
            </IconButton>
          </div>
        )}
        {feed.feedPosts
          .filter((post) => !selfReplyIds.has(post.id))
          .map((post, position) => (
            <div
              key={post.id}
              className={
                feed.enteringIds.has(post.id) ? "live-enter" : undefined
              }
            >
              <FeedTrackingContext.Provider
                value={{
                  surface,
                  position: feed.placements[post.id]?.position ?? position,
                  requestId: feed.placements[post.id]?.requestId,
                  reason: feed.placements[post.id]?.reason,
                }}
              >
                <FeedItem post={post} feed={feed} />
              </FeedTrackingContext.Provider>
            </div>
          ))}
        {feed.loading && (
          <PostListSkeleton
            count={feed.feedPosts.length ? 2 : 4}
            label={
              feed.feedPosts.length ? "Loading more posts…" : "Loading posts…"
            }
            lockScroll={feed.feedPosts.length === 0}
          />
        )}
        {!feed.loading && !feed.error && feed.feedPosts.length === 0 && !feed.caughtUp && (
          <p className="py-4 text-muted-foreground">{emptyMessage}</p>
        )}
        {feed.ranked && feed.fallback && !feed.loading && feed.feedPosts.length > 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            Showing recent posts while the feed catches up.
          </p>
        )}
        {feed.ranked && !feed.loading && !feed.error && (feed.caughtUp || (!feed.loadMore && feed.feedPosts.length > 0)) && (
          <CaughtUp onRefresh={() => void feed.refresh()} />
        )}
        {feed.loadMore && feed.error && feed.feedPosts.length > 0 && (
          <div className="flex justify-center py-4">
            <Button variant="outline" onClick={() => void feed.loadMore?.()}>
              <RotateCcw aria-hidden="true" />
              Try loading more
            </Button>
          </div>
        )}
      </div>
      {feed.loadMore && (
        <div ref={sentinel} aria-hidden="true" className="h-px" />
      )}
      {floater}
      {showComposer && feed.canPost && (
        <NewPostDialog feed={feed} show={composerHidden} anchor={anchor} />
      )}
    </PullToRefresh>
  );
}

function CaughtUp({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <CircleCheck className="size-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="font-medium">You're all caught up</p>
        <p className="text-sm text-muted-foreground">
          You have seen the posts picked for you. New ones show up as people post.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRefresh}>
          <RotateCcw aria-hidden="true" />
          Refresh
        </Button>
        <Button variant="ghost" render={<Link to="/following" />}>
          Open Following
        </Button>
      </div>
    </div>
  );
}

const untracked = { track: false };

// Longer chains above a reply are cut down to the root and the last two posts.
const MAX_SHOWN_ANCESTORS = 4;

/** A post, preceded by the thread above it when it is a reply. */
function FeedItem({ post, feed }: { post: Post; feed: FeedState }) {
  const ancestors = (post.ancestors ?? []).flatMap((ancestor) => {
    const resolved = feed.resolvePost(ancestor);
    return resolved ? [resolved] : [];
  });
  const repost = feed.repostContext(post);
  if (ancestors.length === 0) {
    const selfReply = post.selfReply ? feed.resolvePost(post.selfReply) : null;
    if (!selfReply)
      return <PostCard post={post} feed={feed} repost={repost} replyContext />;
    const hidden = selfReply.replies;
    return (
      <div>
        <PostCard
          post={post}
          feed={feed}
          repost={repost}
          replyContext
          connectToNext="tight"
        />
        <FeedTrackingContext.Provider value={untracked}>
          <PostCard
            post={selfReply}
            feed={feed}
            compact
            connectFromPrev
            connectToNext={hidden > 0 ? "tight" : false}
          />
        </FeedTrackingContext.Provider>
        {hidden > 0 && (
          <div className="relative pb-3 pl-12">
            <Link
              to={`/posts/${selfReply.id}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Ellipsis className="size-3.5" aria-hidden="true" />
              {hidden} {hidden === 1 ? "comment" : "comments"} hidden
            </Link>
          </div>
        )}
      </div>
    );
  }
  const collapse = ancestors.length > MAX_SHOWN_ANCESTORS;
  const items: ({ ancestor: Post } | { gap: number })[] = collapse
    ? [
        { ancestor: ancestors[0] },
        { gap: ancestors.length - 3 },
        ...ancestors.slice(-2).map((ancestor) => ({ ancestor })),
      ]
    : ancestors.map((ancestor) => ({ ancestor }));
  return (
    <div>
      {items.map((item, index) =>
        "gap" in item ? (
          <div key="gap" className="relative py-2 pl-12">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-4.25 w-0.5 rounded-full bg-border"
            />
            <Link
              to={`/posts/${post.id}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Ellipsis className="size-3.5" aria-hidden="true" />
              Show {item.gap} earlier {item.gap === 1 ? "post" : "posts"}
            </Link>
          </div>
        ) : (
          <FeedTrackingContext.Provider key={item.ancestor.id} value={untracked}>
            <PostCard
              post={item.ancestor}
              feed={feed}
              compact
              connectToNext="tight"
              connectFromPrev={index > 0}
            />
          </FeedTrackingContext.Provider>
        ),
      )}
      <PostCard post={post} feed={feed} repost={repost} connectFromPrev />
    </div>
  );
}
