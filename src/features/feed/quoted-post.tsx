import type { MouseEvent, ReactNode } from "react";
import { timeAgo } from "@/lib/time-ago";
import { ChartNoAxesColumn, Quote } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DisplayName } from "@/components/display-name";
import { cn } from "@/lib/utils";
import type { PostQuote } from "@/lib/api";
import { PostText } from "./post-text";
import { PostImages } from "./post-images";

/**
 * The post a quote embeds: author, text, GIF and a poll hint. It opens the
 * original unless `interactive` is off (inside the quote dialog).
 */
export function QuotedPostCard({
  quote,
  interactive = true,
  className,
}: {
  quote: PostQuote;
  interactive?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  if (quote.state === "unavailable") {
    return (
      <div
        className={cn(
          "mt-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground",
          className,
        )}
      >
        This post was deleted.
      </div>
    );
  }
  const post = quote.post;
  // Links can't nest, so the card is a box that opens the post when clicked.
  // The author line is the keyboard-focusable link; links in the text and
  // their previews keep working on their own.
  const classes = cn(
    "mt-2 block min-w-0 rounded-xl border p-3 text-left transition-colors",
    interactive &&
      "cursor-pointer hover:bg-muted/50 has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-ring",
    className,
  );
  function open(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    // Portaled dialogs (the external link warning) bubble through React.
    if (!interactive || !event.currentTarget.contains(target)) return;
    if (target.closest("a, button")) return;
    // Keep the surrounding post from opening instead.
    event.stopPropagation();
    if (window.getSelection()?.toString() || event.detail > 1) return;
    const path = `/posts/${post.id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(path, "_blank");
      return;
    }
    // Let a double click select a word before navigating.
    window.setTimeout(
      () => {
        if (!window.getSelection()?.toString()) void navigate(path);
      },
      target.closest("[data-selectable]") ? 220 : 0,
    );
  }
  const body = (
    <>
      <Header interactive={interactive} id={post.id} name={post.author.displayName}>
        <Avatar userId={post.author.id} className="size-5 shrink-0" aria-hidden="true">
          {post.author.avatarUrl && (
            <AvatarImage src={post.author.avatarUrl} alt="" referrerPolicy="no-referrer" />
          )}
          <AvatarFallback className="text-[9px]">
            {(post.author.displayName || post.author.handle).slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <DisplayName user={post.author} className="truncate font-semibold" />
        <span className="truncate text-xs text-muted-foreground">@{post.author.handle}</span>
        <time
          dateTime={post.createdAt}
          className="shrink-0 text-xs text-muted-foreground"
          title={new Date(post.createdAt).toLocaleString()}
        >
          {timeAgo(post.createdAt)}
        </time>
      </Header>
      {post.content && (
        <PostText
          post={{
            id: post.id,
            content: post.content,
            mentions: post.mentions,
          }}
          previewExternalLinks
          className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap"
        />
      )}
      {post.gif && (
        <img
          src={post.gif.url}
          alt={post.gif.title}
          loading="lazy"
          decoding="async"
          className="mt-2 max-h-48 w-auto max-w-full rounded-lg object-contain"
        />
      )}
      <PostImages ids={post.imageIds} compact />
      {post.pollTitle && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ChartNoAxesColumn className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Poll: {post.pollTitle}</span>
        </p>
      )}
      {post.isQuote && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Quote className="size-3.5 shrink-0" aria-hidden="true" />
          Quotes another post
        </p>
      )}
    </>
  );
  return (
    <div className={classes} onClick={open}>
      {body}
    </div>
  );
}

function Header({
  interactive,
  id,
  name,
  children,
}: {
  interactive: boolean;
  id: string;
  name: string;
  children: ReactNode;
}) {
  const className = "flex min-w-0 items-center gap-2 text-sm";
  return interactive ? (
    <Link
      to={`/posts/${id}`}
      data-card-link
      aria-label={`Quoted post by ${name}`}
      className={cn(className, "rounded-md outline-none")}
    >
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
