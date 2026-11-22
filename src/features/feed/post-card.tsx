import { PublishedVoicePlayer } from "./voice-player";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import { formatDistance } from "date-fns";
import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DisplayName } from "@/components/display-name";
import { MentionLink } from "./mention-text";
import { MentionTextarea } from "./mention-textarea";
import { PostActions } from "./post-actions";
import { PostText } from "./post-text";
import { hasTooManyBlankLines, limitBlankLines } from "./post-content";
import { PostPoll } from "./post-poll";
import { QuotedPostCard } from "./quoted-post";
import { RepostHeader } from "./repost-header";
import { AvatarCircles } from "@/components/ui/avatar-circles";
import { EditHistory } from "./edit-history";
import { cn } from "@/lib/utils";
import type { Post, RepostContext } from "@/lib/api";
import {
  JUMBO_MAX,
  emojiOnlyCount,
  loadEmojiIndex,
  peekEmojiIndex,
  renderShortcodes,
  toShortcodes,
} from "@/lib/emoji";
import { useEmojiIndex } from "@/lib/use-emoji-index";
import type { FeedState } from "./use-feed";
import { watchPost } from "./live-states";

export function PostCard({
  post,
  feed,
  connectToNext = false,
  lineClassName,
  connectFromPrev = false,
  compact = false,
  focused = false,
  repost = null,
  replyContext = false,
}: {
  post: Post;
  feed: FeedState;
  /** Draw the thread line below the avatar. "tight" stops at the card edge. */
  connectToNext?: boolean | "tight";
  lineClassName?: string;
  /** A thread line arrives from the post above; draw it down to the avatar. */
  connectFromPrev?: boolean;
  /** Tighter padding, used for nested replies. */
  compact?: boolean;
  /** The post a thread page is about: not clickable, slightly larger text. */
  focused?: boolean;
  /** Why this post is in the list: someone reposted it. */
  repost?: RepostContext | null;
  /** Say who a reply answers, for replies shown outside their thread. */
  replyContext?: boolean;
}) {
  const navigate = useNavigate();
  const editorId = useId();
  const editorHelpId = useId();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const articleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = articleRef.current;
    return element ? watchPost(element, post.id, feed.viewerId) : undefined;
  }, [post.id, feed.viewerId]);
  const optimistic = feed.optimisticPostIds.includes(post.id);
  const mine = feed.canPost && post.author.id === feed.viewerId;
  const busy = feed.pending.includes(post.id);
  const emojiIndex = useEmojiIndex(editing);
  const finalContent = emojiIndex
    ? renderShortcodes(content, emojiIndex)
    : content;
  const length = Array.from(finalContent.trim()).length;
  const hasAttachment = Boolean(post.gif || post.poll || post.voice);
  const validCaption = (length > 0 || hasAttachment) && length <= 2000;
  const changed = finalContent.trim() !== post.content.trim();
  const jumbo = post.gif || post.voice ? 0 : emojiOnlyCount(post.content);
  const profilePath = `/@${post.author.handle}`;
  const openable = !focused && !optimistic && !editing;
  const openTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(openTimer.current), []);
  function openPost(event: MouseEvent<HTMLElement>) {
    window.clearTimeout(openTimer.current);
    if (!openable || event.defaultPrevented || event.button !== 0) return;
    const target = event.target as HTMLElement;
    // Portals (dialogs, tooltips) bubble through React but are not inside the card.
    if (!event.currentTarget.contains(target)) return;
    if (target.closest("a, button, input, textarea, label, [role='button'], [data-slot='tooltip-trigger']"))
      return;
    // Dragging to select ends in a click too; keep the selection.
    if (window.getSelection()?.toString()) return;
    const path = `/posts/${post.id}`;
    if (event.metaKey || event.ctrlKey) {
      window.open(path, "_blank");
      return;
    }
    // Double and triple clicks select a word or line. Wait briefly on the
    // text so the second click can cancel the navigation.
    if (event.detail > 1) return;
    const wait = target.closest("[data-selectable]") ? 220 : 0;
    openTimer.current = window.setTimeout(() => {
      if (!window.getSelection()?.toString()) void navigate(path);
    }, wait);
  }
  function closeEditor() {
    setContent(post.content);
    setEditing(false);
  }
  function save() {
    if (busy || !changed || !validCaption) return;
    if (feed.editPost(post, finalContent)) setEditing(false);
  }
  function startEditing() {
    const editableContent = hasTooManyBlankLines(post.content)
      ? limitBlankLines(post.content.replace(/\r\n/g, "\n")).value
      : post.content;
    const loaded = peekEmojiIndex();
    if (loaded || !/[^ -~\s]/.test(editableContent)) {
      setContent(loaded ? toShortcodes(editableContent, loaded) : editableContent);
      setEditing(true);
      return;
    }
    loadEmojiIndex()
      .then((index) => setContent(toShortcodes(editableContent, index)))
      .catch(() => setContent(editableContent))
      .finally(() => setEditing(true));
  }
  return (
    <article
      ref={articleRef}
      id={`post-${post.id}`}
      onClick={openPost}
      className={cn(
        "relative animate-in fade-in-0 duration-300",
        compact ? "py-3" : "py-5",
        openable && "cursor-pointer",
      )}
    >
      {connectFromPrev && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-0 left-4.25 w-0.5 bg-border",
            compact ? "h-3" : "h-5",
          )}
        />
      )}
      {connectToNext && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-4.25 w-0.5 rounded-t-full transition-colors",
            lineClassName ?? "bg-border",
            connectToNext === "tight"
              ? "bottom-0 top-12"
              : compact
                ? "-bottom-2 top-12"
                : "-bottom-4 top-15",
          )}
        />
      )}
      {repost && <RepostHeader repost={repost} viewerId={feed.viewerId} />}
      <div className="flex items-start gap-3">
        <div className="relative size-9 shrink-0">
          <div
            role="status"
            aria-hidden={!optimistic}
            className={`pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground transition-opacity duration-300 ease-in-out starting:opacity-0 motion-reduce:transition-none ${optimistic ? "opacity-100" : "opacity-0"}`}
          >
            <LoaderCircle
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="sr-only">{optimistic ? "Sending post…" : ""}</span>
          </div>
          <Link
            to={profilePath}
            aria-label={`View ${post.author.displayName}'s profile`}
            aria-hidden={optimistic || undefined}
            tabIndex={optimistic ? -1 : undefined}
            className={`absolute inset-0 rounded-[30%] [corner-shape:squircle] outline-none transition-opacity duration-300 ease-in-out starting:opacity-0 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${optimistic ? "pointer-events-none opacity-0" : "opacity-100"}`}
          >
            <Avatar className="size-9">
              {post.author.avatarUrl && (
                <AvatarImage
                  src={post.author.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback className="text-xs">
                {post.author.displayName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex flex-1 flex-wrap items-baseline gap-x-2 text-sm">
              <Link
                to={profilePath}
                className="font-semibold hover:underline underline-offset-4"
              >
                <DisplayName user={post.author} />
              </Link>
              <Link
                to={profilePath}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                @{post.author.handle}
              </Link>
              <Link
                to={`/posts/${post.id}`}
                className="text-xs text-muted-foreground"
                aria-label="Open post"
                aria-disabled={optimistic || undefined}
                tabIndex={optimistic ? -1 : undefined}
                onClick={(event) => {
                  if (optimistic) event.preventDefault();
                }}
              >
                <time
                  dateTime={post.createdAt}
                  title={new Date(post.createdAt).toLocaleString()}
                >
                  {formatDistance(new Date(post.createdAt), now, {
                    addSuffix: true,
                  })}
                </time>
              </Link>
              {post.editedAt && (
                <EditHistory postId={post.id} editedAt={post.editedAt} />
              )}
            </div>
            {mine && (
              <div className="-my-1.5 flex shrink-0 gap-0.5">
                {editing ? (
                  <>
                    <IconButton
                      label="Save changes"
                      size="icon-sm"
                      disabled={busy || !changed || !validCaption}
                      onClick={save}
                    >
                      <Check />
                    </IconButton>
                    <IconButton
                      label="Cancel editing"
                      size="icon-sm"
                      disabled={busy}
                      onClick={closeEditor}
                    >
                      <X />
                    </IconButton>
                  </>
                ) : (
                  <>
                    {now < Date.parse(post.editExpiresAt) && (
                      <IconButton
                        label="Edit post"
                        size="icon-sm"
                        disabled={busy}
                        onClick={startEditing}
                      >
                        <Pencil />
                      </IconButton>
                    )}
                    <IconButton
                      label="Delete post"
                      size="icon-sm"
                      disabled={busy}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 />
                    </IconButton>
                  </>
                )}
              </div>
            )}
          </div>
          {replyContext && post.replyTo && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Replying to{" "}
              <MentionLink handle={post.replyTo.handle}>
                @{post.replyTo.handle}
              </MentionLink>
            </p>
          )}
          {editing ? (
            <div className="mt-2 space-y-2">
              <label htmlFor={editorId} className="sr-only">
                Edit post
              </label>
              <MentionTextarea
                id={editorId}
                limitPostBlankLines
                aria-describedby={editorHelpId}
                aria-invalid={!validCaption}
                autoFocus
                rows={3}
                emojis="plain"
                className="max-h-96 resize-y text-sm leading-relaxed"
                value={content}
                onValueChange={setContent}
                disabled={busy}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !busy) {
                    event.preventDefault();
                    closeEditor();
                  }
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    if (!event.repeat) save();
                  }
                }}
              />
              <div
                id={editorHelpId}
                className="flex justify-between gap-3 text-xs text-muted-foreground"
              >
                <p>
                  {!length && !hasAttachment
                    ? "Write something before saving."
                    : length > 2000
                      ? `Remove ${length - 2000} characters to save.`
                      : null}
                </p>
                <span
                  className={`ml-auto shrink-0 tabular-nums ${length > 2000 ? "text-destructive" : ""}`}
                >
                  {length.toLocaleString()}/2,000
                </span>
              </div>
            </div>
          ) : (
            post.content && (
              <PostText
                key={`${post.id}:${post.editedAt ?? ""}:${post.content}`}
                post={post}
                previewExternalLinks={!optimistic}
                collapsible={!focused}
                className={cn(
                  "mt-2 whitespace-pre-wrap break-words",
                  jumbo > 0 && jumbo <= JUMBO_MAX
                    ? jumbo <= 6
                      ? "text-5xl leading-tight"
                      : "text-3xl leading-snug"
                    : cn("leading-relaxed", focused ? "text-base" : "text-sm"),
                )}
              />
            )
          )}
          {post.voice && (
            <PublishedVoicePlayer
              url={post.voice.url}
              durationMs={post.voice.durationMs}
              peaks={post.voice.waveform}
              pending={optimistic}
            />
          )}
          {post.gif && (
            <img
              src={post.gif.url}
              alt={post.gif.title}
              loading="lazy"
              decoding="async"
              className="mt-2 max-h-96 w-auto max-w-full rounded-xl object-contain"
            />
          )}
          {post.quote && <QuotedPostCard quote={post.quote} />}
          {post.poll && (
            <PostPoll
              postId={post.id}
              poll={post.poll}
              viewerId={feed.viewerId}
              live={!optimistic && !feed.sessionLoading}
              promptLogin={!optimistic && !feed.sessionLoading && !feed.authenticated}
              canVote={feed.canPost && !optimistic}
              voting={feed.isVoting(post)}
              onVote={(optionIndex) => feed.vote(post, optionIndex)}
            />
          )}
          <PostActions post={post} feed={feed} />
          {post.friendLikes > 0 && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <AvatarCircles
                size="sm"
                people={post.friendLikers}
                extra={Math.max(0, post.friendLikes - post.friendLikers.length)}
              />
              <span>
                {post.friendLikes.toLocaleString()}{" "}
                {post.friendLikes === 1 ? "friend" : "friends"} liked this post
              </span>
            </div>
          )}
        </div>
      </div>
      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this post?"
        description="This permanently deletes the post and all replies in its thread. This action cannot be undone."
        confirmLabel="Delete post"
        destructive
        error={feed.error}
        onConfirm={() => feed.deletePost(post)}
      />
    </article>
  );
}
