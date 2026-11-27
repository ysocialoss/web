import type { Profile, ProfileTab, ProfileTimelinePage } from "@/lib/api";

function appendUnique<T>(current: T[], incoming: T[], key: (item: T) => string) {
  const seen = new Set(current.map(key));
  return [...current, ...incoming.filter((item) => !seen.has(key(item)))];
}

export function mergeTimelinePage(profile: Profile, tab: ProfileTab, page: ProfileTimelinePage): Profile {
  const nextCursors = { ...profile.nextCursors, [tab]: page.nextCursor };
  if (tab === "posts")
    return { ...profile, nextCursors, posts: appendUnique(profile.posts, page.posts, (post) => post.id) };
  if (tab === "replies")
    return { ...profile, nextCursors, replies: appendUnique(profile.replies, page.replies, ({ post }) => post.id) };
  return {
    ...profile,
    nextCursors,
    reposts: appendUnique(profile.reposts, page.reposts, (post) => post.id),
    repostedBy: { ...profile.repostedBy, ...page.repostedBy },
  };
}
