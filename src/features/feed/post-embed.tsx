import { timeAgo } from "@/lib/time-ago";
import { ArrowUpRight, ListChecks } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DisplayName } from "@/components/display-name";
import type { Post } from "@/lib/api";
import type { PostLink } from "./post-links";
import { PostImages } from "./post-images";
import { gifMediaUrl } from "@/lib/api";

export function PostEmbed({
  link,
  post,
  images,
}: {
  link: Extract<PostLink, { kind: "post" }>;
  post: Post | undefined;
  images: ReadonlySet<string>;
}) {
  const { href } = link;
  const className =
    "block rounded-xl border bg-muted/20 px-3 py-2.5 text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  const content = post ? (
    <span className="flex items-start gap-2.5">
      <Avatar className="size-7 shrink-0">
        {post.author.avatarUrl && images.has(post.author.avatarUrl) && (
          <AvatarImage
            src={post.author.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <AvatarFallback className="text-[0.65rem]">
          {post.author.displayName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <DisplayName
            user={post.author}
            className="max-w-full truncate font-semibold"
          />
          <span className="max-w-full truncate text-xs text-muted-foreground">
            @{post.author.handle}
          </span>
          <time
            className="text-xs text-muted-foreground"
            dateTime={post.createdAt}
            title={new Date(post.createdAt).toLocaleString()}
          >
            {timeAgo(post.createdAt)}
          </time>
        </span>
        {post.content && (
          <span className="line-clamp-3 leading-relaxed wrap-anywhere whitespace-pre-wrap">
            {post.content}
          </span>
        )}
        {post.poll && (
          <span className="flex items-start gap-1.5 text-muted-foreground">
            <ListChecks className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2 wrap-anywhere">
              {post.poll.title}
            </span>
          </span>
        )}
        {post.gif && images.has(post.gif.url) && (
          <img
            src={gifMediaUrl(post.gif.url)}
            alt={post.gif.title || "GIF"}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="max-h-40 max-w-full rounded-lg object-contain"
          />
        )}
        <PostImages ids={post.imageIds} compact />
      </span>
    </span>
  ) : (
    <span className="flex items-center justify-between gap-2">
      <span>
        <span className="font-semibold">View post</span>
        <span className="block text-xs text-muted-foreground">
          Preview unavailable
        </span>
      </span>
      <ArrowUpRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </span>
  );
  return new URL(href).origin === window.location.origin ? (
    <Link to={href} className={className}>
      {content}
    </Link>
  ) : (
    <a href={href} className={className}>
      {content}
    </a>
  );
}
