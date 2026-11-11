import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type Profile, type Session } from "@/lib/api";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  UserCheck,
  UserPlus,
  UsersRound,
  MessageCircle,
  Repeat2,
  RotateCcw,
} from "lucide-react";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PostCard } from "@/features/feed/post-card";
import { useFeed } from "@/features/feed/use-feed";
import { ProfileSkeleton } from "@/components/loading-skeletons";
import {
  getActionRevision,
  mutateFollow,
  projectRelationship,
  rememberProfile,
} from "@/features/feed/optimistic-actions";

export function ProfilePage({
  handle,
  session,
}: {
  handle: string;
  session: Session | null;
}) {
  const [loadedProfile, setProfile] = useState<Profile | null>(null);
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
            .filter((post) => !ownProfile || post.reposted),
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
  const friends = profile?.isFollowing && profile.isFollowedBy;
  function toggleFollow() {
    if (profile && viewer)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load, session]);
  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-4 flex items-center gap-3">
        <IconLink to="/" label="Back to feed">
          <ArrowLeft />
        </IconLink>
        <span className="text-lg font-semibold">Profile</span>
      </header>
      {error ? (
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
          <div className="relative mb-12 h-28 rounded-xl bg-linear-to-br from-muted to-muted/40">
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
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {profile.profile.displayName}
              </h1>
              <p className="text-sm text-muted-foreground">
                @{profile.profile.handle}
              </p>
            </div>
            {session &&
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
                    <>
                      <UsersRound />
                      <span>Friends</span>
                    </>
                  ) : profile.isFollowing ? (
                    <>
                      <UserCheck />
                      <span>Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus />
                      <span>Follow</span>
                    </>
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
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">
              {profile.profile.bio}
            </p>
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
            className="flex gap-2 border-b pb-3"
            aria-label="Profile sections"
          >
            {(
              [
                { value: "posts", label: "Posts", icon: FileText },
                { value: "replies", label: "Replies", icon: MessageCircle },
                { value: "reposts", label: "Reposts", icon: Repeat2 },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={tab === value ? "secondary" : "ghost"}
                className="flex-1"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
          {feed.error && <p role="alert">{feed.error}</p>}
          {tab === "replies"
            ? profile.replies.map(({ post, thread }) => (
                <section key={post.id} className="border-b">
                  {thread.map((ancestor) => (
                    <PostCard key={ancestor.id} post={ancestor} feed={feed} />
                  ))}
                  <PostCard post={post} feed={feed} />
                </section>
              ))
            : profile[tab].map((post) => (
                <PostCard key={post.id} post={post} feed={feed} />
              ))}
          {profile[tab].length === 0 && <p className="mt-4">No {tab} yet.</p>}
        </>
      )}
    </div>
  );
}
