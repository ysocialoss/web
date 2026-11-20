import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  api,
  ApiError,
  errorMessage,
  retryRequest,
  type Post,
  type Profile,
  type Session,
  type BannerCrop,
} from "@/lib/api";
import {
  ArrowLeft,
  CalendarDays,
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
import { ExternalLink } from "@/components/ui/external-link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { useGoBack } from "@/hooks/use-go-back";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BannerImage } from "./banner-image";
import { BannerEditor } from "./banner-editor";
import { AvatarCropper } from "./avatar-cropper";
import { RecentAvatars } from "./recent-avatars";
import { ProfileForm } from "./profile-form";
import { ProfileEditDialogContent, type ProfileEditTab } from "./profile-edit-dialog";
import { PostCard } from "@/features/feed/post-card";
import { useFeed } from "@/features/feed/use-feed";
import { ProfileSkeleton } from "@/components/loading-skeletons";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  getActionRevision,
  mutateFollow,
  projectRelationship,
  rememberProfile,
  updateAuthor,
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

export function ProfilePage({
  handle,
  session,
  onAvatarSaved,
  onBannerSaved,
  onProfileSaved,
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
}) {
  const [loadedProfile, setProfile] = useState<Profile | null>(null);
  const [pictureDialogOpen, setPictureDialogOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const hasGithubResult = searchParams.has("github");
  const [editDialogOpen, setEditDialogOpen] = useState(hasGithubResult);
  const [editTab, setEditTab] = useState<ProfileEditTab>(hasGithubResult ? "connections" : "profile");
  const [savingProfile, setSavingProfile] = useState(false);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"posts" | "replies" | "reposts">("posts");
  const viewer =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const viewerId = viewer?.id ?? null;
  const feed = useFeed(session, undefined, false);
  const relationship = loadedProfile
    ? projectRelationship(loadedProfile, viewerId)
    : null;
  const ownProfile = loadedProfile?.profile.id === viewerId;
  const canEditProfile = ownProfile && feed.canPost;
  const rawRepostIds = new Set(loadedProfile?.reposts.map((post) => post.id));
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
          posts: loadedProfile.posts
            .map(feed.resolvePost)
            .filter((post) => post !== null),
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
      setSearchParams(next, { replace: true });
    }
  }

  function toggleFollow() {
    if (profile && viewer && feed.canPost)
      mutateFollow(profile, viewer.id, !profile.isFollowing);
  }
  async function verifyAccount(signal?: AbortSignal) {
    const current = await api.session(signal);
    if (
      !current.authenticated ||
      current.needsOnboarding ||
      current.user.id !== viewerId
    )
      throw new ApiError(403, "retry_account_changed");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load, session]);
  const goBack = useGoBack();
  usePageTitle(
    loadedProfile
      ? `${loadedProfile.profile.displayName} (@${loadedProfile.profile.handle})`
      : `@${handle}`,
  );
  return (
    <div className="mx-auto min-w-0 max-w-xl">
      <header className="mb-4 flex items-center gap-3">
        <IconLink to="/" label="Back" onClick={goBack}>
          <ArrowLeft />
        </IconLink>
        <span className="text-lg font-semibold">Profile</span>
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
                verifyAccount={verifyAccount}
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
              <Dialog
                open={pictureDialogOpen}
                onOpenChange={setPictureDialogOpen}
              >
                <DialogTrigger
                  aria-label="Change profile picture"
                  className="group absolute -bottom-8 left-4 z-10 size-16 cursor-pointer rounded-[30%] ring-4 ring-background outline-none [corner-shape:squircle] focus-visible:ring-ring"
                >
                  <Avatar className="size-full">
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
                </DialogTrigger>
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Change profile picture</DialogTitle>
                    <DialogDescription className="sr-only">
                      Choose a picture, then drag and zoom to adjust the crop.
                    </DialogDescription>
                  </DialogHeader>
                  <AvatarCropper
                    emptyFooter={
                      <RecentAvatars
                        onSelect={async (id, signal) => {
                          await verifyAccount(signal);
                          const result = await api.selectRecentAvatar(
                            id,
                            signal,
                          );
                          setProfile((current) =>
                            current
                              ? {
                                  ...current,
                                  profile: {
                                    ...current.profile,
                                    avatarUrl: result.avatarUrl,
                                  },
                                }
                              : current,
                          );
                          updateAuthor(profile.profile.id, {
                            avatarUrl: result.avatarUrl,
                          });
                          onAvatarSaved(profile.profile.id, result.avatarUrl);
                          setPictureDialogOpen(false);
                        }}
                      />
                    }
                    onSave={async (picture, signal) => {
                      const result = await retryRequest(
                        () => api.uploadAvatar(picture, signal),
                        {
                          context: "upload avatar",
                          signal,
                          beforeRetry: () => verifyAccount(signal),
                        },
                      );
                      setProfile((current) =>
                        current
                          ? {
                              ...current,
                              profile: {
                                ...current.profile,
                                avatarUrl: result.avatarUrl,
                              },
                            }
                          : current,
                      );
                      updateAuthor(profile.profile.id, {
                        avatarUrl: result.avatarUrl,
                      });
                      onAvatarSaved(profile.profile.id, result.avatarUrl);
                      setPictureDialogOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            ) : (
              <Avatar className="absolute -bottom-8 left-4 size-16 ring-4 ring-background">
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <h1 className="min-w-0 wrap-anywhere text-xl font-semibold">
                  {profile.profile.displayName}
                </h1>
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
            {canEditProfile && (
              <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                  if (savingProfile) return;
                  if (open) {
                    setEditTab("profile");
                    setEditDialogOpen(true);
                  } else closeEditDialog();
                }}
              >
                <DialogTrigger render={<Button variant="outline" />}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DialogTrigger>
                <ProfileEditDialogContent
                  saving={savingProfile}
                  tab={editTab}
                  onTabChange={setEditTab}
                  onGithubChange={(github) => {
                    setProfile((current) =>
                      current?.profile.id === profile.profile.id
                        ? { ...current, profile: { ...current.profile, github } }
                        : current,
                    );
                  }}
                >
                  {editDialogOpen && (
                    <ProfileForm
                      appearance="dialog"
                      userId={profile.profile.id}
                      profile={profile.profile}
                      onSavingChange={setSavingProfile}
                      onCancel={closeEditDialog}
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
                        closeEditDialog();
                        if (updated.handle !== handle)
                          navigate(`/@${updated.handle}`, { replace: true });
                      }}
                    />
                  )}
                </ProfileEditDialogContent>
              </Dialog>
            )}
            {session && !feed.readOnly &&
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
                  size="default"
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
                  variant="outline"
                >
                  <UserPlus />
                  Choose a handle to follow
                </Button>
              ) : (
                <Button
                  render={<a href="/auth/login" />}
                  nativeButton={false}
                  variant="outline"
                >
                  <UserPlus />
                  Sign in to follow
                </Button>
              ))}
          </div>
          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="font-semibold text-foreground">
                {profile.profile.followerCount.toLocaleString()}
              </strong>{" "}
              followers
            </span>
            <span>
              <strong className="font-semibold text-foreground">
                {profile.profile.followingCount.toLocaleString()}
              </strong>{" "}
              following
            </span>
          </div>
          {profile.profile.bio && (
            <p className="mt-3 whitespace-pre-wrap wrap-anywhere text-sm">
              {profile.profile.bio}
            </p>
          )}
          {github && (
            <ExternalLink
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "mt-2 -ml-1 size-7",
              )}
              label={`@${github.login} on GitHub`}
              href={`https://github.com/${github.login}`}
            >
              <GithubMark />
            </ExternalLink>
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
                />
              ))}
          {profile[tab].length === 0 && <p className="mt-4">No {tab} yet.</p>}
        </>
      )}
    </div>
  );
}
