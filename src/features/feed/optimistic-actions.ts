import {
  api,
  ApiError,
  retryRequest,
  type Post,
  type Profile,
} from "@/lib/api";
import { showRetryToast as retryToast } from "@/lib/retry-toast";

type PostCommand =
  | { kind: "like"; value: boolean }
  | { kind: "repost"; value: boolean }
  | { kind: "edit"; content: string; editedAt: string }
  | { kind: "delete" };
type PostOperation = { id: string; command: PostCommand };
type Relationship = Pick<Profile, "isFollowing" | "isFollowedBy"> &
  Pick<Profile["profile"], "followerCount" | "followingCount">;
type FollowOperation = { id: string; value: boolean };
type Entry<T> = { value: T; revision: number };

let revision = 0;
const listeners = new Set<() => void>();
const posts = new Map<string, Entry<Post>>();
const relationships = new Map<string, Entry<Relationship>>();
const postOperations = new Map<string, PostOperation[]>();
const followOperations = new Map<string, FollowOperation[]>();
const deleted = new Set<string>();
const replyOperations = new Map<string, Set<string>>();
const jobs = new Map<string, (() => Promise<void>)[]>();
const keyFor = (viewerId: string | null, id: string) =>
  `${viewerId ?? "anonymous"}:${id}`;

