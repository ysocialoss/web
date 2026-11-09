import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import type { FeedState } from "./use-feed";

export function Feed({ feed }: { feed: FeedState }) {
  return (
    <>
      <PostComposer
        draft={feed.draft}
        setDraft={feed.setDraft}
        publishPost={feed.publishPost}
      />
      <div className="mx-auto mt-6 w-full max-w-xl divide-y divide-border">
        {feed.feedPosts.map((post) => (
          <PostCard key={post.id} post={post} feed={feed} />
        ))}
        <p role="status" className="text-xs text-muted-foreground">
          {feed.shareStatus}
        </p>
      </div>
    </>
  );
}
