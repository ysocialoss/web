import {
  api,
  ApiError,
  errorMessage,
  retryRequest,
  type GifSearchItem,
  type PollDraft,
  type VoiceDraft,
  type Post,
} from "@/lib/api";
import { beginReply, rememberPosts } from "./optimistic-actions";
import { toast } from "@/components/ui/toast-manager";
import { extractTopics } from "@/lib/topics";
import { quoteOf } from "./quote";

type LocalPost = { status: "sending" | "confirmed"; post: Post };
let snapshot: LocalPost[] = [];
const listeners = new Set<() => void>();
const publishedListeners = new Set<() => void>();
const inFlight = new Set<string>();

function update(next: LocalPost[]) {
  snapshot = next;
  for (const listener of listeners) listener();
}
export const getLocalPosts = () => snapshot;
export function subscribeToLocalPosts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Called after a top-level post or a tagged reply is saved. */
export function subscribeToPublished(listener: () => void) {
  publishedListeners.add(listener);
  return () => {
    publishedListeners.delete(listener);
  };
}
export function acknowledgePosts(posts: Post[]) {
  const ids = new Set(posts.map((post) => post.id));
  const remaining = snapshot.filter((entry) => !ids.has(entry.post.id));
  if (remaining.length !== snapshot.length) update(remaining);
}

export function publishOptimistically({
  content,
  gif,
  poll,
  voice,
  imageIds,
  author,
  parentId,
  quoting,
  onConfirmed,
}: {
  content: string;
  gif: GifSearchItem | null;
  poll?: PollDraft;
  voice?: VoiceDraft;
  imageIds: string[];
  author: Post["author"];
  parentId: string | null;
  /** The post being quoted. A quote is always a top-level post. */
  quoting?: Post;
  onConfirmed?: (post: Post) => void;
}) {
  const now = new Date();
  const optimistic: Post = {
    id: crypto.randomUUID(),
    saved: false,
    pinned: false,
    content,
    gif: gif ? { url: gif.url, title: gif.title } : null,
    voice: voice ?? null,
    imageIds,
    poll: poll
      ? {
          ...poll,
          options: poll.options.map((label) => ({ label, votes: 0 })),
          selectedOption: null,
        }
      : null,
    author,
    parentId,
    createdAt: now.toISOString(),
    editedAt: null,
    editExpiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    likes: 0,
    friendLikes: 0,
    friendLikers: [],
    mentions: [],
    liked: false,
    reposts: 0,
    reposted: false,
    repostAudience: null,
    quotes: 0,
    quote: quoting ? quoteOf(quoting) : null,
    replyTo: null,
    replies: 0,
    // Replies are never tagged; the API confirms the same topics for posts.
    topics: extractTopics(content),
  };
  let failedToastId: string | undefined;
  const attachments = imageIds.length ? imageIds : undefined;
  let confirmed = optimistic;
  async function send(retry = false): Promise<boolean> {
    if (inFlight.has(optimistic.id)) return false;
    inFlight.add(optimistic.id);
    const finishReply = parentId ? beginReply(parentId, author.id) : undefined;
    if (failedToastId) toast.close(failedToastId);
    update([
      { status: "sending", post: optimistic },
      ...snapshot.filter((entry) => entry.post.id !== optimistic.id),
    ]);
    try {
      async function verifyAccount() {
        const session = voice ? await api.sessionOnce() : await api.session();
        if (
          !session.authenticated ||
          session.needsOnboarding ||
          session.user.id !== author.id
        )
          throw new ApiError(403, "retry_account_changed");
      }
      if (retry) await verifyAccount();
      const { post } = await retryRequest(
        () =>
          parentId
            ? api.reply(parentId, content, optimistic.id, gif?.token, poll, voice?.token, attachments)
            : api.publish(content, optimistic.id, gif?.token, poll, quoting?.id, voice?.token, attachments),
        {
          context: parentId ? "publish reply" : "publish post",
          beforeRetry: verifyAccount,
          maxDelayMs: voice ? 3000 : undefined,
        },
      );
      confirmed = post;
      rememberPosts([post], author.id);
      finishReply?.(true);
      update(
        snapshot.map((entry) =>
          entry.post.id === optimistic.id
            ? { status: "confirmed", post }
            : entry,
        ),
      );
    } catch (error) {
      // A feed or thread response can confirm the post before the send returns.
      if (!snapshot.some((entry) => entry.post.id === optimistic.id)) {
        finishReply?.(true);
        return true;
      }
      finishReply?.(false);
      update(snapshot.filter((entry) => entry.post.id !== optimistic.id));
      failedToastId = toast.add({
        type: "error",
        title: parentId ? "Reply wasn't sent" : "Post wasn't sent",
        description: errorMessage(error),
        timeout: 8000,
        priority: "high",
        actionProps: {
          children: "Retry",
          onClick: () => {
            void send(true);
          },
        },
      });
      return false;
    } finally {
      inFlight.delete(optimistic.id);
    }
    if (!parentId || optimistic.topics.length) {
      for (const listener of publishedListeners) listener();
    }
    onConfirmed?.(confirmed);
    return true;
  }
  return send();
}
