import { Link } from "react-router";
import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Session } from "@/lib/api";
import { ProfileCardSkeleton } from "@/components/loading-skeletons";

export function ProfileCard({
  session,
  loading = false,
}: {
  session: Session | null;
  loading?: boolean;
}) {
  if (loading) return <ProfileCardSkeleton />;
  const user =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const avatarUrl = session?.authenticated ? session.avatarUrl : null;
  const initials = user
    ? (user.displayName.trim() || user.handle).slice(0, 2)
    : null;
  return (
    <section aria-labelledby="profile-heading">
      <div className="relative h-24 rounded-lg bg-linear-to-r from-green-500 to-green-950">
        <Avatar className="absolute -bottom-5 right-2 size-14 ring-4 ring-background">
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt={user ? `${user.displayName}'s avatar` : "Your avatar"}
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="text-lg">
            {initials || <UserRound className="size-7" />}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="mt-7">
        <h2 id="profile-heading" className="text-sm font-semibold">
          {user?.displayName ?? "Welcome to ysocial"}
        </h2>
        {user ? (
          <Link
            className="text-xs text-muted-foreground"
            to={`/@${user.handle}`}
          >
            @{user.handle}
          </Link>
        ) : (
          <a className="text-sm underline" href="/auth/login">
            Sign in with CNS
          </a>
        )}
      </div>
    </section>
  );
}
