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
const activityUserSchema = userSchema.extend({
  optionLabel: z.string().optional(),
  // Quote activity: the quote post this person wrote.
  quoteId: z.string().optional(),
});
export const repostAudienceSchema = z.enum(["public", "friends"]);
export type RepostAudience = z.infer<typeof repostAudienceSchema>;
const postImageIdsSchema = z.array(z.uuid()).default([]);
/** The post embedded in a quote, one level deep. */
const quotedPostSchema = z.object({
  id: z.string(),
  content: z.string(),
  imageIds: postImageIdsSchema,
  gif: z
    .object({ url: z.string(), title: z.string() })
    .nullable()
    .default(null),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  parentId: z.string().nullable(),
  pollTitle: z.string().nullable(),
  isQuote: z.boolean(),
  mentions: z
    .array(
      z.object({ id: z.string(), handle: z.string(), username: z.string() }),
    )
    .default([]),
  author: userSchema,
});
const quoteSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("available"), post: quotedPostSchema }),
  z.object({ state: z.literal("unavailable") }),
]);
export type QuotedPost = z.infer<typeof quotedPostSchema>;
export type PostQuote = z.infer<typeof quoteSchema>;
/** Why a post sits in a list as a repost: who shared it and how widely. */
const repostContextSchema = z.object({
  by: userSchema,
  audience: repostAudienceSchema,
  others: z.number().int().nonnegative(),
});
export type RepostContext = z.infer<typeof repostContextSchema>;
const repostedBySchema = z.record(z.string(), repostContextSchema).default({});
const postGifSchema = z.object({ url: z.string(), title: z.string() });
const voiceSchema = z.object({
  url: z.string(), durationMs: z.number().int().min(2000).max(120000), bytes: z.number().int().positive(),
  waveform: z.array(z.number().int().min(0).max(100)).length(48).optional(),
});
const voiceDraftSchema = voiceSchema.extend({ token: z.string() });
const voiceJobSchema = z.union([voiceDraftSchema, z.object({ pending: z.literal(true) })]);
export type VoiceDraft = z.infer<typeof voiceDraftSchema>;
export const pollDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  options: z
    .array(z.string().trim().min(1).max(80))
    .min(2)
    .max(6)
    .refine(
      (options) =>
        new Set(options.map((option) => option.toLowerCase())).size ===
        options.length,
    ),
  anonymous: z.boolean(),
});
const pollSchema = pollDraftSchema.extend({
  options: z.array(
    z.object({ label: z.string(), votes: z.number().int().nonnegative() }),
  ),
  selectedOption: z.number().int().nonnegative().nullable(),
});
export type PollDraft = z.infer<typeof pollDraftSchema>;
export type Poll = z.infer<typeof pollSchema>;
const basePostSchema = z.object({
  mentions: z
    .array(
      z.object({ id: z.string(), handle: z.string(), username: z.string() }),
    )
    .default([]),
  id: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  gif: postGifSchema.nullable().default(null),
  imageIds: postImageIdsSchema,
  voice: voiceSchema.nullable().default(null),
  poll: pollSchema.nullable().default(null),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  editExpiresAt: z.string(),
  author: userSchema,
  likes: z.number(),
  liked: z.boolean(),
  replies: z.number(),
  reposts: z.number(),
  reposted: z.boolean(),
  // How the viewer reposted it, if they did.
  repostAudience: repostAudienceSchema.nullable().default(null),
  quotes: z.number().default(0),
  // The embedded post when this post is a quote.
  quote: quoteSchema.nullable().default(null),
  // Who this post answers, for replies shown outside their thread.
  replyTo: z
    .object({ id: z.string(), handle: z.string(), displayName: z.string() })
    .nullable()
    .default(null),
  // Mutual follows who liked this post: how many, and the first few.
  friendLikes: z.number().default(0),
  friendLikers: z.array(userSchema).default([]),
  // Normalized topics (#name) in the post or reply.
  topics: z.array(z.string()).default([]),
});
const postSchema = basePostSchema.extend({
  // Topic pages only: the posts above a reply, root first.
  ancestors: z.array(basePostSchema).optional(),
  // Home and topic lists: the author's own first reply to this post.
  selfReply: basePostSchema.nullable().optional(),
});
const topicCountSchema = z.object({ name: z.string(), count: z.number() });
const searchUserSchema = userSchema.extend({
  bio: z.string(),
  followerCount: z.number(),
});
const pageSchema = z.object({
  posts: z.array(postSchema),
  repostedBy: repostedBySchema,
  nextCursor: z.string().nullable(),
  serverNow: z.string(),
});
const postResponseSchema = z.object({
  post: postSchema,
  serverNow: z.string(),
});
const websiteLinkSchema = z.object({
  href: z.string(),
  title: z.string(),
  iconKey: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
});
const imagePreviewKeySchema = z.string().regex(/^[0-9a-f]{64}$/);
const pagePreviewSchema = websiteLinkSchema.extend({
  kind: z.literal("website").default("website"),
  description: z.string().optional(),
  siteName: z.string(),
  imageKey: imagePreviewKeySchema.optional(),
});
const websitePreviewSchema = z.union([
  pagePreviewSchema,
  websiteLinkSchema.extend({
    kind: z.literal("image"),
    imageKey: imagePreviewKeySchema,
  }),
]);
const websitePreviewsSchema = z.object({
  links: z.array(websiteLinkSchema).default([]),
  previews: z.array(websitePreviewSchema),
  nextOffset: z.number().int().nonnegative().optional(),
});
export type WebsitePreview = z.infer<typeof websitePreviewSchema>;
export type WebsiteLink = z.infer<typeof websiteLinkSchema>;
const threadSchema = z.object({
  post: postSchema,
  ancestors: z.array(postSchema),
  replies: z.array(postSchema),
  truncated: z.boolean(),
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
    pendingApproval: z.boolean().default(false),
    ban: z.object({
      at: z.iso.datetime(),
      reason: z.string().nullable(),
      by: z.string().nullable(),
      byProfileHandle: z.string().nullable().default(null),
    }).nullable().default(null),
    user: userSchema.extend({
      pronouns: z.string().default(""),
      bannerUrl: z.string().nullable(),
      bannerCrop: bannerCropSchema.nullable(),
    }),
    avatarUrl: z.string().nullable(),
    suggestedHandle: z.string(),
  }),
]);
const githubAccountSchema = z.object({
  login: z.string().regex(/^[a-z\d][a-z\d_-]{0,99}$/i),
  contributionCount: z.number().int().nonnegative().nullable(),
});
const githubSettingsSchema = z.object({
  configured: z.boolean(),
  github: githubAccountSchema.nullable(),
});
const profileSchema = z.object({
  profile: userSchema.extend({
    isOg: z.boolean().default(false),
    github: githubAccountSchema.nullable().default(null),
    badges: z.array(z.object({
      id: z.uuid(),
      icon: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      tooltip: z.string(),
    })).default([]),
    bio: z.string(),
    pronouns: z.string().default(""),
    bannerUrl: z.string().nullable(),
    bannerCrop: bannerCropSchema.nullable(),
    createdAt: z.string(),
    banReason: z.string().nullable().default(null),
    bannedAt: z.iso.datetime().nullable().default(null),
    bannedBy: z.string().nullable().default(null),
    bannedByProfileHandle: z.string().nullable().default(null),
    followerCount: z.number().int().nonnegative(),
    followingCount: z.number().int().nonnegative(),
  }),
  isFollowing: z.boolean(),
  isFollowedBy: z.boolean(),
  posts: z.array(postSchema),
  // Plain reposts and the person's own quote posts, newest first.
  reposts: z.array(postSchema),
  repostedBy: repostedBySchema,
  replies: z.array(z.object({ post: postSchema, thread: z.array(postSchema) })),
  serverNow: z.string(),
});
const profileCardSchema = z.object({
  profile: userSchema.extend({
    bio: z.string(),
    pronouns: z.string().default(""),
    bannerUrl: z.string().nullable(),
    bannerCrop: bannerCropSchema.nullable(),
    createdAt: z.string(),
    followerCount: z.number().int().nonnegative(),
    followingCount: z.number().int().nonnegative(),
    postCount: z.number().int().nonnegative(),
  }),
  isFollowing: z.boolean(),
  isFollowedBy: z.boolean(),
  isSelf: z.boolean(),
  signedIn: z.boolean(),
});
export type ProfileCard = z.infer<typeof profileCardSchema>;
export type Post = z.infer<typeof postSchema>;
export type GifSearchItem = Awaited<
  ReturnType<typeof api.searchGifs>
