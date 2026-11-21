import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  api,
  errorMessage,
  type GifSearchItem,
  type PollDraft,
  type VoiceDraft,
  type Post,
  type RepostAudience,
  type RepostContext,
  type Session,
} from "@/lib/api";
import {
  acknowledgePosts,
  getLocalPosts,
  publishOptimistically,
  subscribeToLocalPosts,
} from "./post-outbox";
import { hasTooManyBlankLines } from "./post-content";
import {
  cachedReposts,
  getActionRevision,
  mutatePost,
  isVoting,
  projectPost,
  rememberPosts,
  subscribeToActions,
} from "./optimistic-actions";
import { projectRepostContext } from "./repost-context";
import { applyLive } from "./live-insert";
import { useLiveUpdates } from "./use-live-updates";

// Feed pages (home, or one topic's) survive navigation, so coming back from a post shows the same
// list instantly (and can restore the scroll position) while it revalidates.
const feedCache = new Map<
  string,
  {
    posts: Post[];
    repostedBy: Record<string, RepostContext>;
    nextCursor: string | null;
  }
>();

export function useFeed(
  session: Session | null,
  parentId?: string,
  autoLoad = true,
  onPublished?: () => void,
  /** Only posts and replies with this normalized topic. */
  topic?: string,
  search?: string,
) {
  const viewerId =
    session?.authenticated && !session.needsOnboarding ? session.user.id : null;
  const cacheKey =
    parentId === undefined
      ? `${viewerId ?? "anonymous"}${topic ? `|topic:${topic}` : ""}${search ? `|search:${search}` : ""}`
      : null;
  const [cached] = useState(() =>
    cacheKey === null ? undefined : feedCache.get(cacheKey),
  );
  const [feedPosts, setFeedPosts] = useState<Post[]>(cached?.posts ?? []);
  // Which posts are here because someone reposted them (home feed only).
  const [repostedBy, setRepostedBy] = useState<Record<string, RepostContext>>(
    cached?.repostedBy ?? {},
  );
  const [draft, setDraft] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(
    cached?.nextCursor ?? null,
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const pendingPage = useRef<Awaited<ReturnType<typeof api.posts>> | null>(
    null,
  );
  useSyncExternalStore(subscribeToActions, getActionRevision);
  const localPosts = useSyncExternalStore(subscribeToLocalPosts, getLocalPosts);
  const visibleLocalPosts = localPosts.filter(
    (entry) =>
      !search &&
      entry.post.author.id === viewerId &&
      (topic
        ? entry.post.topics.includes(topic)
        : entry.post.parentId === (parentId ?? null)),
  );
  const localIds = new Set(visibleLocalPosts.map((entry) => entry.post.id));
  const optimisticPostIds = visibleLocalPosts
    .filter((entry) => entry.status === "sending")
    .map((entry) => entry.post.id);
  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  useEffect(() => {
    if (!enteringIds.size) return;
    const timer = window.setTimeout(() => setEnteringIds(new Set()), 700);
    return () => window.clearTimeout(timer);
  }, [enteringIds]);
  const onboarded = !!session?.authenticated && !session.needsOnboarding;
  const readOnly = onboarded && (session.pendingApproval || !!session.ban);
  const canPost = onboarded && !readOnly;
  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal, revalidate = false) => {
      const startedAt = getActionRevision();
      try {
        const page = parentId
          ? await api.replies(parentId, cursor, signal)
          : await api.posts(cursor, signal, topic, search);
        if (signal?.aborted) return;
        rememberPosts(page.posts, viewerId, startedAt);
        // The page is authoritative for the posts it holds, including their order:
        // a repost can lift an older post back to the top.
        const pageIds = new Set(page.posts.map((post) => post.id));
        setRepostedBy((current) =>
          revalidate || cursor
            ? {
                ...Object.fromEntries(
                  Object.entries(current).filter(([id]) => !pageIds.has(id)),
                ),
                ...page.repostedBy,
              }
            : page.repostedBy,
        );
        setFeedPosts((current) =>
          revalidate
            ? [
                ...page.posts,
                ...current.filter((existing) => !pageIds.has(existing.id)),
              ]
            : cursor
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
        if (!revalidate) setNextCursor(page.nextCursor);
        setError("");
      } catch (error) {
        if (!signal?.aborted) setError(errorMessage(error));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [parentId, viewerId, topic, search],
  );
  useEffect(() => {
    if (cacheKey === null) return;
    feedCache.set(cacheKey, { posts: feedPosts, repostedBy, nextCursor });
  }, [cacheKey, feedPosts, repostedBy, nextCursor]);
  useEffect(() => {
    if (!autoLoad) return;
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(undefined, controller.signal, !!cached);
    return () => controller.abort();
  }, [load, session, autoLoad, cached]);
  useLiveUpdates({
    enabled: autoLoad && parentId === undefined && !search,
    scope: `${viewerId ?? "anonymous"}|${topic ?? ""}`,
    relevant: (live) =>
      ((topic
        ? live.topics.includes(topic)
        : live.parentId === null || live.reposted) &&
      !localIds.has(live.id) &&
      !feedPosts.some((post) => post.id === live.id)) ||
      // The author's first reply lands under a post that is already listed.
      (live.parentId !== null &&
        feedPosts.some(
          (post) => post.id === live.parentId && !post.selfReply,
        )),
    refresh: async (signal) => {
      const startedAt = getActionRevision();
      const page = await api.posts(undefined, signal, topic);
      if (signal.aborted) return;
      const known = new Set([...localIds, ...feedPosts.map((post) => post.id)]);
      // A deletion can backfill the end of the first page with older posts.
      // Live insertion only adds the entries ahead of the existing feed.
      const firstKnown = page.posts.findIndex((post) => known.has(post.id));
      const fresh =
        firstKnown === -1 ? page.posts : page.posts.slice(0, firstKnown);
      const withReply = new Map(
        page.posts.flatMap((post) =>
          post.selfReply && !localIds.has(post.id)
            ? [[post.id, post.selfReply] as const]
            : [],
        ),
      );
      const gained = feedPosts.filter(
        (post) => !post.selfReply && withReply.has(post.id),
      );
      if (!fresh.length && !gained.length) return;
      const contiguous =
        known.size === 0 || !page.nextCursor || firstKnown !== -1;
      rememberPosts(page.posts, viewerId, startedAt);
      await applyLive(
        signal,
        (atTop) => {
          if (gained.length)
            setFeedPosts((current) =>
              current.map((post) =>
                !post.selfReply && withReply.has(post.id)
                  ? { ...post, selfReply: withReply.get(post.id) }
                  : post,
              ),
            );
          if (!fresh.length) return;
          if (contiguous) {
            const freshIds = new Set(fresh.map((post) => post.id));
            setFeedPosts((current) => [
              ...fresh.filter(
                (post) => !current.some((existing) => existing.id === post.id),
              ),
              ...current,
            ]);
            setRepostedBy((current) => ({
              ...current,
              ...Object.fromEntries(
                Object.entries(page.repostedBy).filter(([id]) =>
                  freshIds.has(id),
                ),
              ),
            }));
            if (atTop)
              setEnteringIds((current) => new Set([...current, ...freshIds]));
            else setUnread((current) => current + fresh.length);
          } else if (atTop) {
            setFeedPosts(page.posts);
            setRepostedBy(page.repostedBy);
            setNextCursor(page.nextCursor);
          } else {
            pendingPage.current = page;
            setUnread((current) => Math.max(current, fresh.length));
          }
          acknowledgePosts(page.posts);
        },
        { followTop: true },
      );
    },
  });
  function revealNew() {
    const page = pendingPage.current;
    pendingPage.current = null;
    if (page) {
      setFeedPosts(page.posts);
      setRepostedBy(page.repostedBy);
      setNextCursor(page.nextCursor);
    }
    setUnread(0);
  }
  function publishPost(
    text: string = draft,
    gif: GifSearchItem | null = null,
    poll?: PollDraft,
    voice?: VoiceDraft,
    imageIds: string[] = [],
  ) {
    const content = text.trim();
    if (
      !session?.authenticated ||
      session.needsOnboarding ||
      session.pendingApproval ||
      session.ban ||
      (!content && !gif && !poll && !voice && !imageIds.length) ||
      Array.from(content).length > 2000 ||
      hasTooManyBlankLines(content)
    )
      return;
    const sending = publishOptimistically({
      content,
      gif,
      poll,
      voice,
      imageIds,
      author: session.user,
      parentId: parentId ?? null,
      onConfirmed: onPublished,
    });
    setDraft("");
    return sending;
  }
  /** Quote a post: a new top-level post embedding it, whatever feed this is. */
  function publishQuote(
    quoted: Post,
    text: string,
    gif: GifSearchItem | null = null,
    poll?: PollDraft,
    onConfirmed?: (post: Post) => void,
    voice?: VoiceDraft,
    imageIds: string[] = [],
  ) {
    const content = text.trim();
    if (
      !session?.authenticated ||
      session.needsOnboarding ||
      session.pendingApproval ||
      session.ban ||
      (!content && !gif && !poll && !voice && !imageIds.length) ||
      Array.from(content).length > 2000 ||
      hasTooManyBlankLines(content)
    )
      return;
    return publishOptimistically({
      content,
      gif,
      poll,
      voice,
      imageIds,
      author: session.user,
      parentId: null,
      quoting: quoted,
      onConfirmed,
    });
  }
  return {
    feedPosts: [
      ...visibleLocalPosts.map((entry) => entry.post),
      ...feedPosts.filter((post) => !localIds.has(post.id)),
    ]
      .map((post) => projectPost(post, viewerId))
      .filter((post) => post !== null)
      .filter((post) => !topic || post.topics.includes(topic)),
    resolvePost: (post: Post) => projectPost(post, viewerId),
    /**
     * The "X reposted" label for a post in this list. Pass `base` and turn
     * `synthesize` off for lists that bring their own context, such as a profile.
     */
    repostContext: (
      post: Post,
      base: RepostContext | undefined = repostedBy[post.id],
      // Only the home feed lists reposts; topic and reply lists never do.
      synthesize = !topic && !search && parentId === undefined,
    ) =>
      projectRepostContext(
        post,
        base,
        session?.authenticated && !session.needsOnboarding
          ? session.user
          : null,
        synthesize,
      ),
    publishQuote,
    viewerReposts: viewerId ? cachedReposts(viewerId) : [],
    optimisticPostIds,
    enteringIds,
    draft,
    setDraft,
    publishPost,
    loading,
    sessionLoading: session === null,
    authenticated: !!session?.authenticated,
    error,
    canPost,
    readOnly,
    pending: optimisticPostIds,
    unread,
    revealNew,
    refresh: () => {
      pendingPage.current = null;
      setUnread(0);
      return load();
    },
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
      canPost && viewerId
        ? mutatePost(post, viewerId, { kind: "like", value: !post.liked })
        : false,
    /** Repost with an audience, or undo the repost with `null`. */
    setRepost: (post: Post, audience: RepostAudience | null) =>
      canPost && viewerId
        ? mutatePost(post, viewerId, {
            kind: "repost",
            value: audience !== null,
            audience: audience ?? "public",
          })
        : false,
    isVoting: (post: Post) => !!viewerId && isVoting(post.id, viewerId),
    vote: (post: Post, optionIndex: number) =>
      canPost && viewerId
        ? mutatePost(post, viewerId, { kind: "vote", optionIndex })
        : false,
    editPost: (post: Post, content: string) => {
      const trimmed = content.trim();
      return canPost && viewerId &&
        (trimmed || post.gif || post.poll || post.voice || post.imageIds.length) &&
        Array.from(trimmed).length <= 2000 &&
        !hasTooManyBlankLines(trimmed)
        ? mutatePost(post, viewerId, {
            kind: "edit",
            content: trimmed,
            editedAt: new Date().toISOString(),
          })
        : false;
    },
    deletePost: (post: Post) =>
      canPost && viewerId ? mutatePost(post, viewerId, { kind: "delete" }) : false,
    viewerId,
  };
}
export type FeedState = ReturnType<typeof useFeed>;
