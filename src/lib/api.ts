import { z } from "zod";
import { beginConnectionRetry } from "./connection-status";

export const bannerCropSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BannerCrop = z.infer<typeof bannerCropSchema>;
const userSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
const postSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  editExpiresAt: z.string(),
  author: userSchema,
  likes: z.number(),
  liked: z.boolean(),
  replies: z.number(),
  reposts: z.number(),
  reposted: z.boolean(),
});
const pageSchema = z.object({
  posts: z.array(postSchema),
  nextCursor: z.string().nullable(),
  serverNow: z.string(),
});
const postResponseSchema = z.object({
  post: postSchema,
  serverNow: z.string(),
});
const sessionSchema = z.union([
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    needsOnboarding: z.literal(true),
    user: z.null(),
    avatarUrl: z.string().nullable(),
    suggestedHandle: z.string(),
  }),
  z.object({
    authenticated: z.literal(true),
    needsOnboarding: z.literal(false),
    user: userSchema.extend({
      bannerUrl: z.string().nullable(),
      bannerCrop: bannerCropSchema.nullable(),
    }),
    avatarUrl: z.string().nullable(),
    suggestedHandle: z.string(),
  }),
]);
const profileSchema = z.object({
  profile: userSchema.extend({
    bio: z.string(),
    bannerUrl: z.string().nullable(),
    bannerCrop: bannerCropSchema.nullable(),
    createdAt: z.string(),
    followerCount: z.number().int().nonnegative(),
    followingCount: z.number().int().nonnegative(),
  }),
  isFollowing: z.boolean(),
  isFollowedBy: z.boolean(),
  posts: z.array(postSchema),
  reposts: z.array(postSchema),
  replies: z.array(z.object({ post: postSchema, thread: z.array(postSchema) })),
  serverNow: z.string(),
});
export type Post = z.infer<typeof postSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Profile = z.infer<typeof profileSchema>;

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Only transport failures are retried. Validation and authorization errors
// still reach the caller so the user can act on them.
export async function retryRequest<T>(
  operation: () => Promise<T>,
  {
    context,
    signal,
    beforeRetry,
  }: {
    context: string;
    signal?: AbortSignal;
    beforeRetry?: () => Promise<void>;
  },
): Promise<T> {
  let attempt = 0;
  let finishRetry: (() => void) | undefined;
  try {
    while (true) {
      signal?.throwIfAborted();
      try {
        if (attempt > 0) await beforeRetry?.();
        return await operation();
      } catch (error) {
        signal?.throwIfAborted();
        if (
          !(error instanceof ApiError) ||
          ![0, 408, 500, 502, 503, 504].includes(error.status)
        )
          throw error;
        finishRetry ??= beginConnectionRetry();
        const delay = Math.min(1000 * 2 ** Math.min(attempt++, 5), 30_000);
        if (import.meta.env.DEV)
          console.debug("[api] Retrying in the background", {
            context,
            attempt,
            delay,
            error,
          });
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            reject(signal?.reason);
          };
          const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve();
          }, delay);
          signal?.addEventListener("abort", onAbort, { once: true });
        });
      }
    }
  } finally {
    finishRetry?.();
  }
}
export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Your session expired. Sign in to continue.";
    if (error.message === "onboarding_required")
      return "Choose your handle to continue.";
    if (error.message === "edit_window_expired")
      return "The 15-minute edit window has expired.";
    if (error.message === "profile_not_found")
      return "This profile does not exist.";
    if (error.message === "gif_search_limit")
      return "GIF search limit reached. Try again later.";
    if (error.message === "gif_search_unavailable")
      return "GIF search is temporarily unavailable. Try again.";
    if (error.message === "invalid_gif_selection")
      return "This GIF selection expired. Search and select it again.";
    if (error.message === "klipy_not_configured")
      return "GIF search is not configured yet.";
    if (error.message === "invalid_banner")
      return "Choose a JPEG, PNG, AVIF, WebP or GIF under 10 MB. Animated images must have no more than 120 frames.";
    if (error.message === "avatar_storage_not_configured")
      return "Profile picture uploads are not configured yet.";
    if (error.message === "avatar_storage_unavailable")
      return "Picture storage is temporarily unavailable. Please try again.";
    if (
      error.message === "invalid_avatar" ||
      error.message === "avatar_png_required"
    )
      return "This picture could not be saved. Choose another image.";
    if (error.status === 413)
      return "This picture is too large. Choose a smaller image.";
    if (error.message === "post_not_found")
      return "This post no longer exists.";
    if (error.message === "retry_account_changed")
      return "Sign in to the original account before retrying this action.";
    if (error.message === "post_id_conflict")
      return "This post was already sent with different content. Reload to view it.";
    if (error.status === 409)
      return error.message === "already_onboarded"
        ? "Your account is already set up. Reload to continue."
        : "That handle is taken. Choose another.";
    return `Request failed: ${error.message}`;
  }
  return "Unable to reach the API. Please try again.";
}
async function sendRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers:
      body === undefined
        ? undefined
        : {
            "Content-Type":
              body instanceof Blob
                ? body.type || "application/octet-stream"
                : "application/json",
          },
    body:
      body === undefined
        ? undefined
        : body instanceof Blob
          ? body
          : JSON.stringify(body),
  }).catch((error: unknown) => {
    signal?.throwIfAborted();
    if (error instanceof TypeError)
      throw new ApiError(0, "network_unavailable");
    throw error;
  });
  if (!response.ok) {
    const parsed = z
      .object({ error: z.string() })
      .safeParse(await response.json().catch(() => null));
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error : response.statusText,
    );
  }
  return schema.parse(
    response.status === 204 ? undefined : await response.json(),
  );
}
function request<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const send = () => sendRequest(path, schema, method, body, signal);
  // GIF search uses POST but is a read. Writes opt in at their owner, where
  // account checks and stable post IDs make replay safe.
  return method === "GET" || path === "/api/banners/gifs/search"
    ? retryRequest(send, { context: `${method} ${path}`, signal })
    : send();
}
const postPath = (id: string) => `/api/posts/${encodeURIComponent(id)}`;
export const api = {
  session: (signal?: AbortSignal) =>
    request("/auth/me", sessionSchema, "GET", undefined, signal),
  onboard: (handle: string) =>
    request("/auth/profile", z.object({ user: userSchema }), "POST", {
      handle,
    }),
  searchGifs: (query: string, page = 1, signal?: AbortSignal) =>
    request(
      "/api/banners/gifs/search",
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            previewUrl: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
            url: z.string(),
            token: z.string(),
          }),
        ),
        hasNext: z.boolean(),
      }),
      "POST",
      { query, page },
      signal,
    ),
  selectBannerGif: (token: string, crop: BannerCrop, signal?: AbortSignal) =>
    request(
      "/api/banners/gifs",
      z.object({ bannerUrl: z.string() }),
      "POST",
      { token, crop },
      signal,
    ),
  uploadBanner: (picture: Blob, crop: BannerCrop, signal?: AbortSignal) =>
    request(
      `/api/banners/me?crop=${encodeURIComponent(JSON.stringify(crop))}`,
      z.object({ bannerUrl: z.string() }),
      "PUT",
      picture,
      signal,
    ),
  removeBanner: (signal?: AbortSignal) =>
    request("/api/banners/me", z.undefined(), "DELETE", undefined, signal),
  uploadAvatar: (picture: Blob, signal?: AbortSignal) =>
    request(
      "/api/avatars/me",
      z.object({ avatarUrl: z.string() }),
      "PUT",
      picture,
      signal,
    ),
  logout: () => request("/auth/logout", z.undefined(), "POST"),
  posts: (cursor?: string, signal?: AbortSignal) =>
    request(
      `/api/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      pageSchema,
      "GET",
      undefined,
      signal,
    ),
  post: (id: string, signal?: AbortSignal) =>
    request(postPath(id), postResponseSchema, "GET", undefined, signal),
  publish: (content: string, clientId?: string) =>
    request("/api/posts", postResponseSchema, "POST", { content, clientId }),
  replies: (id: string, cursor?: string, signal?: AbortSignal) =>
    request(
      `${postPath(id)}/replies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      pageSchema,
      "GET",
      undefined,
      signal,
    ),
  reply: (id: string, content: string, clientId?: string) =>
    request(`${postPath(id)}/replies`, postResponseSchema, "POST", {
      content,
      clientId,
    }),
  like: (id: string, liked: boolean) =>
    request(
      `${postPath(id)}/like`,
      z.object({ likes: z.number(), liked: z.boolean() }),
      liked ? "PUT" : "DELETE",
    ),
  repost: (id: string, reposted: boolean) =>
    request(
      `${postPath(id)}/repost`,
      z.object({ reposts: z.number(), reposted: z.boolean() }),
      reposted ? "PUT" : "DELETE",
    ),
  edit: (id: string, content: string) =>
    request(postPath(id), postResponseSchema, "PATCH", { content }),
  delete: (id: string) => request(postPath(id), z.undefined(), "DELETE"),
  follow: (handle: string, following: boolean) =>
    request(
      `/api/profiles/${encodeURIComponent(handle)}/follow`,
      z.object({
        isFollowing: z.boolean(),
        isFollowedBy: z.boolean(),
        followerCount: z.number().int().nonnegative(),
      }),
      following ? "PUT" : "DELETE",
    ),
  profile: (handle: string, signal?: AbortSignal) =>
    request(
      `/api/profiles/${encodeURIComponent(handle)}`,
      profileSchema,
      "GET",
      undefined,
      signal,
    ),
};