>["items"][number];
export type TopicCount = z.infer<typeof topicCountSchema>;
export type SearchUser = z.infer<typeof searchUserSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Profile = z.infer<typeof profileSchema>;
const notificationSchema = z.object({
  id: z.string(),
  kind: z.enum(["like", "repost", "reply", "follow", "mention", "quote"]),
  actor: userSchema,
  postId: z.string().nullable(),
  conversationId: z.uuid().nullish(),
  preview: z.string().nullable(),
  chatPreview: z.boolean().optional(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});
export type SocialNotification = z.infer<typeof notificationSchema>;
const notificationsSchema = z.object({
  notifications: z.array(notificationSchema),
  hideContent: z.boolean().optional(),
  unreadCount: z.number(),
  nextCursor: z.string().nullable(),
});

const traceCodes: Record<string, number> = {
  // auth
  invalid_origin: 1001,
  sign_in_required: 1002,
  onboarding_required: 1003,
  account_deleted: 1004,
  already_onboarded: 1005,
  invalid_login_state: 1006,
  invalid_provider_identity: 1007,
  login_not_configured: 1008,
  provider_unavailable: 1009,
  // post
  post_not_found: 2001,
  not_post_author: 2002,
  edit_window_expired: 2003,
  invalid_content: 2004,
  invalid_post_id: 2005,
  post_id_conflict: 2006,
  invalid_topic: 2007,
  poll_not_found: 2008,
  invalid_poll_option: 2009,
  poll_is_anonymous: 2011,
  invalid_repost: 2012,
  // profile
  profile_not_found: 3001,
  invalid_profile: 3002,
  invalid_handle: 3003,
  cannot_follow_self: 3004,
  // paging/inbox/push
  invalid_cursor: 4001,
  invalid_activity_query: 4002,
  invalid_notification_id: 4003,
  invalid_notification_query: 4004,
  invalid_push_mute: 4005,
  push_not_configured: 4006,
  invalid_push_subscription: 4007,
  notification_not_found: 4008,
  push_subscription_not_found: 4009,
  // media
  invalid_avatar: 5001,
  avatar_png_required: 5002,
  avatar_not_found: 5003,
  avatar_storage_not_configured: 5004,
  avatar_storage_unavailable: 5005,
  invalid_banner: 5006,
  invalid_banner_crop: 5007,
  banner_not_found: 5008,
  avatar_in_use: 5009,
  invalid_voice: 5010,
  voice_too_short: 5011,
  voice_too_long: 5012,
  invalid_voice_selection: 5013,
  voice_audio_required: 5014,
  voice_not_found: 5015,
  voice_processing_unavailable: 5016,
  voice_processing_busy: 5017,
  voice_not_configured: 5018,
  invalid_post_image: 5019,
  post_image_rejected: 5020,
  post_image_check_unavailable: 5021,
  post_image_busy: 5022,
  post_image_draft_limit: 5023,
  invalid_post_image_selection: 5024,
  post_image_not_found: 5025,
  post_image_upload_forbidden: 5026,
  // gif
  invalid_gif_selection: 6001,
  invalid_search: 6002,
  gif_search_limit: 6003,
  gif_search_unavailable: 6004,
  klipy_not_configured: 6005,
  // api
  route_not_found: 7001,
  unexpected_response: 7002,
};

export class ApiError extends Error {
  readonly status: number;
  /** "METHOD /path" of the failed request, for tracing. */
  readonly endpoint?: string;
  constructor(status: number, message: string, endpoint?: string) {
    super(message);
    this.status = status;
    this.endpoint = endpoint;
  }
  /**
   * Numeric code shown to people next to the message so a report can be traced
   * to the exact cause, e.g. YS-1001. Known API errors have a fixed number
   * (see traceCodes: 1xxx auth, 2xxx posts, 3xxx profiles, 4xxx paging/inbox/
   * push, 5xxx media, 6xxx GIFs, 7xxx API plumbing). Unlisted errors get a
   * stable 9xxx number derived from the API's error text. YS-0001 means the
   * server was never reached.
   */
  get traceCode() {
    if (this.status === 0) return "YS-0001";
    const known = traceCodes[this.message];
    if (known) return `YS-${known}`;
    let hash = 0;
    for (const char of `${this.status}:${this.message}`)
      hash = (hash * 31 + char.charCodeAt(0)) % 1000;
    return `YS-${9000 + hash}`;
  }
}

export function waitForRetry(delay: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      window.removeEventListener("online", resume);
    }
    function resume() {
      cleanup();
      resolve();
    }
    function abort() {
      cleanup();
      reject(signal?.reason);
    }
    const timer = setTimeout(resume, delay);
    signal?.addEventListener("abort", abort, { once: true });
    window.addEventListener("online", resume, { once: true });
  });
}

