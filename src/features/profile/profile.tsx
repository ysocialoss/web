import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  api,
  errorMessage,
  type Post,
  type Profile,
  type Session,
  type BannerCrop,
  type Paint,
} from "@/lib/api";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Mail,
  SendHorizontal,
  ShieldCheck,
  Camera,
  Gem,
  GitPullRequest,
  Pencil,
  UserCheck,
  UserPlus,
  UsersRound,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { GithubMark } from "@/components/ui/github-mark";
import { providerById } from "@/features/settings/connection-providers";
import { ExternalLink } from "@/components/ui/external-link";
import { DomainIcon } from "./domain-icon";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useGoBack } from "@/hooks/use-go-back";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TwitchLive } from "./twitch-live";
import { BannerImage } from "./banner-image";
import { BannerEditor } from "./banner-editor";
import { EditProfileDialog, type ProfileEditTab } from "./profile-edit-dialog";
import { ProfilePictureDialog, verifyAccount } from "./profile-picture-dialog";
import { peekProfile, profileCacheKey, storeProfile } from "./profile-cache";
import { useSessionHint } from "@/features/auth/session-hint";
import { DisplayName } from "@/components/display-name";
import { PaintPicker } from "./paint-picker";
import { PostCard } from "@/features/feed/post-card";
import { useFeed } from "@/features/feed/use-feed";
import { ShareButton } from "@/features/sharing/share-button";
import { ReportMenu, copyLinkAction, type MenuAction } from "@/features/reports/report-menu";
import { setBlocked } from "@/features/reports/blocked-users";
import { toast } from "@/components/ui/toast-manager";
import { ConnectionsDialog, type ConnectionList } from "./connections-dialog";
import { ProfileSkeleton } from "@/components/loading-skeletons";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  getActionRevision,
  mutateFollow,
  projectRelationship,
  rememberProfile,
} from "@/features/feed/optimistic-actions";

