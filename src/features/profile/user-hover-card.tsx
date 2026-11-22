import { useState } from "react";
import { Link } from "react-router";
import { format } from "date-fns";
import { CalendarDays, Check, UserRoundX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api, errorMessage, type ProfileCard } from "@/lib/api";
import { countFormat } from "@/lib/count-format";
import { BannerImage } from "./banner-image";
import { patchProfileCard, useProfileCard } from "./profile-card-cache";
import { DisplayName } from "@/components/display-name";

const counts = new Intl.NumberFormat("en", countFormat);

export function UserHoverCard({ handle }: { handle: string }) {
  const { card, failed } = useProfileCard(handle);
  if (card) return <UserCardBody key={card.profile.id} card={card} />;
  if (card === null || failed)
    return (
      <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
        <UserRoundX className="size-5 shrink-0" aria-hidden="true" />
        <span>
          {failed
            ? "Could not load this profile."
            : `@${handle} was not found.`}
        </span>
      </div>
    );
  return <UserCardSkeleton />;
}

function UserCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      className="animate-pulse motion-reduce:animate-none"
    >
      <div className="aspect-[3.4/1] bg-muted" />
      <div className="space-y-3 px-4 pt-9 pb-4">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

function UserCardBody({ card }: { card: ProfileCard }) {
  const { profile } = card;
  const [relation, setRelation] = useState({
    following: card.isFollowing,
    followers: profile.followerCount,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = profile.displayName || profile.handle;
  const bio = profile.bio.trim();

  async function toggle() {
    if (busy) return;
    const next = !relation.following;
    setBusy(true);
    setError("");
    try {
      const result = await api.follow(profile.handle, next);
      setRelation({
        following: result.isFollowing,
        followers: result.followerCount,
      });
      patchProfileCard(profile.handle, {
        isFollowing: result.isFollowing,
        profile: { ...profile, followerCount: result.followerCount },
      });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <div className="relative aspect-[3.4/1] overflow-hidden bg-linear-to-br from-mention/40 via-mention-surface to-muted">
        {profile.bannerUrl ? (
          <BannerImage
            src={profile.bannerUrl}
            crop={profile.bannerCrop}
            alt=""
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--mention-surface),transparent_60%)]"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-popover/70 to-transparent"
        />
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <Link
            to={`/@${profile.handle}`}
            aria-label={`${name}'s profile`}
            className="-mt-8 rounded-[30%] outline-none [corner-shape:squircle] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar className="size-16 ring-4 ring-popover">
              {profile.avatarUrl && (
                <AvatarImage
                  src={profile.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback className="text-lg">
                {name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </Link>
          {card.signedIn && !card.isSelf && (
            <Button
              type="button"
              size="sm"
              variant={relation.following ? "outline" : "default"}
              disabled={busy}
              aria-pressed={relation.following}
              onClick={() => void toggle()}
              className="mb-0.5 min-w-20"
            >
              {relation.following ? (
                <>
                  <Check aria-hidden="true" />
                  Following
                </>
              ) : (
                "Follow"
              )}
            </Button>
          )}
        </div>
        <div className="mt-2 min-w-0">
          <Link
            to={`/@${profile.handle}`}
            className="block truncate text-base leading-tight font-semibold outline-none hover:underline focus-visible:underline"
          >
            <DisplayName user={profile} name={name} />
          </Link>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm text-muted-foreground">
              @{profile.handle}
            </span>
            {card.isFollowedBy && !card.isSelf && (
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] leading-none font-medium text-muted-foreground">
                Follows you
              </span>
            )}
          </div>
        </div>
        {profile.pronouns && (
          <p className="mt-1 wrap-anywhere text-sm text-muted-foreground">
            <bdi>{profile.pronouns}</bdi>
          </p>
        )}
        {bio && (
          <p className="mt-2.5 line-clamp-3 text-sm leading-snug break-words whitespace-pre-line">
            {bio}
          </p>
        )}
        <dl className="mt-3 flex items-center gap-4 text-sm">
          <Stat label="Followers" value={relation.followers} />
          <Stat label="Following" value={profile.followingCount} />
          <Stat label="Posts" value={profile.postCount} />
        </dl>
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Joined {format(new Date(profile.createdAt), "MMMM yyyy")}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <dd className="font-semibold tabular-nums" title={value.toLocaleString()}>
        {counts.format(value)}
      </dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
