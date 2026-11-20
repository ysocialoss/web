import type { MouseEventHandler } from "react";
import { House, Mail, MessageCircle, Plus, Search, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import { LegalMenu } from "./legal-menu";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { AccountMenu } from "@/features/auth/account-menu";
import type { AuthState } from "@/features/auth/use-auth";
import { NotificationsBell } from "@/features/notifications/notifications";
import { FloatingNavigation } from "@/components/ui/floating-navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNewPostTarget } from "@/features/feed/new-post-target";
import { useDmUnread } from "@/features/dms/dm-unread";
import { SiteWordmark } from "./site-wordmark";

export function MobileHeader({
  auth,
  onLogoClick,
}: {
  auth: AuthState;
  onLogoClick: MouseEventHandler<HTMLAnchorElement>;
}) {
  const signedIn = auth.session?.authenticated && !auth.session.needsOnboarding;

  // Exactly the header's height: the blur must not reach below it.
  const headerHeight = "calc(env(safe-area-inset-top) + 4rem)";
  return (
    <>
      <ProgressiveBlur height={headerHeight} className="z-20 md:hidden" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-background/60 to-transparent md:hidden"
        style={{ height: headerHeight }}
      />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] md:hidden">
        <div className="pointer-events-auto relative flex min-h-16 items-center justify-between gap-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
          <Link
            to="/"
            aria-label="ysocial home"
            onClick={onLogoClick}
            className="flex min-h-11 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SiteWordmark className="block w-28" />
          </Link>
          <div className="flex items-center gap-1">
            <LegalMenu className="size-11" />
            {signedIn && <NotificationsBell className="size-11" />}
            <AccountMenu auth={auth} />
          </div>
        </div>
      </header>
    </>
  );
}

export function MobileNavigation({ auth }: { auth: AuthState }) {
  const { pathname } = useLocation();
  const newPost = useNewPostTarget();
  const { unread } = useDmUnread();
  const session = auth.session;
  const user =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const profilePath = user ? `/@${user.handle}` : "/profile";
  const profileIcon = user ? (
    <Avatar className="size-7">
      {session?.authenticated && session.avatarUrl && (
        <AvatarImage
          src={session.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback className="bg-white/15 text-xs text-white">
        {(user.displayName.trim() || user.handle).slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  ) : (
    <UserRound aria-hidden="true" />
  );
  const items = [
    {
      to: "/",
      label: "Feed",
      icon: <House aria-hidden="true" />,
    },
    { to: "/search", label: "Search", icon: <Search aria-hidden="true" /> },
    { to: "/messages", label: "Messages", icon: <Mail aria-hidden="true" />, badge: unread },
    { to: profilePath, label: "Profile", icon: profileIcon },
  ];
  const activeTo = pathname.startsWith("/posts/")
    ? "/"
    : pathname.startsWith("/messages/")
      ? "/messages"
      : (items.find(({ to }) => to === pathname)?.to ?? null);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="flex items-center justify-center gap-2">
        <FloatingNavigation
          items={items}
          activeTo={activeTo}
          label="Mobile navigation"
          className="pointer-events-auto w-full max-w-64"
        />
        {newPost && (
          <button
            type="button"
            aria-label={newPost.kind === "reply" ? "Write a reply" : "Write a new post"}
            onClick={newPost.open}
            className="pointer-events-auto flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_32px_-8px_rgb(0_0_0/0.5)] ring-1 ring-white/15 outline-none animate-in fade-in-0 zoom-in-75 duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/90 motion-reduce:animate-none"
          >
            {newPost.kind === "reply" ? (
              <MessageCircle className="size-6" aria-hidden="true" strokeWidth={2.5} />
            ) : (
              <Plus className="size-6" aria-hidden="true" strokeWidth={2.5} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
