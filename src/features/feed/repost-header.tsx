import { Repeat2, Users } from "lucide-react";
import { ProfileHoverLink } from "@/features/profile/profile-hover-link";
import { cn } from "@/lib/utils";
import type { RepostContext } from "@/lib/api";

/** "X reposted" above a post that surfaced in a list because someone shared it. */
export function RepostHeader({
  repost,
  viewerId,
  className,
}: {
  repost: RepostContext;
  viewerId: string | null;
  className?: string;
}) {
  const you = repost.by.id === viewerId;
  const friends = repost.audience === "friends";
  const Icon = friends ? Users : Repeat2;
  const name = you ? "You" : repost.by.displayName || repost.by.handle;
  return (
    <p
      className={cn(
        "mb-1.5 ml-12 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">
        <ProfileHoverLink
          handle={repost.by.handle}
          className="font-medium underline-offset-4 hover:text-foreground hover:underline"
        >
          {name}
        </ProfileHoverLink>{" "}
        reposted{friends ? " to friends" : ""}
        {repost.others > 0 &&
          ` and ${repost.others.toLocaleString()} other${repost.others === 1 ? "" : "s"}`}
      </span>
    </p>
  );
}
