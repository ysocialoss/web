import { Fragment, type ReactNode } from "react";
import { ProfileHoverLink } from "@/features/profile/profile-hover-link";
import type { Post } from "@/lib/api";

export const MENTION_PATTERN =
  /(?<![\p{L}\p{N}_@/.])@([a-z0-9_]{3,32})(?![\p{L}\p{N}_])/giu;

export function findMentions(content: string) {
  return Array.from(content.matchAll(MENTION_PATTERN), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    handle: match[1].toLowerCase(),
  }));
}

export function MentionLink({
  handle,
  children,
}: {
  handle: string;
  children: ReactNode;
}) {
  return (
    <ProfileHoverLink handle={handle} className="mention">
      {children}
    </ProfileHoverLink>
  );
}

export function MentionText({
  post,
}: {
  post: Pick<Post, "content" | "mentions">;
}) {
  const targets = new Map(
    post.mentions.map((mention) => [mention.username, mention]),
  );
  const parts = [];
  let end = 0;
  for (const match of findMentions(post.content)) {
    const target = targets.get(match.handle);
    if (!target) continue;
    parts.push(
      <Fragment key={match.start}>
        {post.content.slice(end, match.start)}
        <MentionLink handle={target.handle}>{match.text}</MentionLink>
      </Fragment>,
    );
    end = match.end;
  }
  return (
    <>
      {parts}
      {post.content.slice(end)}
    </>
  );
}
