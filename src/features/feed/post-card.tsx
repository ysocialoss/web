import { useEffect, useState } from "react";
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
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const optimistic = feed.optimisticPostIds.includes(post.id);
  const mine = post.author.id === feed.viewerId;
  const busy = feed.pending.includes(post.id);
  const length = Array.from(content.trim()).length;
  const profilePath = `/u/${post.author.handle}`;
  function closeEditor() {
    if (content !== post.content) setConfirmDiscard(true);
    else setEditing(false);
  }
  function save() {
    if (busy || !length || length > 2000) return;
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
                {now < Date.parse(post.editExpiresAt) && !editing && (
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
              </div>
            )}
          </div>
          {editing ? (
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <Textarea
                autoFocus
                aria-label="Edit post"
                aria-invalid={length > 2000}
                value={content}
                disabled={busy}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    if (!busy) closeEditor();
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
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs ${length > 2000 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {length}/2000
                </span>
                <div className="flex gap-1">
                  <IconButton
                    type="button"
                    label="Cancel editing"
                    disabled={busy}
                    onClick={closeEditor}
                  >
                    <X />
                  </IconButton>
                  <IconButton
                    type="submit"
                    label="Save changes"
                    variant="default"
                    disabled={busy || !length || length > 2000}
                  >
                    <Check />
                  </IconButton>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Edits are available for 15 minutes. Ctrl+Enter to save.
              </p>
            </form>
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
      <ConfirmationDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description="Your edits haven't been saved. Discarding them keeps the published post as it is."
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          setEditing(false);
          return true;
        }}
      />
    </article>
  );
}
