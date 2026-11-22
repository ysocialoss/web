import { useState } from "react";
import NumberFlow from "@number-flow/react";
import {
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  Undo2,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import { ActionMenu } from "@/components/ui/action-menu";
import { IconButton } from "@/components/ui/icon-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ShareButton } from "@/features/sharing/share-button";
import { countFormat } from "@/lib/count-format";
import type { Post } from "@/lib/api";
import { toast } from "@/components/ui/toast-manager";
import type { FeedState } from "./use-feed";
import { QuoteDialog } from "./quote-dialog";

const actionClass = (extra?: string | false) =>
  cn("gap-1.5 px-2 text-muted-foreground", extra);

export function PostActions({ post, feed }: { post: Post; feed: FeedState }) {
  const [quoting, setQuoting] = useState(false);
  const optimistic = feed.optimisticPostIds.includes(post.id);
  const disabled = feed.pending.includes(post.id);
  // Signed-out people get an explanation instead of dead, greyed-out buttons.
  function react(action: "like" | "repost" | "quote", run: () => unknown) {
    if (feed.canPost) return void run();
    toast.add({
      title: feed.authenticated
        ? `Choose a handle to ${action} posts`
        : `Log in to ${action} posts`,
      timeout: 4000,
      actionProps: feed.authenticated
        ? {
            children: "Finish profile",
            onClick: () => location.assign("/onboarding"),
          }
        : { children: "Log in", onClick: () => location.assign("/auth/login") },
    });
  }
  return (
    <div className="-ml-2 mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:gap-3">
      <IconButton
        variant="ghost"
        size="sm"
        className={actionClass(post.liked && "text-red-500 hover:text-red-500")}
        label={post.liked ? "Unlike post" : "Like post"}
        aria-pressed={post.liked}
        disabled={disabled || feed.readOnly}
        onClick={() => react("like", () => feed.toggleLike(post))}
      >
        <Heart
          key={String(post.liked)}
          className={post.liked ? "animate-[pop_420ms_ease-out]" : undefined}
          fill={post.liked ? "currentColor" : "none"}
        />
        <NumberFlow format={countFormat} value={post.likes} />
      </IconButton>
      <Link
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          actionClass(),
          "gap-1.5",
          optimistic && "pointer-events-none opacity-50",
        )}
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
      {(() => {
        const repostButton = (
          <IconButton
            variant="ghost"
            size="sm"
            className={actionClass(
              post.reposted && "text-green-500 hover:text-green-500",
            )}
            label={
              post.reposted
                ? post.repostAudience === "friends"
                  ? "Reposted to friends"
                  : "Reposted"
                : "Repost or quote"
            }
            aria-haspopup="menu"
            disabled={disabled || feed.readOnly}
            // Signed-out people get the explanation toast instead of the menu.
            onClick={
              feed.canPost
                ? undefined
                : (event) => {
                    event.preventDefault();
                    react("repost", () => undefined);
                  }
            }
          >
            <Repeat2
              key={String(post.reposted)}
              className={post.reposted ? "animate-[turn_500ms_ease-in-out]" : undefined}
            />
            {post.repostAudience === "friends" && (
              <Users className="-ml-1 size-3" aria-hidden="true" />
            )}
            <NumberFlow format={countFormat} value={post.reposts + post.quotes} />
          </IconButton>
        );
        const isPublic = post.reposted && post.repostAudience !== "friends";
        const isFriends = post.reposted && post.repostAudience === "friends";
        return feed.canPost ? (
          <ActionMenu
            title="Repost options"
            hideTitle
            large
            trigger={repostButton}
            items={[
              {
                kind: "action",
                icon: isPublic ? Undo2 : Repeat2,
                label: isPublic ? "Undo repost" : "Repost",
                onClick: () => feed.setRepost(post, isPublic ? null : "public"),
              },
              {
                kind: "action",
                icon: isFriends ? Undo2 : Users,
                label: isFriends ? "Undo repost to friends" : "Repost to friends",
                onClick: () => feed.setRepost(post, isFriends ? null : "friends"),
              },
              {
                kind: "action",
                icon: Quote,
                label: "Quote",
                onClick: () => setQuoting(true),
              },
            ]}
          />
        ) : (
          repostButton
        );
      })()}
      <ShareButton
        target={{ kind: "post", id: post.id }}
        viewerId={feed.viewerId}
        disabled={optimistic}
      />
      {quoting && (
        <QuoteDialog post={post} feed={feed} open={quoting} onOpenChange={setQuoting} />
      )}
    </div>
  );
}
