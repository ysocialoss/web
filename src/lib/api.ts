import { z } from "zod/mini";
import { beginConnectionRetry } from "./connection-status";
import { navigationItemsSchema, type NavigationItem } from "./navigation-items";
import { feedContextHeader } from "@/features/feed/tracking/tracker";

export const bannerCropSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BannerCrop = z.infer<typeof bannerCropSchema>;
const paintStopSchema = z.object({
  color: z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/)),
  at: z.number().check(z.gte(0)).check(z.lte(1)),
});
export const paintDefinitionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("linear"),
    angle: z.number().check(z.gte(0)).check(z.lte(360)),
    interpolation: z.optional(z.literal("step")),
    stops: z.array(paintStopSchema).check(z.minLength(2)).check(z.maxLength(8)),
  }),
  z.object({
    kind: z.literal("radial"),
    shape: z.enum(["circle", "ellipse"]),
    stops: z.array(paintStopSchema).check(z.minLength(2)).check(z.maxLength(8)),
  }),
]);
export const paintSchema = z.object({
  id: z.string(),
  name: z.string(),
  definition: paintDefinitionSchema,
});
export type PaintDefinition = z.infer<typeof paintDefinitionSchema>;
export type Paint = z.infer<typeof paintSchema>;
// A paint that fails to parse falls back to the plain name instead of breaking the list.
const userPaintSchema = z.catch(z.nullable(paintSchema), null);
const eveStarSchema = z._default(z.catch(z.nullable(z.object({ year: z.number(), doors: z.number() })), null), null);
const adventCosmeticsSchema = z._default(z.array(z.object({ year: z.number(), day: z.number() })), []);
export const userSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.nullable(z.string()),
  paint: userPaintSchema,
  eveStar: eveStarSchema,
});
const catalogPaintSchema = z.extend(paintSchema, {
  isFree: z.boolean(),
  owned: z.boolean(),
});
export type CatalogPaint = z.infer<typeof catalogPaintSchema>;
const activityUserSchema = z.extend(userSchema, {
  optionLabel: z.optional(z.string()),
  // Quote activity: the quote post this person wrote.
  quoteId: z.optional(z.string()),
});
export const repostAudienceSchema = z.enum(["public", "friends"]);
export type RepostAudience = z.infer<typeof repostAudienceSchema>;
const postImageIdsSchema = z._default(z.array(z.uuid()), []);
/** The post embedded in a quote, one level deep. */
const quotedPostSchema = z.object({
  id: z.string(),
  content: z.string(),
  imageIds: postImageIdsSchema,
  gif: z._default(z.nullable(z
    .object({ url: z.string(), title: z.string() })), null),
  createdAt: z.string(),
  editedAt: z.nullable(z.string()),
  parentId: z.nullable(z.string()),
  pollTitle: z.nullable(z.string()),
  isQuote: z.boolean(),
  mentions: z._default(z
    .array(
      z.object({ id: z.string(), handle: z.string(), username: z.string() }),
    ), []),
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
  others: z.int().check(z.nonnegative()),
});
export type RepostContext = z.infer<typeof repostContextSchema>;
const repostedBySchema = z._default(z.record(z.string(), repostContextSchema), {});
const postGifSchema = z.object({ url: z.string(), title: z.string() });
const voiceSchema = z.object({
  url: z.string(), durationMs: z.int().check(z.gte(2000)).check(z.lte(120000)), bytes: z.int().check(z.positive()),
  waveform: z.optional(z.array(z.int().check(z.gte(0)).check(z.lte(100))).check(z.length(48))),
});
const voiceDraftSchema = z.extend(voiceSchema, { token: z.string() });
const voiceJobSchema = z.union([voiceDraftSchema, z.object({ pending: z.literal(true) })]);
export type VoiceDraft = z.infer<typeof voiceDraftSchema>;
export const pollDraftSchema = z.object({
  title: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(120)),
  options: z
    .array(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))).check(z.minLength(2)).check(z.maxLength(6)).check(z.refine((options) =>
        new Set(options.map((option) => option.toLowerCase())).size ===
        options.length)),
  anonymous: z.boolean(),
});
const pollSchema = z.extend(pollDraftSchema, {
  options: z.array(
    z.object({ label: z.string(), votes: z.int().check(z.nonnegative()) }),
  ),
  selectedOption: z.nullable(z.int().check(z.nonnegative())),
});
export type PollDraft = z.infer<typeof pollDraftSchema>;
export type Poll = z.infer<typeof pollSchema>;
const basePostSchema = z.object({
  mentions: z._default(z
    .array(
      z.object({ id: z.string(), handle: z.string(), username: z.string() }),
    ), []),
  id: z.string(),
  parentId: z.nullable(z.string()),
  content: z.string(),
  gif: z._default(z.nullable(postGifSchema), null),
  imageIds: postImageIdsSchema,
  voice: z._default(z.nullable(voiceSchema), null),
  poll: z._default(z.nullable(pollSchema), null),
  createdAt: z.string(),
  editedAt: z.nullable(z.string()),
  editExpiresAt: z.string(),
  author: userSchema,
  likes: z.number(),
  liked: z.boolean(),
  saved: z._default(z.boolean(), false),
  pinned: z._default(z.boolean(), false),
  replies: z.number(),
  reposts: z.number(),
  reposted: z.boolean(),
  // How the viewer reposted it, if they did.
  repostAudience: z._default(z.nullable(repostAudienceSchema), null),
  quotes: z._default(z.number(), 0),
  // The embedded post when this post is a quote.
  quote: z._default(z.nullable(quoteSchema), null),
  // Who this post answers, for replies shown outside their thread.
  replyTo: z._default(z.nullable(z
    .object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      paint: userPaintSchema,
      eveStar: eveStarSchema,
    })), null),
  // Mutual follows who liked this post: how many, and the first few.
  friendLikes: z._default(z.number(), 0),
  friendLikers: z._default(z.array(userSchema), []),
  // Normalized topics (#name) in the post or reply.
  topics: z._default(z.array(z.string()), []),
});
const postSchema = z.extend(basePostSchema, {
  // Topic pages only: the posts above a reply, root first.
  ancestors: z.optional(z.array(basePostSchema)),
  // Home and topic lists: the author's own first reply to this post.
  selfReply: z.optional(z.nullable(basePostSchema)),
});
const topicCountSchema = z.object({ name: z.string(), count: z.number() });
const searchUserSchema = z.extend(userSchema, {
  bio: z.string(),
  followerCount: z.number(),
});
const pageSchema = z.object({
  posts: z.array(postSchema),
  repostedBy: repostedBySchema,
  nextCursor: z.nullable(z.string()),
  serverNow: z.string(),
});
export const feedReasons = ["explore", "network", "following", "conversation", "social", "nearby", "popular", "recent", "topic", "control"] as const;
const placementSchema = z.object({
  requestId: z.string(),
  position: z.int(),
  reason: z._default(z.catch(z.enum(feedReasons), "recent"), "recent"),
});
export type FeedPlacement = z.infer<typeof placementSchema>;
export type FeedReason = (typeof feedReasons)[number];
const placementsSchema = z._default(z.record(z.string(), placementSchema), {});
const followingPageSchema = z.extend(pageSchema, {
  requestId: z._default(z.nullable(z.string()), null),
  placements: placementsSchema,
});
const rankedPageSchema = z.extend(pageSchema, {
  requestId: z._default(z.nullable(z.string()), null),
  placements: placementsSchema,
  caughtUp: z._default(z.boolean(), false),
  fallback: z._default(z.boolean(), false),
});
export type RankedPage = z.infer<typeof rankedPageSchema>;
const sliderValueSchema = z._default(z.int().check(z.gte(-2)).check(z.lte(2)), 0);
const feedPreferencesSchema = z.object({
  personalize: z.boolean(),
  chosen: z._default(z.boolean(), true),
  cleared: z.optional(z.number()),
  discovery: sliderValueSchema,
  freshness: sliderValueSchema,
  replies: sliderValueSchema,
});
export type FeedPreferences = z.infer<typeof feedPreferencesSchema>;
export type FeedSlider = "discovery" | "freshness" | "replies";
const feedFeedbackListSchema = z.object({
  snoozed: z.array(z.object({ id: z.string(), user: userSchema, expiresAt: z.nullable(z.string()) })),
  authors: z._default(z.array(z.object({ id: z.string(), user: userSchema, direction: z.number(), expiresAt: z.nullable(z.string()) })), []),
  topics: z.array(z.object({ id: z.string(), topic: z.string(), direction: z.number() })),
  posts: z.object({ interested: z.number(), notInterested: z.number() }),
  suggestedTopics: z._default(z.array(z.string()), []),
});
export type FeedFeedbackList = z.infer<typeof feedFeedbackListSchema>;
export type FeedFeedbackInput =
  | { kind: "post"; postId: string; direction: 1 | -1 }
  | { kind: "author"; authorId: string; direction: 1 | -1 }
  | { kind: "snooze"; authorId: string }
  | { kind: "topic"; topic: string; direction: 1 | -1 };
