import {
  api,
  ApiError,
  errorMessage,
  retryRequest,
  type Post,
} from "@/lib/api";
import { beginReply, rememberPosts } from "./optimistic-actions";
import { toast } from "@/components/ui/toast";

type LocalPost = { status: "sending" | "confirmed"; post: Post };
let snapshot: LocalPost[] = [];
const listeners = new Set<() => void>();
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
export function acknowledgePosts(posts: Post[]) {
  const ids = new Set(posts.map((post) => post.id));
  const remaining = snapshot.filter(
    (entry) => entry.status === "sending" || !ids.has(entry.post.id),
  );
  if (remaining.length !== snapshot.length) update(remaining);
}

export function publishOptimistically({
  content,
  author,
  parentId,
  onConfirmed,
}: {
  content: string;
  author: Post["author"];
  parentId: string | null;
  onConfirmed?: () => void;
}) {
  const now = new Date();
  const optimistic: Post = {
    id: crypto.randomUUID(),
    content,
    author,
    parentId,
    createdAt: now.toISOString(),
    editedAt: null,
    editExpiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    likes: 0,
    liked: false,
    reposts: 0,
    reposted: false,
    replies: 0,
  };
  let failedToastId: string | undefined;
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
        const session = await api.session();
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
            ? api.reply(parentId, content, optimistic.id)
            : api.publish(content, optimistic.id),
        {
          context: parentId ? "publish reply" : "publish post",
          beforeRetry: verifyAccount,
        },
      );
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
      finishReply?.(false);
      update(snapshot.filter((entry) => entry.post.id !== optimistic.id));
      failedToastId = toast.add({
        type: "error",
        title: parentId ? "Reply wasn't sent" : "Post wasn't sent",
        description: errorMessage(error),
        timeout: 0,
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
    onConfirmed?.();
    return true;
  }
  return send();
}
