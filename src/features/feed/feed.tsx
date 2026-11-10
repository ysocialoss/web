import { ChevronDown, RotateCcw } from "lucide-react";
import {
  ComposerSkeleton,
  PostListSkeleton,
} from "@/components/loading-skeletons";
import { IconButton } from "@/components/ui/icon-button";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import type { FeedState } from "./use-feed";

export function Feed({ feed }: { feed: FeedState }) {
  return (
    <>
      <div className="min-h-13 md:min-h-14">
        {feed.sessionLoading ? (
          <ComposerSkeleton />
        ) : (
          <PostComposer feed={feed} />
        )}
      </div>
      <div className="mx-auto mt-6 w-full max-w-xl divide-y divide-border">
        {feed.error && (
          <div role="alert" className="py-3">
            <p>{feed.error}</p>
            <IconButton label="Reload posts" onClick={() => void feed.retry()}>
              <RotateCcw />
            </IconButton>
          </div>
        )}
        {feed.feedPosts.map((post) => (
          <PostCard key={post.id} post={post} feed={feed} />
        ))}
        {feed.loading && (
          <PostListSkeleton
            count={feed.feedPosts.length ? 2 : 4}
            lockScroll={feed.feedPosts.length === 0}
          />
        )}
        {!feed.loading && !feed.error && feed.feedPosts.length === 0 && (
          <p className="py-4 text-muted-foreground">No posts yet.</p>
        )}
        {feed.loadMore && (
          <div className="flex justify-center pt-4">
            <IconButton
              label="Load more posts"
              disabled={feed.loading}
              onClick={() => void feed.loadMore?.()}
            >
              <ChevronDown />
            </IconButton>
          </div>
        )}
      </div>
    </>
  );
}
