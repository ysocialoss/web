import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigationType } from "react-router";
import { cn } from "@/lib/utils";
import { api, errorMessage, type Post, type Session } from "@/lib/api";
import {
  ArrowLeft,
  ChevronRight,
  ChevronsUpDown,
  Ellipsis,
  RotateCcw,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { DisplayName } from "@/components/display-name";
import { PostCard } from "./post-card";
import { NewPostDialog } from "./feed-floaters";
import { PostComposer } from "./post-composer";
import { PostActivity } from "./post-activity";
import { useFeed, type FeedState } from "./use-feed";
import { getActionRevision, isPostHidden, rememberPosts } from "./optimistic-actions";
import { acknowledgePosts } from "./post-outbox";
import { applyLive } from "./live-insert";
import { useLiveUpdates } from "./use-live-updates";
import { usePageTitle } from "@/hooks/use-page-title";
import { useGoBack } from "@/hooks/use-go-back";
import {
  ComposerSkeleton,
  PostListSkeleton,
} from "@/components/loading-skeletons";
import { countFormat } from "@/lib/count-format";

type ThreadData = Awaited<ReturnType<typeof api.thread>>;
type ReplyNodeData = { post: Post; children: ReplyNodeData[] };

// Past this depth replies stop indenting (it would squeeze the text on phones)
// and offer a "continue thread" link instead, like Reddit does.
const MAX_DEPTH = 4;

const threadCache = new Map<string, ThreadData>();

function buildTree(
  rootId: string,
  posts: Post[],
  resolve: (post: Post) => Post | null,
): ReplyNodeData[] {
  const byParent = new Map<string, Post[]>();
  for (const post of posts) {
    const resolved = resolve(post);
    if (!resolved?.parentId) continue;
    const siblings = byParent.get(resolved.parentId) ?? [];
    siblings.push(resolved);
    byParent.set(resolved.parentId, siblings);
  }
  // Starting at the root drops anything below a deleted post.
  const build = (id: string, depth: number): ReplyNodeData[] =>
    (byParent.get(id) ?? [])
      .toSorted((a, b) =>
        // Newest first directly under the post (where you just replied),
        // oldest first deeper so a conversation reads top to bottom.
        depth === 0
          ? b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
          : a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )
      .map((post) => ({ post, children: build(post.id, depth + 1) }));
  return build(rootId, 0);
}
function countDescendants(node: ReplyNodeData): number {
  return node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0,
  );
}