function ProfileBadge({ label, tooltip, children }: {
  label: string;
  tooltip: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        type="button"
        aria-label={label}
        className="shrink-0 rounded p-1"
        closeOnClick={false}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent role="tooltip">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function orderPinned(posts: Post[]) {
  return [
    ...posts.filter((post) => post.pinned),
    ...posts
      .filter((post) => !post.pinned)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  ];
}

export function ProfilePage({
  handle,
  session,
  onAvatarSaved,
  onBannerSaved,
  onProfileSaved,
  onPaintSaved,
}: {
  handle: string;
  session: Session | null;
  onAvatarSaved: (userId: string, avatarUrl: string) => void;
  onProfileSaved: (
    userId: string,
    profile: Awaited<ReturnType<typeof api.updateProfile>>,
  ) => void;
  onBannerSaved: (
    userId: string,
    bannerUrl: string | null,
    bannerCrop: BannerCrop | null,
  ) => void;
  onPaintSaved: (userId: string, paint: Paint | null) => void;
}) {
  const hint = useSessionHint(session);
  const [loadedProfile, setProfile] = useState<Profile | null>(() => {
    const known =
      session?.authenticated && !session.needsOnboarding
        ? session.user.id
        : (hint?.id ?? null);
    return peekProfile(profileCacheKey(handle, known));
  });
  const [pictureDialogOpen, setPictureDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const hasGithubResult = searchParams.has("github") || searchParams.has("connection");
  const [editDialogOpen, setEditDialogOpen] = useState(hasGithubResult);
  const [editTab, setEditTab] = useState<ProfileEditTab>(hasGithubResult ? "connections" : "profile");
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"posts" | "replies" | "reposts">("posts");
  const viewer =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const viewerId = viewer?.id ?? null;
  const ownHandle = (viewer?.handle ?? hint?.handle)?.toLowerCase() === handle.toLowerCase();
  const feed = useFeed(session, undefined, false);
  const relationship = loadedProfile
    ? projectRelationship(loadedProfile, viewerId)
    : null;
  const ownProfile = loadedProfile?.profile.id === viewerId;
  const canEditProfile = ownProfile && feed.canPost;
  const rawRepostIds = new Set(loadedProfile?.reposts.map((post) => post.id));
  const loadedPosts = loadedProfile
    ? [
        ...(loadedProfile.pinnedPost ? [loadedProfile.pinnedPost] : []),
        ...loadedProfile.posts.filter((post) => post.id !== loadedProfile.pinnedPost?.id),
      ]
    : [];
  const profile =
    loadedProfile && relationship
      ? {
          ...loadedProfile,
          isFollowing: relationship.isFollowing,
          isFollowedBy: relationship.isFollowedBy,
          profile: {
            ...loadedProfile.profile,
            followerCount: relationship.followerCount,
            followingCount: relationship.followingCount,
          },
          posts: orderPinned(
            loadedPosts.map(feed.resolvePost).filter((post) => post !== null),
          ),
          reposts: [
            ...(ownProfile
              ? feed.viewerReposts.filter((post) => !rawRepostIds.has(post.id))
              : []),
            ...loadedProfile.reposts,
          ]
            .map(feed.resolvePost)
            .filter((post) => post !== null)
            // On your own profile an undone repost disappears at once; your
            // own quotes stay, since they are posts rather than a toggle.
            .filter(
              (post) =>
                !ownProfile ||
                post.reposted ||
                (post.quote !== null &&
                  post.author.id === loadedProfile.profile.id),
            ),
          replies: loadedProfile.replies.flatMap((reply) => {
            const post = feed.resolvePost(reply.post);
            return post
              ? [
                  {
                    post,
                    thread: reply.thread
                      .map(feed.resolvePost)
                      .filter((ancestor) => ancestor !== null),
                  },
                ]
              : [];
          }),
        }
      : null;
  const github = profile?.profile.github;
  const contributionCount = github?.contributionCount ?? 0;
  const formattedContributionCount = contributionCount.toLocaleString();
  const postCount =
    loadedProfile?.profile.postCount === undefined || !profile
      ? null
      : Math.max(
          0,
          loadedProfile.profile.postCount -
            Math.max(0, loadedPosts.length - profile.posts.length),
        );
  /** "X reposted" for a post on the Reposts tab; the person's own quotes have none. */
  function repostContextFor(post: Post) {
    if (!profile) return null;
    const base =
      profile.repostedBy[post.id] ??
      (ownProfile && post.reposted
        ? {
            by: profile.profile,
            audience: post.repostAudience ?? ("public" as const),
            others: 0,
          }
        : undefined);
    return feed.repostContext(post, base, false);
  }
  const avatarUrl = profile?.profile.avatarUrl;
  const friends = profile?.isFollowing && profile.isFollowedBy;
  function closeEditDialog() {
    setEditDialogOpen(false);
    if (hasGithubResult) {
      const next = new URLSearchParams(searchParams);
      next.delete("github");
      next.delete("connection");
      next.delete("result");
      setSearchParams(next, { replace: true });
    }
  }

  const blockedEitherWay = Boolean(profile?.blocking || profile?.blockedBy);
  const [sharing, setSharing] = useState(false);
  const profileActions: MenuAction[] = profile
    ? [
        ...(viewer && !feed.readOnly && profile.profile.id !== viewer.id && !profile.profile.bannedAt && !blockedEitherWay
          ? [{ label: "Message", icon: Mail, onSelect: () => void navigate(`/messages?to=${encodeURIComponent(profile.profile.handle)}`) }]
          : []),
        { label: "Share profile", icon: SendHorizontal, onSelect: () => setSharing(true) },
        copyLinkAction(`/@${profile.profile.handle}`, "Copy profile link"),
      ]
    : [];
  function applyBlock() {
    void load();
  }
  async function unblock() {
    if (!profile) return;
    try {
      await setBlocked(profile.profile, false);
      applyBlock();
    } catch (reason) {
      toast.add({ title: errorMessage(reason) });
    }
  }
  function toggleFollow() {
    if (profile && viewer && feed.canPost)
      mutateFollow(profile, viewer.id, !profile.isFollowing);
  }
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const startedAt = getActionRevision();
      try {
        const result = await api.profile(handle, signal);
        if (!signal?.aborted) {
          rememberProfile(result, viewerId, startedAt);
          setProfile(result);
          setError("");
        }
      } catch (error) {
        if (!signal?.aborted) setError(errorMessage(error));
      }
    },
    [handle, viewerId],
  );
  useEffect(() => {
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    void load(controller.signal);
    return () => controller.abort();
  }, [load, session]);
  useEffect(() => {
    if (loadedProfile)
      storeProfile(profileCacheKey(handle, viewerId), loadedProfile);
  }, [loadedProfile, handle, viewerId]);
  const goBack = useGoBack();
  const [connections, setConnections] = useState<ConnectionList | null>(null);
  const fromNavigationTab = (useLocation().state as { navigationTab?: boolean } | null)?.navigationTab === true;
  usePageTitle(
    loadedProfile
      ? `${loadedProfile.profile.displayName} (@${loadedProfile.profile.handle})`
      : `@${handle}`,
  );
  return (
    <div className="mx-auto min-w-0 max-w-xl">
      <header className="mb-4 flex min-h-10 items-center gap-3">
        <IconLink to="/" label="Back" onClick={goBack} className={cn(ownHandle && fromNavigationTab && "max-md:hidden")}>
          <ArrowLeft />
        </IconLink>
        <span className="text-lg font-semibold">Profile</span>
        {profile && !profile.profile.banReason && !error && (
          <div className="relative ml-auto flex items-center gap-1.5">
            {canEditProfile && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setEditTab("profile");
                    setEditDialogOpen(true);
                  }}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
                <EditProfileDialog
                  open={editDialogOpen}
                  onOpenChange={(open) => {
                    if (open) setEditDialogOpen(true);
                    else closeEditDialog();
                  }}
                  tab={editTab}
                  onTabChange={setEditTab}
                  userId={profile.profile.id}
                  profile={profile.profile}
                  paint={
                    <PaintPicker
                      user={profile.profile}
                      onSaved={(paint) => {
                        setProfile((current) =>
                          current?.profile.id === profile.profile.id
                            ? { ...current, profile: { ...current.profile, paint } }
                            : current,
                        );
                        onPaintSaved(profile.profile.id, paint);
                      }}
                    />
                  }
                  onGithubChange={(github) => {
                    setProfile((current) =>
                      current?.profile.id === profile.profile.id
                        ? { ...current, profile: { ...current.profile, github } }
                        : current,
                    );
                  }}
                  onSaved={(updated) => {
                    setProfile((current) =>
                      current
                        ? {
                            ...current,
                            profile: { ...current.profile, ...updated },
                          }
                        : current,
                    );
                    onProfileSaved(profile.profile.id, updated);
                    if (updated.handle !== handle)
                      navigate(`/@${updated.handle}`, { replace: true });
                  }}
                />
              </>
            )}
            {profile.blocking && (
              <Button size="sm" variant="outline" onClick={() => void unblock()}>
                <ShieldCheck aria-hidden="true" />
                Unblock
              </Button>
            )}
            {session && !feed.readOnly && !blockedEitherWay &&
              profile.profile.id !== viewer?.id &&
              (viewer ? (
                <IconButton
                  label={
                    friends
                      ? `Friends · Unfollow @${profile.profile.handle}`
                      : profile.isFollowing
                        ? `Unfollow @${profile.profile.handle}`
                        : `Follow @${profile.profile.handle}`
                  }
                  aria-pressed={profile.isFollowing}
                  size="sm"
                  variant={profile.isFollowing ? "secondary" : "default"}
                  onClick={() => void toggleFollow()}
                >
                  {friends ? (
                    <span
                      key="friends"
                      className="inline-flex animate-in items-center gap-1.5 duration-200 fade-in-0 zoom-in-90"
                    >
                      <UsersRound />
                      <span>Friends</span>
                    </span>
                  ) : profile.isFollowing ? (
                    <span
                      key="following"
                      className="inline-flex animate-in items-center gap-1.5 duration-200 fade-in-0 zoom-in-90"
                    >
                      <UserCheck />
                      <span>Unfollow</span>
                    </span>
                  ) : (
                    <span
                      key="follow"
                      className="inline-flex animate-in items-center gap-1.5 duration-200 fade-in-0 zoom-in-90"
                    >
                      <UserPlus />
                      <span>Follow</span>
                    </span>
                  )}
                </IconButton>
              ) : session.authenticated ? (
                <Button
                  render={<Link to="/onboarding" />}
                  nativeButton={false}
                  size="sm"
                  aria-label="Choose a handle to follow"
                >
                  <UserPlus />
                  Follow
                </Button>
              ) : (
                <Button
                  render={<a href="/auth/login" />}
                  nativeButton={false}
                  size="sm"
                  aria-label="Sign in to follow"
                >
                  <UserPlus />
                  Follow
                </Button>
              ))}
            <ShareButton
              hiddenTrigger
              open={sharing}
              onOpenChange={setSharing}
              target={{ kind: "profile", handle: profile.profile.handle }}
              viewerId={viewerId}
            />
            <ReportMenu
              className="size-9"
              label="Profile options"
              actions={profileActions}
              {...(viewer && !feed.readOnly && profile.profile.id !== viewer.id
                ? {
                    block: { id: profile.profile.id, handle: profile.profile.handle, blocking: profile.blocking },
                    onBlockChange: applyBlock,
                    subject: { type: "user" as const, id: profile.profile.id, handle: profile.profile.handle },
                  }
                : {})}
            />
          </div>
        )}
      </header>
      {profile?.profile.banReason ? (
        <section aria-labelledby="banned-profile-title" className="py-4">
          <div className="flex items-center gap-3 border-b pb-4">
            <ShieldAlert className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <h1 id="banned-profile-title" className="text-lg font-semibold sm:text-xl">
                This user was banned
              </h1>
              <p className="wrap-anywhere text-sm text-muted-foreground">
                @{profile.profile.handle}
              </p>
            </div>
          </div>
          <dl className="space-y-4 py-4 text-sm">
            <div className="space-y-1">
              <dt className="font-medium text-muted-foreground">Reason</dt>
              <dd className="wrap-anywhere leading-relaxed whitespace-pre-wrap">
                {profile.profile.banReason}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {profile.profile.bannedAt && (
                <div className="space-y-1">
                  <dt className="font-medium text-muted-foreground">When</dt>
                  <dd>
                    <time dateTime={profile.profile.bannedAt}>
                      {new Date(profile.profile.bannedAt).toLocaleString(undefined, {
                        dateStyle: "long",
                        timeStyle: "short",
                      })}
                    </time>
                  </dd>
                </div>
              )}
              <div className="space-y-1">
                <dt className="font-medium text-muted-foreground">Banned by</dt>
                <dd className="wrap-anywhere">
                  {profile.profile.bannedByProfileHandle ? (
                    <Link className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                      to={`/@${profile.profile.bannedByProfileHandle}`}>
                      {profile.profile.bannedBy}
                    </Link>
                  ) : profile.profile.bannedBy ?? "Moderation team"}
                </dd>
              </div>
            </div>
          </dl>
        </section>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <IconButton label="Retry profile" onClick={() => void load()}>
            <RotateCcw />
          </IconButton>
        </div>
      ) : !profile ? (
        <ProfileSkeleton />
      ) : (
        <>
          <div className="relative mb-12 aspect-3/1 rounded-xl bg-linear-to-br from-muted to-muted/40">
            {profile.profile.bannerUrl && (
              <BannerImage
                src={profile.profile.bannerUrl}
                crop={profile.profile.bannerCrop}
                alt={`${profile.profile.displayName}'s banner`}
              />
            )}
            {canEditProfile && (
              <BannerEditor
                bannerUrl={profile.profile.bannerUrl}
                verifyAccount={(signal) => verifyAccount(profile.profile.id, signal)}
                onSaved={(bannerUrl, bannerCrop) => {
                  onBannerSaved(profile.profile.id, bannerUrl, bannerCrop);
                  setProfile((current) =>
                    current
                      ? {
                          ...current,
                          profile: {
                            ...current.profile,
                            bannerUrl,
                            bannerCrop,
                          },
                        }
                      : current,
                  );
                }}
              />
            )}
            {canEditProfile ? (
              <>
                <button
                  type="button"
                  aria-label="Change profile picture"
                  aria-haspopup="dialog"
                  onClick={() => setPictureDialogOpen(true)}
                  className="group absolute -bottom-8 left-4 z-10 size-16 cursor-pointer rounded-[30%] ring-4 ring-background outline-none [corner-shape:squircle] focus-visible:ring-ring"
                >
                  <Avatar hat className="size-full">
                    {avatarUrl && (
                      <AvatarImage
                        src={avatarUrl}
                        alt={`${profile.profile.displayName}'s avatar`}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <AvatarFallback className="text-lg">
                      {profile.profile.displayName.slice(0, 2)}
                    </AvatarFallback>
                    <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/60 text-white opacity-0 transition-opacity [corner-shape:inherit] group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Camera className="size-6" aria-hidden="true" />
                    </span>
                  </Avatar>
                </button>
                <ProfilePictureDialog
                  open={pictureDialogOpen}
                  onOpenChange={setPictureDialogOpen}
                  userId={profile.profile.id}
                  onChanged={(avatarUrl) => {
                    setProfile((current) =>
                      current
                        ? { ...current, profile: { ...current.profile, avatarUrl } }
                        : current,
                    );
                    onAvatarSaved(profile.profile.id, avatarUrl);
                  }}
                />
              </>
            ) : (
              <Avatar hat className="absolute -bottom-8 left-4 size-16 ring-4 ring-background">
                {profile.profile.avatarUrl && (
                  <AvatarImage
                    src={profile.profile.avatarUrl}
                    alt={`${profile.profile.displayName}'s avatar`}
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="text-lg">
                  {profile.profile.displayName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="min-w-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <h1 className="min-w-0 wrap-anywhere text-xl font-semibold">
                  <DisplayName user={profile.profile} />
                </h1>
                <TwitchLive handle={profile.profile.handle} />
                {profile.profile.isOg && (
                  <ProfileBadge label="OG member" tooltip="Joined before the big migration">
                    <Gem className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  </ProfileBadge>
                )}
                {profile.profile.badges.map((badge) => (
                  <ProfileBadge key={badge.id} label={badge.tooltip} tooltip={badge.tooltip}>
                    <span
                      aria-hidden="true"
                      className="block size-4 bg-current mask-contain mask-center mask-no-repeat"
                      style={{ maskImage: `url("/api/profiles/badge-icons/${badge.icon}")` }}
                    />
                  </ProfileBadge>
                ))}
                {contributionCount > 0 && (
                  <ProfileBadge
                    label={`Contributor · ${formattedContributionCount}`}
                    tooltip={`Contributor · ${formattedContributionCount} public ysocialoss ${contributionCount === 1 ? "contribution" : "contributions"}`}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-300">
                      <GitPullRequest className="size-4" aria-hidden="true" />
                      {formattedContributionCount}
                    </span>
                  </ProfileBadge>
                )}
              </div>
              <p className="wrap-anywhere text-sm text-muted-foreground">
                @{profile.profile.handle}
              </p>
              {profile.profile.pronouns && (
                <p className="wrap-anywhere text-sm text-muted-foreground">
                  <bdi>{profile.profile.pronouns}</bdi>
                </p>
              )}
            </div>
          </div>
          {blockedEitherWay && (
            <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {profile.blocking
                ? `You blocked @${profile.profile.handle}. You won't see their posts and they can't interact with you.`
                : `@${profile.profile.handle} blocked you. You can't follow or message them.`}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {(["followers", "following"] as const).map((list) => (
              <button
                key={list}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setConnections(list)}
                className="-mx-1 cursor-pointer rounded-md px-1 outline-none hover:text-foreground hover:underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <strong className="font-semibold text-foreground">
                  {(list === "followers" ? profile.profile.followerCount : profile.profile.followingCount).toLocaleString()}
                </strong>{" "}
                {list}
              </button>
            ))}
            {postCount !== null && (
              <span>
                <strong className="font-semibold text-foreground tabular-nums">
                  {postCount.toLocaleString()}
                </strong>{" "}
                {postCount === 1 ? "post" : "posts"}
              </span>
            )}
          </div>
          <ConnectionsDialog
            key={profile.profile.handle}
            profile={profile.profile}
            list={connections}
            onListChange={setConnections}
            onClose={() => setConnections(null)}
            canFollow={Boolean(viewer && !feed.readOnly)}
          />
          {profile.profile.bio && (
            <p className="mt-3 whitespace-pre-wrap wrap-anywhere text-sm">
              {profile.profile.bio}
            </p>
          )}
          {(github || profile.profile.connections.length > 0 || profile.profile.domains.length > 0) && (
            <div className="mt-2 -ml-1 flex flex-wrap items-center gap-0.5">
              {github && (
                <ExternalLink
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-7",
                  )}
                  label={`@${github.login} on GitHub`}
                  href={`https://github.com/${github.login}`}
                >
                  <GithubMark />
                </ExternalLink>
              )}
              {profile.profile.connections.map((connection) => {
                const provider = providerById(connection.provider);
                if (!provider) return null;
                return (
                  <ExternalLink
                    key={connection.provider}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon" }),
                      "size-7",
                    )}
                    label={`${connection.username} on ${provider.name}`}
                    href={connection.profileUrl}
                  >
                    <provider.Mark className={`size-4 ${provider.color}`} />
                  </ExternalLink>
                );
              })}
              {profile.profile.domains.map((domain) => (
                <ExternalLink
                  key={domain}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "size-7",
                  )}
                  label={domain}
                  href={`https://${domain}`}
                >
                  <DomainIcon domain={domain} className="size-4" />
                </ExternalLink>
              ))}
            </div>
          )}
          <p className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Joined{" "}
            {new Date(profile.profile.createdAt).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
          <div
            role="tablist"
            aria-label="Profile sections"
            className="relative -mx-1 flex border-b"
          >
            {(
              [
                { value: "posts", label: "Posts" },
                { value: "replies", label: "Replies" },
                { value: "reposts", label: "Reposts" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className="h-11 flex-1 text-sm font-medium text-muted-foreground outline-none transition-[color,transform] duration-200 hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 aria-selected:font-semibold aria-selected:text-foreground"
              >
                {label}
              </button>
            ))}
            {/* One underline that glides to the selected tab. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-1/3 px-3 transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]"
              style={{
                transform: `translateX(${["posts", "replies", "reposts"].indexOf(tab) * 100}%)`,
              }}
            >
              <span className="block h-full rounded-full bg-foreground" />
            </span>
          </div>
          {feed.error && <p role="alert">{feed.error}</p>}
          {tab === "replies"
            ? profile.replies.map(({ post, thread }) => (
                <section key={post.id} className="border-b">
                  {thread.map((ancestor) => (
                    <PostCard
                      key={ancestor.id}
                      post={ancestor}
                      feed={feed}
                      connectToNext
                    />
                  ))}
                  <PostCard post={post} feed={feed} />
                </section>
              ))
            : profile[tab].map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  feed={feed}
                  repost={tab === "reposts" ? repostContextFor(post) : null}
                  replyContext={tab === "reposts"}
                  pinnedLabel={tab === "posts"}
                  pinnable={tab === "posts" && ownProfile}
                />
              ))}
          {profile[tab].length === 0 && <p className="mt-4">No {tab} yet.</p>}
        </>
      )}
    </div>
  );
}
