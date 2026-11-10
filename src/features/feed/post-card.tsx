import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { formatDistance } from "date-fns";
import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/icon-button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Textarea } from "@/components/ui/textarea";
import { PostActions } from "./post-actions";
import type { Post } from "@/lib/api";
import type { FeedState } from "./use-feed";

export function PostCard({ post, feed }: { post: Post; feed: FeedState }) {
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
  const optimistic = feed.optimisticPostIds.includes(post.id);
  const mine = post.author.id === feed.viewerId;
  const busy = feed.pending.includes(post.id);
  const length = Array.from(content.trim()).length;
  const changed = content.trim() !== post.content.trim();
  const profilePath = `/u/${post.author.handle}`;
  function closeEditor() {
    setContent(post.content);
    setEditing(false);
  }
  function save() {
    if (busy || !changed || !length || length > 2000) return;
    if (feed.editPost(post, content)) setEditing(false);
  }
  return (
    <article id={`post-${post.id}`} className="py-5">
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
                {post.author.displayName}
              </Link>
              <Link
                to={profilePath}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                @{post.author.handle}
              </Link>
              <Link
                to={`/posts/${post.id}`}
                className="text-xs text-muted-foreground hover:underline"
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
                <span
                  className="text-xs text-muted-foreground"
                  title={new Date(post.editedAt).toLocaleString()}
                >
                  edited
                </span>
              )}
            </div>
            {mine && (
              <div className="-mt-1 flex shrink-0 gap-0.5">
                {editing ? (
                  <>
                    <IconButton
                      label="Save changes"
                      size="icon-sm"
                      disabled={busy || !changed || !length || length > 2000}
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
                        onClick={() => {
                          setContent(post.content);
                          setEditing(true);
                        }}
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
          {editing ? (
            <div className="mt-2 space-y-2">
              <label htmlFor={editorId} className="sr-only">
                Edit post
              </label>
              <Textarea
                id={editorId}
                aria-describedby={editorHelpId}
                aria-invalid={!length || length > 2000}
                autoFocus
                rows={3}
                className="max-h-96 resize-y text-sm leading-relaxed"
                value={content}
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
                  {!length
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
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {post.content}
            </p>
          )}
          <PostActions post={post} feed={feed} />
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