const feedFeedbackSavedSchema = z.object({ id: z.string(), direction: z.number(), expiresAt: z.nullable(z.string()) });
export const feedFactorKinds = [
  "following", "social", "conversation", "affinity", "topic", "popular", "recent", "network", "format", "explore", "control",
] as const;
export type FeedFactorKind = (typeof feedFactorKinds)[number];
const feedWhySchema = z.object({
  postId: z.string(),
  requestId: z.string(),
  reason: z.string(),
  explore: z.boolean(),
  factors: z.array(z.object({
    kind: z.catch(z.enum(feedFactorKinds), "recent"),
    strength: z.catch(z.enum(["low", "medium", "high"]), "low"),
  })),
  controls: z.object({
    author: z.nullable(z.enum(["more", "less"])),
    topics: z.array(z.object({ topic: z.string(), direction: z.enum(["more", "less"]) })),
    sliders: z.object({ discovery: z.number(), freshness: z.number(), replies: z.number() }),
  }),
});
export type FeedWhy = z.infer<typeof feedWhySchema>;
const postResponseSchema = z.object({
  post: postSchema,
  serverNow: z.string(),
});
const websiteLinkSchema = z.object({
  href: z.string(),
  title: z.string(),
  iconKey: z.optional(z
    .string().check(z.regex(/^[0-9a-f]{64}$/))),
});
const imagePreviewKeySchema = z.string().check(z.regex(/^[0-9a-f]{64}$/));
const pagePreviewSchema = z.extend(websiteLinkSchema, {
  kind: z._default(z.literal("website"), "website"),
  description: z.optional(z.string()),
  siteName: z.string(),
  imageKey: z.optional(imagePreviewKeySchema),
});
const websitePreviewSchema = z.union([
  pagePreviewSchema,
  z.extend(websiteLinkSchema, {
    kind: z.literal("image"),
    imageKey: imagePreviewKeySchema,
  }),
]);
const websitePreviewsSchema = z.object({
  links: z._default(z.array(websiteLinkSchema), []),
  previews: z.array(websitePreviewSchema),
  nextOffset: z.optional(z.int().check(z.nonnegative())),
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
    avatarUrl: z.nullable(z.string()),
    suggestedHandle: z.string(),
    suggestedDisplayName: z._default(z.string(), ""),
    termsVersion: z._default(z.string(), ""),
  }),
  z.object({
    authenticated: z.literal(true),
    needsOnboarding: z.literal(false),
    pendingApproval: z._default(z.boolean(), false),
    ban: z._default(z.nullable(z.object({
      at: z.iso.datetime(),
      reason: z.nullable(z.string()),
      by: z.nullable(z.string()),
      byProfileHandle: z._default(z.nullable(z.string()), null),
    })), null),
    user: z.extend(userSchema, {
      pronouns: z._default(z.string(), ""),
      bannerUrl: z.nullable(z.string()),
      bannerCrop: z.nullable(bannerCropSchema),
      navigation: navigationItemsSchema,
      feedPersonalize: z._default(z.boolean(), true),
      feedDiscovery: sliderValueSchema,
      feedFreshness: sliderValueSchema,
      feedReplies: sliderValueSchema,
      ageConfirmed: z._default(z.boolean(), false),
      namePaintsDisabled: z._default(z.boolean(), false),
      namePaintAnimationsDisabled: z._default(z.boolean(), false),
    }),
    avatarUrl: z.nullable(z.string()),
    suggestedHandle: z.string(),
    termsCurrent: z._default(z.nullable(z.boolean()), true),
    termsVersion: z._default(z.string(), ""),
    feedChoiceNeeded: z._default(z.boolean(), false),
  }),
]);
const githubAccountSchema = z.object({
  login: z.string().check(z.regex(/^[a-z\d][a-z\d_-]{0,99}$/i)),
  contributionCount: z.nullable(z.int().check(z.nonnegative())),
});
const githubSettingsSchema = z.object({
  configured: z.boolean(),
  github: z.nullable(z.extend(githubAccountSchema, { displayOnProfile: z._default(z.boolean(), true) })),
});
const connectionProviderSchema = z.enum(["discord", "twitch", "steam", "spotify", "apple_music"]);
const linkedAccountSchema = z.object({
  provider: connectionProviderSchema,
  username: z.string(),
  displayName: z.string(),
  profileUrl: z.url(),
  displayOnProfile: z._default(z.boolean(), true),
});
export type ConnectionProviderName = z.infer<typeof connectionProviderSchema>;
const profileReplySchema = z.object({ post: postSchema, thread: z.array(postSchema) });
const profileSchema = z.object({
  profile: z.extend(userSchema, {
    isOg: z._default(z.boolean(), false),
    github: z._default(z.nullable(githubAccountSchema), null),
    connections: z._default(z.array(z.object({
      provider: connectionProviderSchema,
      username: z.string(),
      displayName: z.string(),
      profileUrl: z.url(),
    })), []),
    domains: z._default(z.array(z.string()), []),
    badges: z._default(z.array(z.object({
      id: z.uuid(),
      icon: z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
      tooltip: z.string(),
    })), []),
    cosmetics: adventCosmeticsSchema,
    bio: z.string(),
    pronouns: z._default(z.string(), ""),
    bannerUrl: z.nullable(z.string()),
    bannerCrop: z.nullable(bannerCropSchema),
    createdAt: z.string(),
    banReason: z._default(z.nullable(z.string()), null),
    bannedAt: z._default(z.nullable(z.iso.datetime()), null),
    bannedBy: z._default(z.nullable(z.string()), null),
    bannedByProfileHandle: z._default(z.nullable(z.string()), null),
    followerCount: z.int().check(z.nonnegative()),
    followingCount: z.int().check(z.nonnegative()),
    postCount: z.optional(z.int().check(z.nonnegative())),
  }),
  isFollowing: z.boolean(),
  isFollowedBy: z.boolean(),
  blocking: z._default(z.boolean(), false),
  blockedBy: z._default(z.boolean(), false),
  posts: z.array(postSchema),
  pinnedPost: z._default(z.nullable(postSchema), null),
  // Plain reposts and the person's own quote posts, newest first.
  reposts: z.array(postSchema),
  repostedBy: repostedBySchema,
  replies: z.array(profileReplySchema),
  nextCursors: z._default(z.object({
    posts: z.nullable(z.string()),
    replies: z.nullable(z.string()),
    reposts: z.nullable(z.string()),
  }), { posts: null, replies: null, reposts: null }),
  serverNow: z.string(),
});
const profileTimelineSchema = z.object({
  posts: z.array(postSchema),
  replies: z.array(profileReplySchema),
  reposts: z.array(postSchema),
  repostedBy: repostedBySchema,
  nextCursor: z.nullable(z.string()),
});
export type ProfileTab = "posts" | "replies" | "reposts";
export type ProfileTimelinePage = z.infer<typeof profileTimelineSchema>;
const domainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  verified: z.boolean(),
  displayOnProfile: z._default(z.boolean(), true),
  record: z.nullable(z.object({ type: z.literal("TXT"), host: z.string(), name: z.string(), value: z.string() })),
});
export type OwnedDomain = z.infer<typeof domainSchema>;
const profileCardSchema = z.object({
  profile: z.extend(userSchema, {
    cosmetics: adventCosmeticsSchema,
    bio: z.string(),
    pronouns: z._default(z.string(), ""),
    bannerUrl: z.nullable(z.string()),
    bannerCrop: z.nullable(bannerCropSchema),
    createdAt: z.string(),
    followerCount: z.int().check(z.nonnegative()),
    followingCount: z.int().check(z.nonnegative()),
    postCount: z.int().check(z.nonnegative()),
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
const socialNotificationKind = z.enum([
  "like", "repost", "friends_repost", "reply", "follow", "friend", "mention", "quote",
]);
const notificationPreferenceKind = z.enum([...socialNotificationKind.options, "dm_message", "dm_invite"]);
const notificationPreferences = z.object({ mutedKinds: z.array(notificationPreferenceKind) });
export type NotificationPreferenceKind = z.infer<typeof notificationPreferenceKind>;

const notificationSchema = z.object({
  id: z.string(),
  kind: socialNotificationKind,
  actor: userSchema,
  postId: z.nullable(z.string()),
  conversationId: z.nullish(z.uuid()),
  preview: z.nullable(z.string()),
  chatPreview: z.optional(z.boolean()),
  imageIds: z._default(z.array(z.string()), []),
  createdAt: z.string(),
  readAt: z.nullable(z.string()),
});
export type SocialNotification = z.infer<typeof notificationSchema>;
const connectionUserSchema = z.extend(userSchema, {
  bio: z.string(),
  isSelf: z.boolean(),
  isFollowing: z.boolean(),
});
export type ConnectionUser = z.infer<typeof connectionUserSchema>;
export const reportReasons = [
  "spam", "harassment", "hate", "violence", "sexual", "self_harm", "misinformation", "impersonation", "ai_generated", "illegal", "other",
] as const;
export type ReportReason = (typeof reportReasons)[number];
export type ReportTarget =
  | { type: "post"; id: string }
  | { type: "user"; id: string }
  | { type: "message"; conversationId: string; messageId: string; messages: { id: string; text: string }[] };
export const legalCategories = [
  "child_sexual_abuse", "terrorism", "threats", "incitement", "insult_defamation", "unconstitutional_symbols",
  "privacy_violation", "intellectual_property", "fraud", "youth_protection", "other",
] as const;
export type LegalCategory = (typeof legalCategories)[number];
export const illegalDetailsMin = 30;
export type ReportInput = {
  reason: ReportReason;
  details: string;
  target: ReportTarget;
  legalGround?: LegalCategory;
  goodFaith?: true;
};
export type PublicReportInput = {
  url: string;
  reason: ReportReason;
  legalGround?: LegalCategory;
  details: string;
  name?: string;
  email?: string;
  goodFaith: true;
};
const operatorSchema = z.object({
  name: z.string(),
  address: z.array(z.string()),
  email: z.string(),
  hashMatching: z._default(z.boolean(), false),
  contacts: z.object({ privacy: z.nullable(z.string()), abuse: z.nullable(z.string()) }),
});
export type Operator = z.infer<typeof operatorSchema>;
const appealSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  status: z.enum(["open", "upheld", "reversed"]),
  staffNote: z.nullable(z.string()),
  resolvedAt: z.nullable(z.string()),
  createdAt: z.string(),
  seenAt: z.optional(z.nullable(z.string())),
});
const decisionSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  targetType: z.enum(["post", "user", "message"]),
  targetKey: z.nullable(z.string()),
  excerpt: z.string(),
  groundType: z.enum(["illegal", "terms"]),
  groundRef: z.string(),
  facts: z.string(),
  automatedDetection: z.boolean(),
  automatedDecision: z.boolean(),
  fromReport: z.boolean(),
  seenAt: z.nullable(z.string()),
  reversedAt: z.nullable(z.string()),
  createdAt: z.string(),
  appeal: z.nullable(appealSchema),
  appealDeadline: z.string(),
  canAppeal: z.boolean(),
});
export type ModerationDecision = z.infer<typeof decisionSchema>;
const reportUpdateSchema = z.object({
  id: z.uuid(),
  targetType: z.enum(["post", "user", "message"]),
  targetHandle: z.string(),
  reason: z.string(),
  status: z.enum(["open", "resolved", "dismissed"]),
  actionTaken: z.boolean(),
  resolvedAt: z.nullable(z.string()),
  seenAt: z.nullable(z.string()),
  createdAt: z.string(),
});
export type ReportUpdate = z.infer<typeof reportUpdateSchema>;
const noticesSchema = z.object({
  decisions: z.array(decisionSchema),
  reportUpdates: z.array(reportUpdateSchema),
  unseen: z.number(),
});
export type ModerationNotices = z.infer<typeof noticesSchema>;
const reportStatusSchema = z.object({
  reference: z.uuid(),
  targetType: z.enum(["post", "user", "message"]),
  reason: z.string(),
  status: z.enum(["open", "resolved", "dismissed"]),
  actionTaken: z.boolean(),
  resolvedAt: z.nullable(z.string()),
  receivedAt: z.string(),
});
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export function gifMediaUrl<T extends string | null | undefined>(url: T): T {
  if (!url) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) return url;
    if (!/^static\d*\.klipy\.com$/.test(parsed.hostname)) return url;
    return `/api/gifs/media?u=${encodeURIComponent(parsed.href)}` as T;
  } catch {
    return url;
  }
}
export async function downloadDataExport() {
  const response = await fetch("/api/me/export", { credentials: "same-origin", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(await response.json().catch(() => null));
    throw new ApiError(response.status, parsed.success ? parsed.data.error : "unexpected_response", "GET /api/me/export");
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "ysocial-export.zip";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
const notificationsSchema = z.object({
  notifications: z.array(notificationSchema),
  hideContent: z.optional(z.boolean()),
  unreadCount: z.number(),
  nextCursor: z.nullable(z.string()),
});

export type MuteDuration = "1h" | "8h" | "24h" | "1w" | "forever" | "off";

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
  invalid_paint: 3005,
  paint_not_found: 3006,
  paint_not_owned: 3007,
  invalid_advent_door: 3008,
  advent_door_closed: 3009,
  advent_reward_not_found: 3010,
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
  invalid_feed_events: 4010,
  invalid_feed_preferences: 4011,
  feed_personalization_required: 4012,
  invalid_feed_config: 4013,
  invalid_feed_feedback: 4014,
  feed_explanation_unavailable: 4015,
  feed_feedback_not_found: 4016,
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
  invalid_report: 8001,
  own_content: 8002,
  report_rate_limited: 8003,
  invalid_contact_message: 8005,
  contact_rate_limited: 8006,
  blocked: 8004,
  invalid_pin: 2013,
  invalid_connection: 9101,
  invalid_profile_link: 9102,
  connection_already_connected: 9103,
  invalid_domain: 9104,
  domain_taken: 9105,
  domain_exists: 9106,
  domain_limit: 9107,
  domain_record_missing: 9108,
  domain_not_found: 9109,
  domain_connect_unsupported: 9110,
  domain_connect_unavailable: 9111,
  domain_already_verified: 9112,
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
    if (error.message === "paint_not_owned")
      return "You do not own this paint.";
    if (error.message === "paint_not_found" || error.message === "invalid_paint")
      return "This paint is no longer available.";
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
    if (error.message === "invalid_pin")
      return "Only your own top-level posts can be pinned. Replies can't.";
    if (error.message === "invalid_profile_link")
      return "That isn't a profile link we recognise. Paste the link to your profile page.";
    if (error.message === "connection_already_connected")
      return "This account is already connected. Disconnect it first to change it.";
    if (error.message === "invalid_domain")
      return "Enter a domain you own, such as example.com.";
    if (error.message === "domain_taken")
      return "Another account has already verified this domain.";
    if (error.message === "domain_exists") return "You already added this domain.";
    if (error.message === "domain_limit") return "You can connect up to 10 domains.";
    if (error.message === "domain_not_found") return "This domain is no longer in your list.";
    if (error.message === "domain_record_missing")
      return "We couldn't find the TXT record yet. DNS changes can take a few minutes to appear.";
    if (error.message === "domain_connect_unsupported")
      return "Your DNS provider doesn't offer one-click setup for ysocial. Add the TXT record by hand instead.";
    if (error.message === "domain_connect_unavailable")
      return "Your DNS provider didn't answer. Try again, or add the TXT record by hand.";
    if (error.message === "invalid_poll_option")
      return "Choose an option from this poll.";
    if (error.message === "invalid_topic") return "This isn't a valid topic.";
    if (error.message === "invalid_search")
      return "This search isn't valid. Try something shorter.";
    if (error.message === "invalid_confirmation")
      return "That doesn't match your handle.";
    if (error.message === "protected_account")
      return "This account can't be deleted here. Ask another admin to remove it.";
    if (error.message === "retry_account_changed")
      return "Sign in to the original account before retrying this action.";
    if (error.message === "blocked")
      return "You can't interact with this account because one of you blocked the other.";
    if (error.message === "own_content")
      return "You can't report your own content.";
    if (error.message === "report_rate_limited")
      return "You've sent a lot of reports recently. Try again in a few minutes.";
    if (error.message === "contact_rate_limited")
      return "You've sent several messages recently. Try again in a few minutes.";
    if (error.message === "invalid_contact_message")
      return "Write a message of at least 10 characters. If you add an email address, check that it is valid.";
    if (error.message === "illegal_notice_incomplete")
      return `Explain why the content is illegal (at least ${illegalDetailsMin} characters) and confirm the statement.`;
    if (error.message === "notifier_contact_required")
      return "Add your name and email address. They are only optional for reports of child sexual abuse material.";
    if (error.message === "invalid_report_url")
      return "Paste a link to a ysocial post or profile.";
    if (error.message === "export_rate_limited")
      return "You requested an export recently. Try again in 15 minutes.";
    if (error.message === "already_appealed")
      return "You already appealed this decision.";
    if (error.message === "appeal_window_closed")
      return "The six month appeal window for this decision has closed.";
    if (error.message === "terms_required")
      return "Confirm your age and accept the terms to continue.";
    if (error.message === "upload_rejected")
      return "This file can't be uploaded.";
    if (error.message === "safety_check_unavailable")
      return "Uploads are paused for a moment. Try again shortly.";
    if (error.message === "dm_message_not_found")
      return "This message is no longer available.";
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
  if (error instanceof z.core.$ZodError)
    return "We got an unexpected answer from the server. Please try again.";
  return "Something went wrong. Please try again.";
}
/** User-facing text for any failure, ending in a trace code developers can search for. */
export function errorMessage(error: unknown) {
  const message = friendlyMessage(error);
  const code =
    error instanceof ApiError
      ? error.traceCode
      : error instanceof z.core.$ZodError
        ? "YS-0002"
        : "YS-0003";
  return `${message} (${code})`;
}
export async function sendRequest<T>(
  path: string,
  schema: z.ZodMiniType<T>,
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
  schema: z.ZodMiniType<T>,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<T> {
  const send = () => sendRequest(path, schema, method, body, signal, headers);
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
const namePaintPreferencePaths = {
  namePaintsDisabled: "/auth/name-paints",
  namePaintAnimationsDisabled: "/auth/name-paint-animations",
};

export type NamePaintPreference = keyof typeof namePaintPreferencePaths;

export const api = {
  setNavigationItems: (userId: string, items: NavigationItem[] | null) =>
    request("/auth/navigation", z.undefined(), "PUT", { userId, items }, AbortSignal.timeout(10_000)),
  setNamePaintPreference: (userId: string, preference: NamePaintPreference, disabled: boolean) =>
    request(namePaintPreferencePaths[preference], z.undefined(), "PUT", { userId, disabled }, AbortSignal.timeout(10_000)),
  uploadPostImage: (file: File, signal: AbortSignal) =>
    sendRequest("/api/post-images", z.object({ id: z.uuid() }), "POST",
      file.slice(0, file.size, "application/octet-stream"), attemptSignal(45_000, signal), {
        "X-Post-Image-Name": encodeURIComponent(Array.from(file.name).slice(0, 255).join("")),
      }),
  discardPostImage: (id: string) =>
    sendRequest(postImageUrl(id), z.undefined(), "DELETE", undefined, AbortSignal.timeout(10_000)),
  githubSettings: (signal: AbortSignal) =>
    request("/api/github", githubSettingsSchema, "GET", undefined, signal),
  connectGithub: (returnTo?: "profile" | "settings") => request("/api/github/connect", z.object({
    url: z.url().check(z.refine((value) => {
      const url = new URL(value);
      return url.origin === "https://github.com" && url.pathname === "/login/oauth/authorize";
    })),
  }), "POST", returnTo ? { returnTo } : undefined),
  twitchLive: (handles: string[], signal?: AbortSignal) =>
    request(
      `/api/connections/twitch/live?handles=${encodeURIComponent(handles.join(","))}`,
      z.object({ live: z.record(z.string(), z.object({ login: z.string() })) }),
      "GET",
      undefined,
      signal,
    ),
  linkedAccounts: (signal?: AbortSignal) =>
    request("/api/connections", z.object({
      providers: z.array(z.object({
        provider: connectionProviderSchema,
        configured: z.boolean(),
        connection: z.nullable(linkedAccountSchema),
      })),
    }), "GET", undefined, signal),
  connectProvider: (provider: string, returnTo: "profile" | "settings") =>
    request(`/api/connections/${provider}/connect`, z.object({
      url: z.url().check(z.refine((value) => new URL(value).protocol === "https:")),
    }), "POST", { returnTo }),
  disconnectProvider: (provider: string) =>
    request(`/api/connections/${provider}`, z.undefined(), "DELETE"),
  setProviderVisibility: (provider: ConnectionProviderName, displayOnProfile: boolean) =>
    request(`/api/connections/${provider}`, z.object({ connection: linkedAccountSchema }), "PATCH", { displayOnProfile }),
  linkProvider: (provider: string, url: string) =>
    request(`/api/connections/${provider}/link`, z.object({
      connection: linkedAccountSchema,
    }), "POST", { url }),
  domains: (signal?: AbortSignal) =>
    request("/api/domains", z.object({ domains: z.array(domainSchema), max: z.number() }), "GET", undefined, signal),
  addDomain: (domain: string) =>
    request("/api/domains", z.object({ domain: domainSchema }), "POST", { domain }),
  verifyDomain: (id: string) =>
    request(`/api/domains/${encodeURIComponent(id)}/verify`, z.object({ domain: domainSchema }), "POST"),
  removeDomain: (id: string) =>
    request(`/api/domains/${encodeURIComponent(id)}`, z.undefined(), "DELETE"),
  setDomainVisibility: (id: string, displayOnProfile: boolean) =>
    request(`/api/domains/${encodeURIComponent(id)}`, z.object({ domain: domainSchema }), "PATCH", { displayOnProfile }),
  domainConnect: (id: string) =>
    request(`/api/domains/${encodeURIComponent(id)}/domain-connect`, z.object({
      url: z.url().check(z.refine((value) => new URL(value).protocol === "https:")),
      provider: z.nullable(z.string()),
    }), "POST"),
  disconnectGithub: () => request("/api/github", z.undefined(), "DELETE"),
  setGithubVisibility: (displayOnProfile: boolean) =>
    request("/api/github", z.pick(githubSettingsSchema, { github: true }), "PATCH", { displayOnProfile }),
  pronounRecommendations: (signal: AbortSignal) =>
    request(
      "/api/profiles/pronouns/recommendations",
      z.object({
        languages: z.record(z.string(), z.array(z.string())),
        general: z.array(z.string()),
        maxLength: z.int().check(z.positive()),
      }),
      "GET",
      undefined,
      signal,
    ),
  notifications: (cursor?: string, unread = false, signal?: AbortSignal) =>
    request(
      `/api/notifications?unread=${unread}&extendedKinds=true${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
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
        publicKey: z.nullable(z.string()),
        subscribed: z.boolean(),
        promptDismissed: z.boolean(),
        hideContent: z._default(z.boolean(), false),
        mutedUntil: z.nullable(z.string()),
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
  notificationPreferences: (signal: AbortSignal) =>
    request("/api/notifications/preferences", notificationPreferences, "GET", undefined, signal),
  setNotificationPreference: (kind: NotificationPreferenceKind, enabled: boolean) =>
    request("/api/notifications/preferences", notificationPreferences, "PATCH", { kind, enabled }),
  mutePush: (endpoint: string, duration: MuteDuration) =>
    request(
      "/api/notifications/push/mute",
      z.object({
        mutedUntil: z.nullable(z.string()),
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
        pronouns: z._default(z.string(), ""),
      }),
      "PATCH",
      profile,
      signal,
    ),
  deleteAccount: (handle: string) =>
    request("/api/profiles/me", z.undefined(), "DELETE", { handle }),
  sessionOnce: (signal?: AbortSignal) =>
    sendRequest("/auth/me", sessionSchema, "GET", undefined,
      attemptSignal(5000, signal)),
  session: (signal?: AbortSignal) =>
    request("/auth/me", sessionSchema, "GET", undefined, signal),
  onboard: (handle: string, pronouns: string, displayName: string) =>
    request("/auth/profile", z.object({ user: userSchema }), "POST", {
      handle,
      pronouns,
      displayName,
      acceptTerms: true,
      ageConfirmed: true,
    }),
  acceptTerms: (version: string, confirmAge: boolean) =>
    request("/auth/terms", z.undefined(), "POST", confirmAge ? { version, acceptTerms: true, ageConfirmed: true } : { version, acceptTerms: true }, AbortSignal.timeout(10_000)),
  operator: (signal?: AbortSignal) => sendRequest("/api/legal/operator", operatorSchema, "GET", undefined, attemptSignal(10_000, signal)),
  moderationNotices: (signal?: AbortSignal) => request("/api/moderation/notices", noticesSchema, "GET", undefined, signal),
  markNoticesSeen: () => request("/api/moderation/notices/seen", z.undefined(), "POST", undefined, AbortSignal.timeout(10_000)),
  moderationDecision: (id: string, signal?: AbortSignal) =>
    request(`/api/moderation/decisions/${encodeURIComponent(id)}`, decisionSchema, "GET", undefined, signal),
  appealDecision: (id: string, text: string) =>
    request(`/api/moderation/decisions/${encodeURIComponent(id)}/appeal`, z.object({ id: z.uuid() }), "POST", { text }, AbortSignal.timeout(10_000)),
  sendContact: (input: { name?: string; email?: string; message: string; website?: string }) =>
    request("/api/contact", z.undefined(), "POST", input, AbortSignal.timeout(15_000)),
  publicReport: (input: PublicReportInput) =>
    request("/api/reports/public", z.object({ reference: z.uuid(), receivedAt: z.string(), statusToken: z.string() }), "POST", input, AbortSignal.timeout(15_000)),
  reportStatus: (token: string, signal?: AbortSignal) =>
    request(`/api/reports/status/${encodeURIComponent(token)}`, reportStatusSchema, "GET", undefined, signal),
  searchGifs: (query: string, page = 1, signal?: AbortSignal) =>
    request(
      "/api/banners/gifs/search",
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            previewUrl: z.string(),
            width: z.optional(z.number()),
            height: z.optional(z.number()),
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
  following: (cursor?: string, signal?: AbortSignal) =>
    request(
      `/api/feed/following${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      followingPageSchema,
      "GET",
      undefined,
      signal,
    ),
  forYou: (cursor?: string, signal?: AbortSignal) =>
    request(
      `/api/feed/for-you${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      rankedPageSchema,
      "GET",
      undefined,
      signal,
    ),
  feedPreferences: (signal?: AbortSignal) =>
    request("/api/feed/preferences", feedPreferencesSchema, "GET", undefined, signal),
  setFeedPreferences: (personalize: boolean, source?: "nav") =>
    request("/api/feed/preferences", feedPreferencesSchema, "PATCH", source ? { personalize, source } : { personalize }, AbortSignal.timeout(10_000)),
  setFeedSliders: (values: Partial<Record<FeedSlider, number>>) =>
    request("/api/feed/preferences", feedPreferencesSchema, "PATCH", values, AbortSignal.timeout(10_000)),
  feedFeedback: (signal?: AbortSignal) =>
    request("/api/feed/feedback", feedFeedbackListSchema, "GET", undefined, signal),
  addFeedFeedback: (input: FeedFeedbackInput, contextPostId?: string) =>
    request(
      "/api/feed/feedback",
      feedFeedbackSavedSchema,
      "POST",
      input,
      AbortSignal.timeout(10_000),
      contextPostId ? feedContextHeader(contextPostId) : input.kind === "post" ? feedContextHeader(input.postId) : undefined,
    ),
  removeFeedFeedback: (id: string) =>
    request(`/api/feed/feedback/${encodeURIComponent(id)}`, z.undefined(), "DELETE", undefined, AbortSignal.timeout(10_000)),
  clearFeedFeedback: (kind: "post" | "author" | "snooze" | "topic") =>
    request(`/api/feed/feedback?kind=${kind}`, z.object({ removed: z.number() }), "DELETE", undefined, AbortSignal.timeout(10_000)),
  feedWhy: (postId: string, requestId: string, signal?: AbortSignal) =>
    request(`/api/feed/why/${encodeURIComponent(postId)}?request=${encodeURIComponent(requestId)}`, feedWhySchema, "GET", undefined, signal),
  feedChoiceDeclined: () =>
    request("/api/feed/choice-declined", z.undefined(), "POST", undefined, AbortSignal.timeout(10_000)),
  clearFeedActivity: () =>
    request("/api/feed/reset", z.object({ cleared: z.number() }), "POST", undefined, AbortSignal.timeout(15_000)),
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
        nextCursor: z.nullable(z.string()),
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
        nextCursor: z.nullable(z.string()),
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
        nextCursor: z.nullable(z.string()),
      }),
      "GET",
      undefined,
      signal,
    );
  },
  mentionSuggestions: (query: string, signal?: AbortSignal) =>
    request(
      `/api/profiles/suggestions?q=${encodeURIComponent(query)}`,
      z.object({ users: z.array(userSchema).check(z.maxLength(3)) }),
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
    }, voiceToken ? AbortSignal.timeout(15_000) : undefined, quotedPostId ? feedContextHeader(quotedPostId) : undefined),
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
    }, voiceToken ? AbortSignal.timeout(15_000) : undefined, feedContextHeader(id)),
  vote: (id: string, optionIndex: number) =>
    request(
      `${postPath(id)}/poll/vote`,
      z.object({ poll: pollSchema }),
      "PUT",
      { optionIndex },
      undefined,
      feedContextHeader(id),
    ),
  postStates: (ids: string[], signal: AbortSignal) =>
    sendRequest(
      `/api/posts/states?ids=${encodeURIComponent(ids.join(","))}`,
      z.object({
        viewerId: z.nullable(z.string()),
        posts: z.array(postSchema),
        hiddenIds: z._default(z.array(z.string()), []),
      }),
      "GET",
      undefined,
      signal,
    ),
  pollResults: (ids: string[], signal: AbortSignal) =>
    sendRequest(
      `/api/posts/poll-results?ids=${encodeURIComponent(ids.join(","))}`,
      z.object({
        viewerId: z.nullable(z.string()),
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
      undefined,
      undefined,
      feedContextHeader(id),
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
        repostAudience: z.nullable(repostAudienceSchema),
      }),
      reposted ? "PUT" : "DELETE",
      reposted ? { audience } : undefined,
      undefined,
      feedContextHeader(id),
    ),
  save: (id: string, saved: boolean) =>
    request(`${postPath(id)}/save`, z.object({ saved: z.boolean() }), saved ? "PUT" : "DELETE", undefined, undefined, feedContextHeader(id)),
  pin: (id: string, pinned: boolean) =>
    request(
      `${postPath(id)}/pin`,
      z.object({ pinned: z.boolean(), previousPinnedId: z.nullable(z.string()) }),
      pinned ? "PUT" : "DELETE",
    ),
  savedPosts: (cursor?: string, signal?: AbortSignal) =>
    request(
      `/api/posts/saved${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      pageSchema,
      "GET",
      undefined,
      signal,
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
        followerCount: z.int().check(z.nonnegative()),
      }),
      following ? "PUT" : "DELETE",
    ),
  connections: (
    handle: string,
    list: "followers" | "following",
    { cursor, signal }: { cursor?: string; signal?: AbortSignal },
  ) =>
    request(
      `/api/profiles/${encodeURIComponent(handle)}/${list}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      z.object({ users: z.array(connectionUserSchema), nextCursor: z.nullable(z.string()) }),
      "GET",
      undefined,
      signal,
    ),
  blocks: (signal?: AbortSignal) =>
    request(
      "/api/blocks",
      z.object({ users: z.array(z.extend(userSchema, { blockedAt: z.string() })) }),
      "GET",
      undefined,
      signal,
    ),
  block: (handle: string, blocked: boolean) =>
    request(
      `/api/blocks/${encodeURIComponent(handle)}`,
      z.object({ blocking: z.boolean() }),
      blocked ? "PUT" : "DELETE",
    ),
  report: (input: ReportInput) =>
    request(
      "/api/reports",
      z.object({ status: z.enum(["reported", "already_reported"]), reference: z.optional(z.nullable(z.string())) }),
      "POST",
      input,
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
  profileTimeline: (handle: string, tab: ProfileTab, cursor: string, signal?: AbortSignal) =>
    request(
      `/api/profiles/${encodeURIComponent(handle)}/timeline?tab=${tab}&cursor=${encodeURIComponent(cursor)}`,
      profileTimelineSchema,
      "GET",
      undefined,
      signal,
    ),
  paints: (signal?: AbortSignal) =>
    request(
      "/api/paints",
      z.object({
        paints: z.pipe(z
          .array(z.unknown()), z.transform((items) =>
            items.flatMap((item) => {
              const parsed = catalogPaintSchema.safeParse(item);
              return parsed.success ? [parsed.data] : [];
            }))),
      }),
      "GET",
      undefined,
      signal,
    ),
  setPaint: (paintId: string | null, signal?: AbortSignal) =>
    request(
      "/api/paints/me",
      z.object({ paintId: z.nullable(z.string()) }),
      "PUT",
      { paintId },
      signal,
    ),
};