export function Thread({
  id,
  session,
}: {
  id: string;
  session: Session | null;
}) {
  const viewerId =
    session?.authenticated && !session.needsOnboarding ? session.user.id : null;
  const cacheKey = `${viewerId ?? "anonymous"}:${id}`;
  const [data, setData] = useState<ThreadData | null>(
    () => threadCache.get(cacheKey) ?? null,
  );
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [showAllAncestors, setShowAllAncestors] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const focusedRef = useRef<HTMLDivElement>(null);
  const anchored = useRef(false);
  const navigationType = useNavigationType();
  const parentPath = data?.post.parentId ? `/posts/${data.post.parentId}` : "/";
  const goBack = useGoBack(parentPath);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const startedAt = getActionRevision();
      try {
        const result = await api.thread(id, signal);
        if (signal?.aborted) return;
        rememberPosts(
          [result.post, ...result.ancestors, ...result.replies],
          viewerId,
          startedAt,
        );
        threadCache.set(cacheKey, result);
        setData(result);
        acknowledgePosts(result.replies);
        setError("");
      } catch (error) {
        if (!signal?.aborted) setError(errorMessage(error));
      }
    },
    [id, viewerId, cacheKey],
  );
  const onPublished = useCallback(() => {
    void load();
  }, [load]);
  // Replies are loaded together with the thread; the feed state only provides
  // the composer, optimistic replies and the like/repost/edit/delete actions.
  const feed = useFeed(session, id, false, onPublished);
  useEffect(() => {
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load, session]);
  const liveReplyIds = useRef(new Set<string>());
  useLiveUpdates({
    enabled: data !== null,
    scope: cacheKey,
    relevant: (live) => {
      if (!data || live.parentId === null) return false;
      if (
        data.replies.some((reply) => reply.id === live.id) ||
        feed.feedPosts.some(
          (reply) =>
            reply.id === live.id && !feed.optimisticPostIds.includes(reply.id),
        )
      )
        return false;
      const inThread =
        live.parentId === id ||
        liveReplyIds.current.has(live.parentId) ||
        data.replies.some((reply) => reply.id === live.parentId);
      if (inThread) liveReplyIds.current.add(live.id);
      return inThread;
    },
    refresh: async (signal) => {
      const startedAt = getActionRevision();
      const result = await api.thread(id, signal);
      if (signal.aborted) return;
      const known = new Set(data?.replies.map((reply) => reply.id));
      if (result.replies.every((reply) => known.has(reply.id))) return;
      rememberPosts(
        [result.post, ...result.ancestors, ...result.replies],
        viewerId,
        startedAt,
      );
      await applyLive(signal, () => {
        threadCache.set(cacheKey, result);
        setData(result);
        acknowledgePosts(result.replies);
      });
    },
  });
  const post = data ? feed.resolvePost(data.post) : null;
  const ancestors = useMemo(
    () =>
      (data?.ancestors ?? []).flatMap((ancestor) => {
        const resolved = feed.resolvePost(ancestor);
        return resolved ? [resolved] : [];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, feed.resolvePost],
  );
  const tree = useMemo(() => {
    if (!data) return [];
    const known = new Set(data.replies.map((reply) => reply.id));
    // Replies you just wrote that the server hasn't returned yet.
    const optimistic = feed.feedPosts.filter(
      (reply) => reply.parentId === id && !known.has(reply.id),
    );
    return buildTree(id, [...optimistic, ...data.replies], feed.resolvePost);
  }, [data, id, feed.feedPosts, feed.resolvePost]);
  usePageTitle(
    post
      ? `${post.parentId ? "Reply" : "Post"} by @${post.author.handle}`
      : "Post",
  );
  // When a long chain sits above the post, start at the post itself.
  useEffect(() => {
    if (!data || anchored.current) return;
    anchored.current = true;
    if (navigationType === "POP" || data.ancestors.length === 0) return;
    const target = focusedRef.current;
    const scroller = target?.closest<HTMLElement>(".content-scroll");
    if (!target || !scroller) return;
    const offset =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset > scroller.clientHeight * 0.4)
      scroller.scrollTo({
        top: scroller.scrollTop + offset - 16,
        behavior: "instant",
      });
  }, [data, navigationType]);
  const reveal = useCallback((postId: string) => {
    setRevealed((current) => new Set(current).add(postId));
  }, []);
  const toggle = useCallback((postId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(postId)) next.add(postId);
      return next;
    });
  }, []);
  const totalReplies = tree.reduce(
    (sum, node) => sum + 1 + countDescendants(node),
    0,
  );
  const wasDeleted = data !== null && post === null;
  const collapseAncestors = !showAllAncestors && ancestors.length > 4;
  const ancestorItems: ({ ancestor: Post } | { gap: number })[] =
    collapseAncestors
      ? [
          { ancestor: ancestors[0] },
          { gap: ancestors.length - 3 },
          ...ancestors.slice(-2).map((ancestor) => ({ ancestor })),
        ]
      : ancestors.map((ancestor) => ({ ancestor }));
  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-3 flex items-center gap-3">
        <IconLink to={parentPath} label="Back" onClick={goBack}>
          <ArrowLeft />
        </IconLink>
        <h1 className="text-lg font-semibold">
          {data?.ancestors.length ? "Thread" : "Post"}
        </h1>
        {post && !error && (
          <PostActivity
            key={post.id}
            postId={post.id}
            poll={post.poll}
          />
        )}
      </header>
      {wasDeleted ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          {isPostHidden(id, viewerId) ? "Post unavailable." : "Post deleted."}
        </p>
      ) : error && !data ? (
        <div role="alert">
          <p>{error}</p>
          <IconButton label="Retry post" onClick={() => void load()}>
            <RotateCcw />
          </IconButton>
        </div>
      ) : post ? (
        <>
          {ancestorItems.map((item) =>
            "gap" in item ? (
              <ShowEarlier
                key="gap"
                count={item.gap}
                onClick={() => setShowAllAncestors(true)}
              />
            ) : (
              <PostCard
                key={item.ancestor.id}
                post={item.ancestor}
                feed={feed}
                compact
                connectToNext="tight"
                connectFromPrev={ancestorItems[0] !== item}
              />
            ),
          )}
          <div ref={focusedRef} className="scroll-mt-4">
            <PostCard
              post={post}
              feed={feed}
              focused
              connectFromPrev={ancestorItems.length > 0}
            />
          </div>
          <h2 className="mb-1 text-base font-semibold">
            Replies
            {totalReplies > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
                {new Intl.NumberFormat(undefined, countFormat).format(
                  totalReplies,
                )}
                {data?.truncated ? "+" : ""}
              </span>
            )}
          </h2>
          {tree.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {feed.readOnly ? "No replies yet." : "No replies yet. Start the conversation."}
            </p>
          ) : (
            <div>
              {tree.map((node) => (
                <ReplyNode
                  key={node.post.id}
                  node={node}
                  depth={0}
                  feed={feed}
                  collapsed={collapsed}
                  onToggle={toggle}
                  revealed={revealed}
                  onReveal={reveal}
                />
              ))}
            </div>
          )}
          {data?.truncated && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              This conversation is long. Open a reply to see more of it.
            </p>
          )}
          {!feed.readOnly && (
            <NewPostDialog
              feed={feed}
              kind="reply"
              show={!feed.sessionLoading}
              anchor={focusedRef}
            />
          )}
          {!feed.readOnly && <div className="sticky bottom-0 z-20 mt-4 hidden bg-linear-to-t from-background from-70% to-transparent pt-4 pb-1 md:block">
            <PostComposer
              feed={feed}
              placeholder="Write a reply…"
              dropUp
            />
          </div>}
        </>
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
    </div>
  );
}

