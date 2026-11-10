import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api, errorMessage, type Post, type Session } from "@/lib/api";
import {
  acknowledgePosts,
  getLocalPosts,
  publishOptimistically,
  subscribeToLocalPosts,
} from "./post-outbox";
import {
  cachedReposts,
  getActionRevision,
  mutatePost,
  projectPost,
  rememberPosts,
  subscribeToActions,
} from "./optimistic-actions";
import { toast } from "@/components/ui/toast";

export function useFeed(
  session: Session | null,
  parentId?: string,
  autoLoad = true,
  onPublished?: () => void,
) {
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useSyncExternalStore(subscribeToActions, getActionRevision);
  const localPosts = useSyncExternalStore(subscribeToLocalPosts, getLocalPosts);
  const viewerId =
    session?.authenticated && !session.needsOnboarding ? session.user.id : null;
  const visibleLocalPosts = localPosts.filter(
    (entry) =>
      entry.post.author.id === viewerId &&
      entry.post.parentId === (parentId ?? null),
  );
  const localIds = new Set(visibleLocalPosts.map((entry) => entry.post.id));
  const optimisticPostIds = visibleLocalPosts
    .filter((entry) => entry.status === "sending")
    .map((entry) => entry.post.id);
  const canPost = !!session?.authenticated && !session.needsOnboarding;
  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
      const startedAt = getActionRevision();
      try {
        const page = parentId
          ? await api.replies(parentId, cursor, signal)
          : await api.posts(cursor, signal);
        if (signal?.aborted) return;
        rememberPosts(page.posts, viewerId, startedAt);
        setFeedPosts((current) =>
          cursor
            ? [
                ...current,
                ...page.posts.filter(
                  (post) =>
                    !current.some((existing) => existing.id === post.id),
                ),
              ]
            : page.posts,
        );
        acknowledgePosts(page.posts);
        setNextCursor(page.nextCursor);
        setError("");
      } catch (error) {
        if (!signal?.aborted) setError(errorMessage(error));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [parentId, viewerId],
  );
  useEffect(() => {
    if (!autoLoad) return;
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load, session, autoLoad]);
  function publishPost() {
    const content = draft.trim();
    if (
      !session?.authenticated ||
      session.needsOnboarding ||
      !content ||
      Array.from(content).length > 2000
    )
      return;
    const sending = publishOptimistically({
      content,
      author: session.user,
      parentId: parentId ?? null,
      onConfirmed: onPublished,
    });
    setDraft("");
    return sending;
  }
  async function sharePost(post: Post) {
    const url = new URL(`/posts/${post.id}`, window.location.origin).href;
    try {
      if (navigator.share)
        await navigator.share({
          title: `Post by ${post.author.displayName}`,
          text: post.content,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        const id = toast.add({
          type: "error",
          title: "Couldn't share post",
          description: errorMessage(error),
          timeout: 0,
          actionProps: {
            children: "Retry",
            onClick: () => {
              toast.close(id);
              void sharePost(post);
            },
          },
        });
      }
    }
  }
  return {
    feedPosts: [
      ...visibleLocalPosts.map((entry) => entry.post),
      ...feedPosts.filter((post) => !localIds.has(post.id)),
    ]
      .map((post) => projectPost(post, viewerId))
      .filter((post) => post !== null),
    resolvePost: (post: Post) => projectPost(post, viewerId),
    viewerReposts: viewerId ? cachedReposts(viewerId) : [],
    optimisticPostIds,
    draft,
    setDraft,
    publishPost,
    loading,
    sessionLoading: session === null,
    authenticated: !!session?.authenticated,
    error,
    canPost,
    pending: optimisticPostIds,
    sharePost,
    loadMore: nextCursor
      ? () => {
          setLoading(true);
          return load(nextCursor);
        }
      : null,
    retry: () => {
      setLoading(true);
      return load();
    },
    toggleLike: (post: Post) =>
      viewerId
        ? mutatePost(post, viewerId, { kind: "like", value: !post.liked })
        : false,
    toggleRepost: (post: Post) =>
      viewerId
        ? mutatePost(post, viewerId, { kind: "repost", value: !post.reposted })
        : false,
    editPost: (post: Post, content: string) => {
      const trimmed = content.trim();
      return viewerId && trimmed && Array.from(trimmed).length <= 2000
        ? mutatePost(post, viewerId, {
            kind: "edit",
            content: trimmed,
            editedAt: new Date().toISOString(),
          })
        : false;
    },
    deletePost: (post: Post) =>
      viewerId ? mutatePost(post, viewerId, { kind: "delete" }) : false,
    viewerId,
  };
}
export type FeedState = ReturnType<typeof useFeed>;
