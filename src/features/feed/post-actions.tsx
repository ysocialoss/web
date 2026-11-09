import NumberFlow from "@number-flow/react";
import { Heart, MessageCircle, Repeat2, Share2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countFormat } from "@/lib/count-format";
import type { Post } from "./data";
import type { FeedState } from "./use-feed";

type PostActionsProps = {
  post: Post;
  feed: Pick<
    FeedState,
    | "likedPosts"
    | "setLikedPosts"
    | "repostedPosts"
    | "setRepostedPosts"
    | "bookmarkedPosts"
    | "setBookmarkedPosts"
    | "shareCounts"
    | "sharePost"
  >;
};

export function PostActions({ post, feed }: PostActionsProps) {
  const {
    likedPosts,
    setLikedPosts,
    repostedPosts,
    setRepostedPosts,
    bookmarkedPosts,
    setBookmarkedPosts,
    shareCounts,
    sharePost,
  } = feed;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-4">
      <Button
        variant="ghost"
        size="sm"
        className={`-ml-2 gap-2 hover:text-red-500 focus-visible:text-red-500 ${likedPosts.includes(post.id) ? "text-red-500" : "text-muted-foreground"}`}
        aria-label={`Like post by ${post.name}`}
        aria-pressed={likedPosts.includes(post.id)}
        onClick={() =>
          setLikedPosts((current) =>
            current.includes(post.id)
              ? current.filter((id) => id !== post.id)
              : [...current, post.id],
          )
        }
      >
        <Heart fill={likedPosts.includes(post.id) ? "currentColor" : "none"} />
        <NumberFlow
          locales="en-US"
          format={countFormat}
          value={post.likes + (likedPosts.includes(post.id) ? 1 : 0)}
          className="tabular-nums"
        />
      </Button>
      <span
        className="flex items-center gap-2 transition-colors hover:text-sky-500"
        aria-label={`${post.replies} replies`}
      >
        <MessageCircle className="size-3.5" />
        <NumberFlow
          locales="en-US"
          format={countFormat}
          value={post.replies}
          className="tabular-nums"
        />
      </span>
      <Button
        variant="ghost"
        size="sm"
        className={`hover:text-green-500 focus-visible:text-green-500 ${repostedPosts.includes(post.id) ? "text-green-500" : "text-muted-foreground"}`}
        aria-label={`Repost post by ${post.name}`}
        aria-pressed={repostedPosts.includes(post.id)}
        onClick={() =>
          setRepostedPosts((current) =>
            current.includes(post.id)
              ? current.filter((id) => id !== post.id)
              : [...current, post.id],
          )
        }
      >
        <Repeat2 />
        <NumberFlow
          locales="en-US"
          format={countFormat}
          value={post.reposts + (repostedPosts.includes(post.id) ? 1 : 0)}
          className="tabular-nums"
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Share post by ${post.name}`}
        className="text-muted-foreground hover:text-sky-500 focus-visible:text-sky-500"
        onClick={() => sharePost(post)}
      >
        <Share2 />
        <NumberFlow
          locales="en-US"
          format={countFormat}
          value={post.shares + (shareCounts[post.id] ?? 0)}
          className="tabular-nums"
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`hover:text-yellow-500 focus-visible:text-yellow-500 ${bookmarkedPosts.includes(post.id) ? "text-yellow-500" : "text-muted-foreground"}`}
        aria-label={`Bookmark post by ${post.name}`}
        aria-pressed={bookmarkedPosts.includes(post.id)}
        onClick={() =>
          setBookmarkedPosts((current) =>
            current.includes(post.id)
              ? current.filter((id) => id !== post.id)
              : [...current, post.id],
          )
        }
      >
        <Bookmark
          fill={bookmarkedPosts.includes(post.id) ? "currentColor" : "none"}
        />
        <NumberFlow
          locales="en-US"
          format={countFormat}
          value={post.bookmarks + (bookmarkedPosts.includes(post.id) ? 1 : 0)}
          className="tabular-nums"
        />
      </Button>
    </div>
  );
}
