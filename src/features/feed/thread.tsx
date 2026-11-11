import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type Post, type Session } from "@/lib/api";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { Feed } from "./feed";
import { PostCard } from "./post-card";
import { useFeed } from "./use-feed";
import { getActionRevision, rememberPosts } from "./optimistic-actions";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  ComposerSkeleton,
  PostListSkeleton,
} from "@/components/loading-skeletons";

export function Thread({
  id,
  session,
}: {
  id: string;
  session: Session | null;
}) {
  const [loadedPost, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const viewerId =
    session?.authenticated && !session.needsOnboarding ? session.user.id : null;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const startedAt = getActionRevision();
      try {
        const result = await api.post(id, signal);
        if (!signal?.aborted) {
          rememberPosts([result.post], viewerId, startedAt);
          setPost(result.post);
          setError("");
        }
      } catch (error) {
        if (!signal?.aborted) setError(errorMessage(error));
      }
    },
    [id, viewerId],
  );
  const onPublished = useCallback(() => {
    void load();
  }, [load]);
  const feed = useFeed(session, id, true, onPublished);
  useEffect(() => {
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load, session]);
  const post = loadedPost ? feed.resolvePost(loadedPost) : null;
  usePageTitle(
    post
      ? `${post.parentId ? "Reply" : "Post"} by @${post.author.handle}`
      : "Post",
  );
  const wasDeleted = loadedPost !== null && post === null;
  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-3 flex items-center gap-3">
        <IconLink to="/" label="Back to feed">
          <ArrowLeft />
        </IconLink>
        <h1 className="text-lg font-semibold">Post</h1>
      </header>
      {wasDeleted ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Post deleted.
        </p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <IconButton label="Retry post" onClick={() => void load()}>
            <RotateCcw />
          </IconButton>
        </div>
      ) : post ? (
        <PostCard post={post} feed={feed} />
      ) : (
        <>
          <PostListSkeleton count={1} label="Loading post…" />
          <h2 className="mb-4 text-base font-semibold">Replies</h2>
          <ComposerSkeleton />
          <div className="mt-6">
            <PostListSkeleton label="Loading replies…" />
          </div>
        </>
      )}
      {post && !error && (
        <>
          <h2 className="mb-4 text-base font-semibold">Replies</h2>
          <Feed feed={feed} />
        </>
      )}
    </div>
  );
}