export const getActionRevision = () => revision;
export function subscribeToActions(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notify() {
  revision++;
  for (const listener of listeners) listener();
}
function queue(key: string, job: () => Promise<void>) {
  const existing = jobs.get(key);
  if (existing) {
    existing.push(job);
    return;
  }
  const pending = [job];
  jobs.set(key, pending);
  void (async () => {
    while (pending.length) {
      await pending[0]();
      pending.shift();
    }
    jobs.delete(key);
  })();
}
async function verifyRetry(viewerId: string) {
  const session = await api.session();
  if (
    !session.authenticated ||
    session.needsOnboarding ||
    session.user.id !== viewerId
  )
    throw new ApiError(403, "retry_account_changed");
}

export function updateAuthorAvatar(userId: string, avatarUrl: string) {
  for (const [key, entry] of posts) {
    if (entry.value.author.id === userId) {
      posts.set(key, {
        value: { ...entry.value, author: { ...entry.value.author, avatarUrl } },
        revision: revision + 1,
      });
    }
  }
  notify();
}

export function rememberPosts(
  incoming: Post[],
  viewerId: string | null,
  startedAt = revision,
) {
  let changed = false;
  for (const post of incoming) {
    const key = keyFor(viewerId, post.id);
    if (
      (posts.get(key)?.revision ?? -1) > startedAt ||
      deleted.has(key) ||
      postOperations.get(key)?.length ||
      replyOperations.get(key)?.size
    )
      continue;
    posts.set(key, { value: post, revision });
    changed = true;
  }
  if (changed) notify();
}
function basePost(post: Post, viewerId: string | null) {
  return posts.get(keyFor(viewerId, post.id))?.value ?? post;
}
function applyPost(post: Post, command: PostCommand): Post {
  switch (command.kind) {
    case "like":
      return {
        ...post,
        liked: command.value,
        likes: Math.max(
          0,
          post.likes + Number(command.value) - Number(post.liked),
        ),
      };
    case "repost":
      return {
        ...post,
        reposted: command.value,
        reposts: Math.max(
          0,
          post.reposts + Number(command.value) - Number(post.reposted),
        ),
      };
    case "edit":
      return { ...post, content: command.content, editedAt: command.editedAt };
    case "delete":
      return post;
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}
function isDeleted(post: Post, viewerId: string | null): boolean {
  let current: Post | undefined = post;
  while (current) {
    const key = keyFor(viewerId, current.id);
    if (
      deleted.has(key) ||
      postOperations.get(key)?.some((op) => op.command.kind === "delete")
    )
      return true;
    current = current.parentId
      ? posts.get(keyFor(viewerId, current.parentId))?.value
      : undefined;
  }
  return false;
}
export function projectPost(post: Post, viewerId: string | null): Post | null {
  const base = basePost(post, viewerId);
  if (isDeleted(base, viewerId)) return null;
  const key = keyFor(viewerId, post.id);
  let result = (postOperations.get(key) ?? []).reduce(
    (value, op) => applyPost(value, op.command),
    base,
  );
  let replyDelta = replyOperations.get(key)?.size ?? 0;
  for (const [childKey, operations] of postOperations) {
    if (
      posts.get(childKey)?.value.parentId === post.id &&
      childKey.startsWith(`${viewerId ?? "anonymous"}:`) &&
      operations.some((op) => op.command.kind === "delete")
    )
      replyDelta--;
  }
  if (replyDelta)
    result = { ...result, replies: Math.max(0, result.replies + replyDelta) };
  return result;
}
export function cachedReposts(viewerId: string) {
  const result: Post[] = [];
  for (const [key, entry] of posts) {
    if (!key.startsWith(`${viewerId}:`)) continue;
    const post = projectPost(entry.value, viewerId);
    if (post?.reposted) result.push(post);
  }
  return result;
}
export function beginReply(parentId: string, viewerId: string) {
  const key = keyFor(viewerId, parentId);
  const id = crypto.randomUUID();
  const operations = replyOperations.get(key) ?? new Set<string>();
  operations.add(id);
  replyOperations.set(key, operations);
  const entry = posts.get(key);
  if (entry) entry.revision = revision + 1;
  notify();
  return (success: boolean) => {
    operations.delete(id);
    if (!operations.size) replyOperations.delete(key);
    const current = posts.get(key);
    if (current)
      posts.set(key, {
        value: {
          ...current.value,
          replies: current.value.replies + Number(success),
        },
        revision: revision + 1,
      });
    notify();
  };
}

export function mutatePost(
  post: Post,
  viewerId: string,
  command: PostCommand,
  retry = false,
) {
  const key = keyFor(viewerId, post.id);
  if (!posts.has(key)) posts.set(key, { value: post, revision });
  const operation = { id: crypto.randomUUID(), command };
  postOperations.set(key, [...(postOperations.get(key) ?? []), operation]);
  const entry = posts.get(key);
  if (entry) entry.revision = revision + 1;
  notify();
  queue(key, async () => {
    let failure: unknown;
    let failed = false;
    try {
      if (retry) await verifyRetry(viewerId);
      const patch = await retryRequest(
        async () => {
          let patch: Partial<Post> = {};
          switch (command.kind) {
            case "like":
              patch = await api.like(post.id, command.value);
              break;
            case "repost":
              patch = await api.repost(post.id, command.value);
              break;
            case "edit": {
              const { post: saved } = await api.edit(post.id, command.content);
              patch = {
                content: saved.content,
                editedAt: saved.editedAt,
                editExpiresAt: saved.editExpiresAt,
              };
              break;
            }
            case "delete": {
              try {
                await api.delete(post.id);
              } catch (error) {
                if (!(error instanceof ApiError && error.status === 404))
                  throw error;
              }
              deleted.add(key);
              const parentKey = post.parentId
                ? keyFor(viewerId, post.parentId)
                : null;
              const parent = parentKey ? posts.get(parentKey) : undefined;
              if (parentKey && parent)
                posts.set(parentKey, {
                  value: {
                    ...parent.value,
                    replies: Math.max(0, parent.value.replies - 1),
                  },
                  revision: revision + 1,
                });
              break;
            }
            default: {
              const exhaustive: never = command;
              return exhaustive;
            }
          }
          return patch;
        },
        {
          context: `post ${command.kind}`,
          beforeRetry: () => verifyRetry(viewerId),
        },
      );
      const current = posts.get(key);
      if (current)
        posts.set(key, {
          value: { ...current.value, ...patch },
          revision: revision + 1,
        });
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      postOperations.set(
        key,
        (postOperations.get(key) ?? []).filter((op) => op.id !== operation.id),
      );
      notify();
    }
    if (failed) {
      const titles = {
        like: "Couldn't update like",
        repost: "Couldn't update repost",
        edit: "Couldn't save changes",
        delete: "Couldn't delete post",
      };
      retryToast(titles[command.kind], failure, () => {
        mutatePost(post, viewerId, command, true);
      });
    }
  });
  return true;
}

export function rememberProfile(
  profile: Profile,
  viewerId: string | null,
  startedAt = revision,
) {
  rememberPosts(
    [
      ...profile.posts,
      ...profile.reposts,
      ...profile.replies.flatMap((reply) => [...reply.thread, reply.post]),
    ],
    viewerId,
    startedAt,
  );
  const key = keyFor(viewerId, profile.profile.id);
  if ((relationships.get(key)?.revision ?? -1) > startedAt) return;
  relationships.set(key, {
    value: {
      isFollowing: profile.isFollowing,
      isFollowedBy: profile.isFollowedBy,
      followerCount: profile.profile.followerCount,
      followingCount: profile.profile.followingCount,
    },
    revision,
  });
  notify();
}
function applyFollow(value: Relationship, following: boolean): Relationship {
  return {
    ...value,
    isFollowing: following,
    followerCount: Math.max(
      0,
      value.followerCount + Number(following) - Number(value.isFollowing),
    ),
  };
}
export function projectRelationship(
  profile: Profile,
  viewerId: string | null,
): Relationship {
  const key = keyFor(viewerId, profile.profile.id);
  const base = relationships.get(key)?.value ?? {
    isFollowing: profile.isFollowing,
    isFollowedBy: profile.isFollowedBy,
    followerCount: profile.profile.followerCount,
    followingCount: profile.profile.followingCount,
  };
  let result = (followOperations.get(key) ?? []).reduce(
    (value, op) => applyFollow(value, op.value),
    base,
  );
  if (profile.profile.id === viewerId) {
    let delta = 0;
    for (const [targetKey, operations] of followOperations) {
      if (!targetKey.startsWith(`${viewerId}:`)) continue;
      const target = relationships.get(targetKey);
      if (!target) continue;
      const current = operations.reduce(
        (value, op) => applyFollow(value, op.value),
        target.value,
      );
      delta += Number(current.isFollowing) - Number(target.value.isFollowing);
    }
    if (delta)
      result = {
        ...result,
        followingCount: Math.max(0, result.followingCount + delta),
      };
  }
  return result;
}
export function mutateFollow(
  profile: Profile,
  viewerId: string,
  value: boolean,
  retry = false,
) {
  const key = keyFor(viewerId, profile.profile.id);
  if (!relationships.has(key)) rememberProfile(profile, viewerId);
  const operation = { id: crypto.randomUUID(), value };
  followOperations.set(key, [...(followOperations.get(key) ?? []), operation]);
  const entry = relationships.get(key);
  if (entry) entry.revision = revision + 1;
  notify();
  queue(`follow:${key}`, async () => {
    let failure: unknown;
    let failed = false;
    try {
      if (retry) await verifyRetry(viewerId);
      const result = await retryRequest(
        () => api.follow(profile.profile.handle, value),
        { context: "follow", beforeRetry: () => verifyRetry(viewerId) },
      );
      const current = relationships.get(key);
      if (current) {
        const delta =
          Number(result.isFollowing) - Number(current.value.isFollowing);
        relationships.set(key, {
          value: { ...current.value, ...result },
          revision: revision + 1,
        });
        const ownKey = keyFor(viewerId, viewerId);
        const own = relationships.get(ownKey);
        if (own)
          relationships.set(ownKey, {
            value: {
              ...own.value,
              followingCount: Math.max(0, own.value.followingCount + delta),
            },
            revision: revision + 1,
          });
      }
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      followOperations.set(
        key,
        (followOperations.get(key) ?? []).filter(
          (op) => op.id !== operation.id,
        ),
      );
      notify();
    }
    if (failed)
      retryToast("Couldn't update follow", failure, () => {
        mutateFollow(profile, viewerId, value, true);
      });
  });
  return true;
}