function ShowEarlier({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <div className="relative py-2 pl-12">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-4.25 w-0.5 rounded-full bg-border"
      />
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Ellipsis className="size-3.5" aria-hidden="true" />
        Show {count} earlier {count === 1 ? "post" : "posts"}
      </button>
    </div>
  );
}

/** The collapsed bar below the first reply that opens the rest of the branch. */
function MoreReplies({
  count,
  highlighted,
  onClick,
}: {
  count: number;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative py-1">
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -left-[17px] top-0 h-[21px] w-[17px] rounded-bl-xl border-b-2 border-l-2 transition-colors",
          highlighted ? "border-foreground/50" : "border-border",
        )}
      />
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ChevronsUpDown className="size-3.5" aria-hidden="true" />
        Show {count} more {count === 1 ? "reply" : "replies"}
      </button>
    </div>
  );
}

function ReplyNode({
  node,
  depth,
  feed,
  collapsed,
  onToggle,
  revealed,
  onReveal,
  parentHover = false,
  last = true,
}: {
  node: ReplyNodeData;
  depth: number;
  feed: FeedState;
  collapsed: ReadonlySet<string>;
  onToggle: (postId: string) => void;
  /** Parents whose remaining replies were expanded with "Show more". */
  revealed: ReadonlySet<string>;
  onReveal: (postId: string) => void;
  /** The parent's thread line is hovered, so draw our connector highlighted. */
  parentHover?: boolean;
  last?: boolean;
}) {
  const { post, children } = node;
  const [hover, setHover] = useState(false);
  const isCollapsed = collapsed.has(post.id);
  const hasChildren = children.length > 0;
  const hidden = countDescendants(node);
  const nested = depth > 0;
  const lineColor = (on: boolean) =>
    on ? "bg-foreground/50" : "bg-border";
  return (
    <div className="relative animate-in fade-in-0 slide-in-from-top-1 duration-300">
      {nested && (
        <>
          {/* Rounded elbow from the parent's line into this reply's avatar. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -left-[17px] top-0 w-[17px] rounded-bl-xl border-b-2 border-l-2 transition-colors",
              isCollapsed ? "h-[23px]" : "h-[31px]",
              parentHover ? "border-foreground/50" : "border-border",
            )}
          />
          {!last && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -left-[17px] bottom-0 w-0.5 transition-colors",
                isCollapsed ? "top-[22px]" : "top-[30px]",
                lineColor(parentHover),
              )}
            />
          )}
        </>
      )}
      {isCollapsed ? (
        <button
          type="button"
          aria-label={`Expand thread by @${post.author.handle}, ${hidden} ${hidden === 1 ? "reply" : "replies"} hidden`}
          onClick={() => onToggle(post.id)}
          className="my-1 flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronsUpDown className="size-4 shrink-0" aria-hidden="true" />
          <Avatar className="size-5 shrink-0">
            {post.author.avatarUrl && (
              <AvatarImage
                src={post.author.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="text-[0.6rem]">
              {post.author.displayName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <DisplayName
            user={post.author}
            className="shrink-0 font-medium text-foreground"
          />
          <span className="shrink-0">
            {hidden} {hidden === 1 ? "reply" : "replies"} hidden
          </span>
          <span className="min-w-0 truncate">· {post.content}</span>
        </button>
      ) : (
        <>
          <PostCard
            post={post}
            feed={feed}
            compact
            connectToNext={hasChildren && depth < MAX_DEPTH ? "tight" : false}
            lineClassName={lineColor(hover)}
          />
          {hasChildren && depth < MAX_DEPTH && (
            // One click target for the whole thread line, centred on the
            // avatar: from under it down to the last nested reply.
            <button
              type="button"
              aria-label={`Collapse thread by @${post.author.handle}`}
              aria-expanded="true"
              title="Collapse thread"
              onClick={() => onToggle(post.id)}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onFocus={() => setHover(true)}
              onBlur={() => setHover(false)}
              className="absolute top-12 bottom-1 left-2.5 z-10 w-4 cursor-pointer outline-none"
            />
          )}
        </>
      )}
      {hasChildren &&
        !isCollapsed &&
        (depth >= MAX_DEPTH ? (
          <Link
            to={`/posts/${post.id}`}
            className="mb-2 ml-12 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Continue thread ({hidden} {hidden === 1 ? "reply" : "replies"})
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <div className="ml-8.5">
            {(revealed.has(post.id) || depth === 0
              ? children
              : children.slice(0, 1)
            ).map(
              (child, index, shown) => (
                <ReplyNode
                  key={child.post.id}
                  node={child}
                  depth={depth + 1}
                  feed={feed}
                  collapsed={collapsed}
                  onToggle={onToggle}
                  revealed={revealed}
                  onReveal={onReveal}
                  parentHover={hover}
                  last={
                    index === shown.length - 1 &&
                    shown.length === children.length
                  }
                />
              ),
            )}
            {!revealed.has(post.id) && depth > 0 && children.length > 1 && (
              <MoreReplies
                count={children
                  .slice(1)
                  .reduce((sum, child) => sum + 1 + countDescendants(child), 0)}
                highlighted={hover}
                onClick={() => onReveal(post.id)}
              />
            )}
          </div>
        ))}
    </div>
  );
}