// Only transport and temporary capacity failures are retried. Validation and authorization errors
// still reach the caller so the user can act on them.
export async function retryRequest<T>(
  operation: () => Promise<T>,
  {
    context,
    signal,
    beforeRetry,
    maxDelayMs = 30_000,
  }: {
    context: string;
    signal?: AbortSignal;
    beforeRetry?: () => Promise<void>;
    maxDelayMs?: number;
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
        if (!(error instanceof ApiError)) throw error;
        const voiceProcessorBusy =
          error.status === 429 && error.message === "voice_processing_busy";
        if (voiceProcessorBusy) {
          finishRetry?.();
          finishRetry = undefined;
        } else {
          if (![0, 408, 425, 500, 502, 503, 504].includes(error.status)) throw error;
          finishRetry ??= beginConnectionRetry();
        }
        const delay = Math.min(1000 * 2 ** Math.min(attempt++, 5), maxDelayMs);
        if (import.meta.env.DEV)
          console.debug("[api] Retrying in the background", {
            context,
            attempt,
            delay,
            error,
          });
        await waitForRetry(delay, signal);
      }
    }
  } finally {
    finishRetry?.();
  }
}
function friendlyMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "Your session expired. Sign in to continue.";
    if (error.message === "onboarding_required")
      return "Choose your handle to continue.";
    if (error.message === "approval_required")
      return "Your account is awaiting approval.";
    if (error.message === "account_banned")
      return "Your account is banned.";
    if (error.message === "voice_too_short") return "Record at least 2 seconds.";
    if (error.message === "invalid_post_image")
      return "Choose a static JPEG, PNG, or WebP image.";
    if (error.message === "post_image_rejected")
      return "This image was flagged as NSFW and could not be attached.";
    if (error.message === "post_image_check_unavailable" || error.message === "post_image_busy")
      return "Image screening is temporarily unavailable. Try choosing the image again.";
    if (error.message === "post_image_draft_limit")
      return "You have too many unsent images. Remove some or publish your draft.";
    if (error.message === "invalid_post_image_selection")
      return "An image attachment expired or was removed. Choose the images again.";
    if (error.status === 413 && error.endpoint?.includes("/api/post-images"))
      return "Images can be up to 8 MB each.";
    if (error.message === "voice_too_long") return "Voice messages can be at most 2 minutes long.";
    if (error.message === "invalid_voice" || error.message === "voice_audio_required")
      return "This recording could not be read. Please record it again.";
    if (error.message === "voice_job_not_found") return "This recording expired. Please record it again.";
    if (error.message === "invalid_voice_selection")
      return "This recording expired or was already used. Please record it again.";
    if (error.status === 413 && error.endpoint?.includes("/api/voices"))
      return "This recording exceeds the 8 MB upload limit. Please record a shorter message.";
    if (error.message === "edit_window_expired")
      return "The 15-minute edit window has expired.";
    if (error.message === "profile_not_found")
      return "This profile does not exist.";
    if (error.message === "invalid_profile")
      return "Check your profile details, then try again.";
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
    if (error.message === "avatar_not_found")
      return "This picture is no longer available.";
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
    if (error.message === "invalid_poll_option")
      return "Choose an option from this poll.";
    if (error.message === "invalid_topic") return "This isn't a valid topic.";
    if (error.message === "invalid_search")
      return "This search isn't valid. Try something shorter.";
    if (error.message === "retry_account_changed")
      return "Sign in to the original account before retrying this action.";
    if (error.message === "post_id_conflict")
      return "This post was already sent with different content. Reload to view it.";
    if (error.status === 409)
      return error.message === "already_onboarded"
        ? "Your account is already set up. Reload to continue."
        : "That handle is taken. Choose another.";
    if (error.status === 0)
      return "You seem to be offline. Check your connection and try again.";
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status === 404)
      return "We couldn't find what you were looking for.";
    if (error.status === 429)
      return "Too many requests. Wait a moment, then try again.";
    if (error.status >= 500)
      return "Something went wrong on our side. Please try again in a moment.";
    return "Something went wrong. Please try again.";
  }
  if (error instanceof z.ZodError)
    return "We got an unexpected answer from the server. Please try again.";
  return "Something went wrong. Please try again.";
}
/** User-facing text for any failure, ending in a trace code developers can search for. */
export function errorMessage(error: unknown) {
  const message = friendlyMessage(error);
  const code =
    error instanceof ApiError
      ? error.traceCode
      : error instanceof z.ZodError
        ? "YS-0002"
        : "YS-0003";
  return `${message} (${code})`;
}
export async function sendRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers:
      body === undefined
        ? headers
        : {
            ...headers,
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
    if (signal?.reason instanceof DOMException && signal.reason.name === "TimeoutError")
      throw new ApiError(408, "request_timeout", `${method} ${path}`);
    signal?.throwIfAborted();
    if (error instanceof TypeError)
      throw new ApiError(0, "network_unavailable");
    throw error;
  });
  if (!response.ok) {
    const parsed = z
      .object({ error: z.string() })
      .safeParse(await response.json().catch(() => null));
    const error = new ApiError(
      response.status,
      // A body that is not our JSON error shape means a proxy or an
      // unexpected route answered, not the API itself.
      parsed.success ? parsed.data.error : "unexpected_response",
      `${method} ${path}`,
    );
    console.error(`[ysocial] ${error.traceCode}`, error.endpoint);
    throw error;
  }
  const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => {
    if (signal?.reason instanceof DOMException && signal.reason.name === "TimeoutError")
      throw new ApiError(408, "request_timeout", `${method} ${path}`);
    signal?.throwIfAborted();
    throw new ApiError(502, "unexpected_response", `${method} ${path}`);
  });
  return schema.parse(data);
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
function attemptSignal(ms: number, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
const postPath = (id: string) => `/api/posts/${encodeURIComponent(id)}`;
export const postImageUrl = (id: string) => `/api/post-images/${encodeURIComponent(id)}`;
export const api = {
  uploadPostImage: (file: File, signal: AbortSignal) =>
    sendRequest("/api/post-images", z.object({ id: z.uuid() }), "POST",
      file.slice(0, file.size, "application/octet-stream"), attemptSignal(45_000, signal), {
        "X-Post-Image-Name": encodeURIComponent(Array.from(file.name).slice(0, 255).join("")),
      }),
  discardPostImage: (id: string) =>
    sendRequest(postImageUrl(id), z.undefined(), "DELETE", undefined, AbortSignal.timeout(10_000)),
  githubSettings: (signal: AbortSignal) =>
    request("/api/github", githubSettingsSchema, "GET", undefined, signal),
  connectGithub: (returnTo?: "profile") => request("/api/github/connect", z.object({
    url: z.url().refine((value) => {
      const url = new URL(value);
      return url.origin === "https://github.com" && url.pathname === "/login/oauth/authorize";
    }),
  }), "POST", returnTo ? { returnTo } : undefined),
  disconnectGithub: () => request("/api/github", z.undefined(), "DELETE"),
  pronounRecommendations: (signal: AbortSignal) =>
    request(
      "/api/profiles/pronouns/recommendations",
      z.object({
        languages: z.record(z.string(), z.array(z.string())),
        general: z.array(z.string()),
        maxLength: z.number().int().positive(),
      }),
      "GET",
      undefined,
      signal,
    ),
  notifications: (cursor?: string, unread = false, signal?: AbortSignal) =>
    request(
      `/api/notifications?unread=${unread}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      notificationsSchema,
      "GET",
      undefined,
      signal,
    ),
  readNotification: (id: string) =>
    request(
      `/api/notifications/${encodeURIComponent(id)}/read`,
      z.undefined(),
      "PUT",
    ),
  readAllNotifications: (through: string) =>
    request("/api/notifications/read", z.undefined(), "PUT", { through }),
  pushConfig: (endpoint?: string, signal?: AbortSignal) =>
    request(
      `/api/notifications/push${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`,
      z.object({
        publicKey: z.string().nullable(),
        subscribed: z.boolean(),
        promptDismissed: z.boolean(),
        hideContent: z.boolean().default(false),
        mutedUntil: z.string().nullable(),
        mutedForever: z.boolean(),
      }),
      "GET",
      undefined,
      signal,
    ),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    request("/api/notifications/push", z.undefined(), "PUT", subscription),
  dismissNotificationPrompt: () =>
    request("/api/notifications/push/prompt-dismissal", z.undefined(), "PUT"),
  setNotificationContentHidden: (hideContent: boolean) =>
    request("/api/notifications/previews", z.undefined(), "PATCH", { hideContent }),
  mutePush: (endpoint: string, duration: "1h" | "8h" | "forever" | "off") =>
    request(
      "/api/notifications/push/mute",
      z.object({
        mutedUntil: z.string().nullable(),
        mutedForever: z.boolean(),
      }),
      "PATCH",
      { endpoint, duration },
    ),
  unsubscribePush: (endpoint: string) =>
    request("/api/notifications/push", z.undefined(), "DELETE", { endpoint }),
  handleAvailability: (handle: string, signal?: AbortSignal) =>
    request(
      `/api/profiles/${encodeURIComponent(handle)}/availability`,
      z.object({ available: z.boolean() }),
      "GET",
      undefined,
      signal,
    ),
  updateProfile: (
    profile: Partial<
      Pick<Profile["profile"], "handle" | "displayName" | "bio" | "pronouns">
    >,
    signal?: AbortSignal,
  ) =>
    request(
      "/api/profiles/me",
      z.object({
        handle: z.string(),
        displayName: z.string(),
        bio: z.string(),
        pronouns: z.string().default(""),
      }),
      "PATCH",
      profile,
      signal,
    ),
  sessionOnce: (signal?: AbortSignal) =>
    sendRequest("/auth/me", sessionSchema, "GET", undefined,
      attemptSignal(5000, signal)),
  session: (signal?: AbortSignal) =>
    request("/auth/me", sessionSchema, "GET", undefined, signal),
  onboard: (handle: string, pronouns: string) =>
    request("/auth/profile", z.object({ user: userSchema }), "POST", {
      handle,
      pronouns,
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
  recentAvatars: (signal?: AbortSignal) =>
    request(
      "/api/avatars/recent",
      z.object({
        avatars: z.array(z.object({ id: z.string(), avatarUrl: z.string() })),
      }),
      "GET",
      undefined,
      signal,
    ),
  selectRecentAvatar: (id: string, signal?: AbortSignal) =>
    request(
      `/api/avatars/recent/${encodeURIComponent(id)}`,
      z.object({ avatarUrl: z.string() }),
      "POST",
      undefined,
      signal,
    ),
  removeRecentAvatar: (id: string, signal?: AbortSignal) =>
    request(
      `/api/avatars/recent/${encodeURIComponent(id)}`,
      z.undefined(),
      "DELETE",
      undefined,
      signal,
    ),
  logout: () => request("/auth/logout", z.undefined(), "POST"),
  posts: (
    cursor?: string,
    signal?: AbortSignal,
    topic?: string,
    search?: string,
  ) => {
    const query = new URLSearchParams();
    if (topic) query.set("topic", topic);
    if (search)
      for (const [key, value] of new URLSearchParams(search))
        query.set(key, value);
    if (cursor) query.set("cursor", cursor);
    return request(
      `/api/posts${query.size ? `?${query}` : ""}`,
      pageSchema,
      "GET",
      undefined,
      signal,
    );
  },
  search: (query: string, signal?: AbortSignal) =>
    request(
      `/api/search?q=${encodeURIComponent(query)}`,
      z.object({
        users: z.array(searchUserSchema),
        topics: z.array(topicCountSchema),
        moreUsers: z.boolean(),
        moreTopics: z.boolean(),
      }),
      "GET",
      undefined,
      signal,
    ),
  searchUsers: (query: string, cursor?: string, signal?: AbortSignal) =>
    request(
      `/api/search?type=users&q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      z.object({
        users: z.array(searchUserSchema),
        nextCursor: z.string().nullable(),
      }),
      "GET",
      undefined,
      signal,
    ),
  searchTopics: (query: string, cursor?: string, signal?: AbortSignal) =>
    request(
      `/api/search?type=topics&q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      z.object({
        topics: z.array(topicCountSchema),
        nextCursor: z.string().nullable(),
      }),
      "GET",
      undefined,
      signal,
    ),
  /** The most used topics of the last 24 hours. */
  trendingTopics: (signal?: AbortSignal) =>
    request(
      "/api/topics",
      z.object({
        topics: z.array(topicCountSchema),
        windowHours: z.number(),
      }),
      "GET",
      undefined,
      signal,
    ),
  /** Existing topics starting with a prefix, for autocomplete. */
  suggestTopics: (prefix: string, signal?: AbortSignal) =>
    request(
      `/api/topics?prefix=${encodeURIComponent(prefix)}`,
      z.object({ topics: z.array(topicCountSchema) }),
      "GET",
      undefined,
      signal,
    ),
  topic: (name: string, signal?: AbortSignal) =>
    request(
      `/api/topics/${encodeURIComponent(name)}`,
      z.object({ topic: z.object({ name: z.string(), posts: z.number() }) }),
      "GET",
      undefined,
      signal,
    ),
  post: (id: string, signal?: AbortSignal) =>
    request(postPath(id), postResponseSchema, "GET", undefined, signal),
  postPreview: (id: string, signal: AbortSignal) =>
    sendRequest(postPath(id), postResponseSchema, "GET", undefined, signal),
  websitePreviews: (id: string, offset: number, signal: AbortSignal) =>
    sendRequest(
      `${postPath(id)}/link-previews${offset ? `?offset=${offset}` : ""}`,
      websitePreviewsSchema,
      "GET",
      undefined,
      signal,
    ),
  websitePreviewImage: (id: string, key: string) =>
    `${postPath(id)}/link-preview-image/${encodeURIComponent(key)}`,
  websitePreviewIcon: (id: string, key: string) =>
    `${postPath(id)}/link-preview-icon/${encodeURIComponent(key)}`,
  thread: (id: string, signal?: AbortSignal) =>
    request(`${postPath(id)}/thread`, threadSchema, "GET", undefined, signal),
  postEdits: (id: string, signal?: AbortSignal) =>
    request(
      `${postPath(id)}/edits`,
      z.object({
        versions: z.array(z.object({ content: z.string(), at: z.string() })),
      }),
      "GET",
      undefined,
      signal,
    ),
  postActivity: (
    id: string,
    type: "likes" | "reposts" | "quotes" | "voters",
    {
      cursor,
      signal,
      options,
    }: { cursor?: string; signal?: AbortSignal; options?: readonly number[] },
  ) => {
    const params = new URLSearchParams();
    if (type !== "voters") params.set("type", type);
    if (type === "voters") {
      for (const option of options ?? [])
        params.append("option", String(option));
    }
    if (cursor) params.set("cursor", cursor);
    const path = type === "voters" ? "poll/voters" : "activity";
    return request(
      `${postPath(id)}/${path}${params.size ? `?${params}` : ""}`,
      z.object({
        users: z.array(activityUserSchema),
        nextCursor: z.string().nullable(),
      }),
      "GET",
      undefined,
      signal,
    );
  },
  mentionSuggestions: (query: string, signal?: AbortSignal) =>
    request(
      `/api/profiles/suggestions?q=${encodeURIComponent(query)}`,
      z.object({ users: z.array(userSchema).max(3) }),
      "GET",
      undefined,
      signal,
    ),
  uploadVoice: (audio: Blob, id: string) =>
    sendRequest("/api/voices", voiceJobSchema, "POST", audio, AbortSignal.timeout(25_000), {
      "Idempotency-Key": id,
    }),
  voiceJob: async (id: string, signal: AbortSignal) => {
    try {
      return await sendRequest(`/api/voices/jobs/${id}`, voiceJobSchema, "GET", undefined,
        attemptSignal(10_000, signal));
    } catch (error) {
      // A replica from the previous release may still be draining.
      if (error instanceof ApiError && error.status === 404 && error.message === "route_not_found")
        throw new ApiError(503, "voice_processing_unavailable", error.endpoint);
      throw error;
    }
  },
  cancelVoiceJob: (id: string, signal?: AbortSignal) =>
    request(`/api/voices/jobs/${id}`, z.undefined(), "DELETE", undefined, attemptSignal(10_000, signal)),
  discardVoice: (token: string, signal?: AbortSignal) =>
    request("/api/voices", z.undefined(), "DELETE", { token }, attemptSignal(10_000, signal)),
  publish: (
    content: string,
    clientId?: string,
    gifToken?: string,
    poll?: PollDraft,
    quotedPostId?: string,
    voiceToken?: string,
    attachmentIds?: string[],
  ) =>
    request("/api/posts", postResponseSchema, "POST", {
      content,
      clientId,
      gifToken,
      voiceToken,
      attachmentIds,
      poll,
      quotedPostId,
    }, voiceToken ? AbortSignal.timeout(15_000) : undefined),
  replies: (id: string, cursor?: string, signal?: AbortSignal) =>
    request(
      `${postPath(id)}/replies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      pageSchema,
      "GET",
      undefined,
      signal,
    ),
  reply: (
    id: string,
    content: string,
    clientId?: string,
    gifToken?: string,
    poll?: PollDraft,
    voiceToken?: string,
    attachmentIds?: string[],
  ) =>
    request(`${postPath(id)}/replies`, postResponseSchema, "POST", {
      content,
      clientId,
      gifToken,
      voiceToken,
      attachmentIds,
      poll,
    }, voiceToken ? AbortSignal.timeout(15_000) : undefined),
  vote: (id: string, optionIndex: number) =>
    request(
      `${postPath(id)}/poll/vote`,
      z.object({ poll: pollSchema }),
      "PUT",
      { optionIndex },
    ),
  postStates: (ids: string[], signal: AbortSignal) =>
    sendRequest(
      `/api/posts/states?ids=${encodeURIComponent(ids.join(","))}`,
      z.object({
        viewerId: z.string().nullable(),
        posts: z.array(postSchema),
        hiddenIds: z.array(z.string()).default([]),
      }),
      "GET",
      undefined,
      signal,
    ),
  pollResults: (ids: string[], signal: AbortSignal) =>
    sendRequest(
      `/api/posts/poll-results?ids=${encodeURIComponent(ids.join(","))}`,
      z.object({
        viewerId: z.string().nullable(),
        results: z.array(z.object({ id: z.string(), poll: pollSchema })),
      }),
      "GET",
      undefined,
      signal,
    ),
  like: (id: string, liked: boolean) =>
    request(
      `${postPath(id)}/like`,
      z.object({ likes: z.number(), liked: z.boolean() }),
      liked ? "PUT" : "DELETE",
    ),
  repost: (
    id: string,
    reposted: boolean,
    audience: RepostAudience = "public",
  ) =>
    request(
      `${postPath(id)}/repost`,
      z.object({
        reposts: z.number(),
        reposted: z.boolean(),
        repostAudience: repostAudienceSchema.nullable(),
      }),
      reposted ? "PUT" : "DELETE",
      reposted ? { audience } : undefined,
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
  profileCard: (handle: string, signal?: AbortSignal) =>
    request(
      `/api/profiles/${encodeURIComponent(handle)}/card`,
      profileCardSchema,
      "GET",
      undefined,
      signal,
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
