import type { Post, PostQuote } from "@/lib/api";

/** The embed a quote of this post shows: what the original looks like inside it. */
export function quoteOf(post: Post): PostQuote {
  return {
    state: "available",
    post: {
      id: post.id,
      content: post.content,
      gif: post.gif,
      imageIds: post.imageIds,
      createdAt: post.createdAt,
      editedAt: post.editedAt,
      parentId: post.parentId,
      pollTitle: post.poll?.title ?? null,
      isQuote: post.quote !== null,
      mentions: post.mentions,
      author: post.author,
    },
  };
}
