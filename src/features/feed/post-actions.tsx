import NumberFlow from "@number-flow/react";
import { Heart, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { Link } from "react-router";
import { IconButton } from "@/components/ui/icon-button";
import { countFormat } from "@/lib/count-format";
import type { Post } from "@/lib/api";
import type { FeedState } from "./use-feed";

export function PostActions({ post, feed }: { post: Post; feed: FeedState }) {
  const optimistic = feed.optimisticPostIds.includes(post.id);
  const disabled = !feed.canPost || feed.pending.includes(post.id);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-4">
      <IconButton
        variant="ghost"
        size="sm"
        className={post.liked ? "text-red-500" : ""}
        label={post.liked ? "Unlike post" : "Like post"}
        aria-pressed={post.liked}
        disabled={disabled}
        onClick={() => void feed.toggleLike(post)}
      >
        <Heart fill={post.liked ? "currentColor" : "none"} />
        <NumberFlow format={countFormat} value={post.likes} />
      </IconButton>
      <Link
        className="flex items-center gap-2"
        to={`/posts/${post.id}`}
        aria-label={`${post.replies} replies`}
        aria-disabled={optimistic || undefined}
        tabIndex={optimistic ? -1 : undefined}
        onClick={(event) => {
          if (optimistic) event.preventDefault();
        }}
      >
        <MessageCircle className="size-3.5" />
        <NumberFlow format={countFormat} value={post.replies} />
      </Link>
      <IconButton
        variant="ghost"
        size="sm"
        className={post.reposted ? "text-green-500" : ""}
        label={post.reposted ? "Undo repost" : "Repost"}
        aria-pressed={post.reposted}
        disabled={disabled}
        onClick={() => void feed.toggleRepost(post)}
      >
        <Repeat2 />
        <NumberFlow format={countFormat} value={post.reposts} />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        label="Share post"
        disabled={optimistic}
        onClick={() => void feed.sharePost(post)}
      >
        <Share2 />
      </IconButton>
    </div>
  );
}
