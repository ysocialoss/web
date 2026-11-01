import type { MediaPostType } from "~/lib/post-types";

// Used by the existing media preview component; text posts do not accept media.
export type PostAttachment = {
  name: string;
  url: string;
  size: number;
  kind: MediaPostType;
};
export type PostData = {
  id: string;
  content: string;
  likes: number;
  liked: boolean;
  createdAt: string;
  editedAt: string | null;
  editExpiresAt: string;
  author: { id: string; handle: string; displayName: string };
};
export const characterCount = (text: string) => Array.from(text).length;
export const validContent = (text: string) =>
  text.trim().length > 0 && !text.includes("\u0000") && characterCount(text.trim()) <= 2000;
function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
export function parsePost(value: unknown): PostData {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !("likes" in value) ||
    typeof value.likes !== "number" ||
    !Number.isSafeInteger(value.likes) ||
    value.likes < 0 ||
    !("liked" in value) ||
    typeof value.liked !== "boolean" ||
    !("content" in value) ||
    typeof value.content !== "string" ||
    !("createdAt" in value) ||
    !timestamp(value.createdAt) ||
    !("editedAt" in value) ||
    !(value.editedAt === null || timestamp(value.editedAt)) ||
    !("editExpiresAt" in value) ||
    !timestamp(value.editExpiresAt) ||
    !("author" in value) ||
    typeof value.author !== "object" ||
    value.author === null
  )
    throw new Error("Invalid post response.");
  const author = value.author;
  if (
    !("id" in author) ||
    typeof author.id !== "string" ||
    !("handle" in author) ||
    typeof author.handle !== "string" ||
    !("displayName" in author) ||
    typeof author.displayName !== "string"
  )
    throw new Error("Invalid author response.");
  return {
    id: value.id,
    content: value.content,
    likes: value.likes,
    liked: value.liked,
    createdAt: value.createdAt,
    editedAt: value.editedAt,
    editExpiresAt: value.editExpiresAt,
    author: {
      id: author.id,
      handle: author.handle,
      displayName: author.displayName,
    },
  };
}
const errors: Record<string, string> = {
  sign_in_required: "Sign in to post.",
  onboarding_required: "Choose your handle before posting.",
  invalid_content: "Enter between 1 and 2,000 characters.",
  edit_window_expired: "The 15-minute editing window has closed.",
  not_post_author: "Only the author can change this post.",
  profile_not_found: "This profile could not be found.",
  post_not_found: "This post has been deleted.",
};
export class PostError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(errors[code] || "Could not connect. Please retry.");
  }
}
export async function request(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(path, { ...options, cache: "no-store" });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new PostError(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : "unavailable",
      response.status,
    );
  }
  return response.status === 204 ? null : response.json();
}
export async function loadPosts(cursor: string | null, signal: AbortSignal) {
  const body = await request(
    `/api/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    { signal },
  );
  if (
    typeof body !== "object" ||
    body === null ||
    !("posts" in body) ||
    !Array.isArray(body.posts) ||
    !("nextCursor" in body) ||
    !(body.nextCursor === null || typeof body.nextCursor === "string") ||
    !("serverNow" in body) ||
    !timestamp(body.serverNow)
  )
    throw new Error("Invalid feed response.");
  return {
    posts: body.posts.map(parsePost),
    nextCursor: body.nextCursor,
    serverNow: body.serverNow,
  };
}
export async function savePost(content: string, id?: string) {
  const body = await request(`/api/posts${id ? `/${id}` : ""}`, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return parsePostResponse(body);
}
function parsePostResponse(body: unknown) {
  if (
    typeof body !== "object" ||
    body === null ||
    !("post" in body) ||
    !("serverNow" in body) ||
    !timestamp(body.serverNow)
  )
    throw new Error("Invalid post response.");
  return { post: parsePost(body.post), serverNow: body.serverNow };
}
export async function deletePost(id: string) {
  await request(`/api/posts/${id}`, { method: "DELETE" });
}

export async function loadPost(id: string, signal: AbortSignal) {
  return parsePostResponse(
    await request(`/api/posts/${encodeURIComponent(id)}`, { signal }),
  );
}

export async function setPostLike(id: string, liked: boolean) {
  const body = await request(`/api/posts/${id}/like`, {
    method: liked ? "PUT" : "DELETE",
  });
  if (
    typeof body !== "object" ||
    body === null ||
    !("likes" in body) ||
    typeof body.likes !== "number" ||
    !Number.isSafeInteger(body.likes) ||
    body.likes < 0 ||
    !("liked" in body) ||
    typeof body.liked !== "boolean"
  )
    throw new Error("Invalid like response.");
  return { likes: body.likes, liked: body.liked };
}
