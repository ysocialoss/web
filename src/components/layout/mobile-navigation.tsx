import { useEffect, useState, type MouseEventHandler } from "react";
import { MessageCircle, Plus, UserRound } from "lucide-react";
import { useLocation } from "react-router";
import { LegalMenu } from "./legal-menu";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import { AccountMenu } from "@/features/auth/account-menu";
import type { AuthState } from "@/features/auth/use-auth";
import { NotificationsBell } from "@/features/notifications/notifications";
import { FloatingNavigation } from "@/components/ui/floating-navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNewPostTarget } from "@/features/feed/new-post-target";
import { useDmUnread } from "@/features/dms/dm-unread";
import { useNotifications } from "@/features/notifications/notifications-context";
import { cn } from "@/lib/utils";
import { SiteLogoLink, SiteWordmark } from "./site-wordmark";
import { useSessionHint } from "@/features/auth/session-hint";
import { preloadRoute } from "@/routes";
import { defaultNavigation, hiddenNavigation, navigation } from "./navigation";
import { HiddenNavigation } from "./hidden-navigation";
import { useShowHiddenNavigation } from "@/lib/show-hidden-navigation";

const COMPACT_AFTER = 64;
const DIRECTION_STEP = 10;
const NAV_COLLAPSE_TRANSITION = "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function useScrolledDown(resetKey: string) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = 0;
    let travel = 0;
    function onScroll(event: Event) {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        !target.matches(".content-scroll")
      )
        return;
      const top = Math.max(0, target.scrollTop);
      const delta = top - last;
      last = top;
      if (top < COMPACT_AFTER) {
        travel = 0;
        setCompact(false);
        return;
      }
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > DIRECTION_STEP) setCompact(true);
      else if (travel < -DIRECTION_STEP) setCompact(false);
    }
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () =>
      document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setCompact(false);
  }
  return compact;
}

export function MobileHeader({
  auth,
  onLogoClick,
}: {
  auth: AuthState;
  onLogoClick: MouseEventHandler<HTMLAnchorElement>;
}) {
  const hint = useSessionHint(auth.session);
  const signedIn =
    (auth.session?.authenticated && !auth.session.needsOnboarding) || !!hint;

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
          <SiteLogoLink
            onHomeClick={onLogoClick}
            tooltipSide="bottom"
            className="flex min-h-11 cursor-pointer items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(variation) => <SiteWordmark rem={7} variation={variation} />}
          </SiteLogoLink>
          <div className="flex items-center gap-1">
            <LegalMenu className="size-11" />
            {signedIn && <NotificationsBell className="size-11" reserveSpace />}
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
  const { unreadCount } = useNotifications();
  const session = auth.session;
  const hint = useSessionHint(session);
  const account = session?.authenticated && !session.needsOnboarding ? session : null;
  const user = account?.user ?? hint;
  const avatarUrl =
    session?.authenticated && !session.needsOnboarding
      ? session.avatarUrl
      : (hint?.avatarUrl ?? null);
  const profilePath = user ? `/@${user.handle}` : "/profile";
  const profileIcon = user ? (
    <Avatar hat className="size-7">
      {avatarUrl && (
        <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className="bg-white/15 text-xs text-white">
        {(user.displayName.trim() || user.handle).slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  ) : (
    <UserRound aria-hidden="true" />
  );
  const order = account?.user.navigation ?? defaultNavigation;
  const showHidden = useShowHiddenNavigation();
  const hidden = showHidden ? hiddenNavigation(order, !!user) : [];
  const items = order
    .filter((id) => user || !navigation[id].auth)
    .map((id) => {
      const { to, label, icon: Icon, disabled } = navigation[id];
      return {
        to: id === "profile" ? profilePath : to,
        label,
        icon: id === "profile" ? profileIcon : <Icon aria-hidden="true" />,
        disabled,
        badge: id === "messages" ? unread : id === "activity" ? unreadCount : undefined,
      };
    });
  const activeTo = pathname.startsWith("/posts/")
    ? "/"
    : pathname.startsWith("/messages/")
      ? "/messages"
      : (items.find(({ to }) => to === pathname)?.to ?? null);

  const compact = useScrolledDown(pathname);
  const hasNav = items.length > 0 || hidden.length > 0;
  const [lastKind, setLastKind] = useState<"post" | "reply">("post");
  const kind = newPost?.kind === "reply" ? "reply" : "post";
  if (newPost && kind !== lastKind) setLastKind(kind);
  const shownKind = newPost ? kind : lastKind;

  return (
    <>
      {hasNav && (
        <ProgressiveBlur
          edge="bottom"
          height="calc(4rem + max(1rem, env(safe-area-inset-bottom)))"
          enabled={!compact}
          className={cn("z-20 transition-[backdrop-filter,-webkit-backdrop-filter] md:hidden", NAV_COLLAPSE_TRANSITION)}
        />
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <div
          className={cn(
            "flex origin-bottom items-center justify-center transition-transform",
            NAV_COLLAPSE_TRANSITION,
            compact ? "scale-[0.8]" : "scale-100",
          )}
        >
          {hasNav && (
            <FloatingNavigation
              items={items}
              activeTo={activeTo}
              onPreload={preloadRoute}
              label="Mobile navigation"
              endContent={hidden.length > 0 && (
                <HiddenNavigation items={hidden} profilePath={profilePath} mobile />
              )}
              className="pointer-events-auto w-max min-w-0 max-w-80"
            />
          )}
          <div
            inert={!newPost}
            className={cn(
              "shrink-0 transition-[width,margin,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              newPost
                ? cn("pointer-events-auto w-14 scale-100 opacity-100", hasNav && "ml-2")
                : "pointer-events-none ml-0 w-0 scale-50 opacity-0",
            )}
          >
            <button
              type="button"
              aria-label={
                shownKind === "reply" ? "Write a reply" : "Write a new post"
              }
              onClick={newPost?.open}
              className="relative flex size-14 items-center justify-center rounded-full bg-primary/88 text-primary-foreground shadow-[0_4px_16px_-6px_rgb(0_0_0/0.3)] ring-1 ring-white/15 backdrop-blur-2xl backdrop-saturate-200 outline-none transition-transform duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-white/90"
            >
              {(["post", "reply"] as const).map((icon) => {
                const Icon = icon === "reply" ? MessageCircle : Plus;
                return (
                  <Icon
                    key={icon}
                    className={cn(
                      "absolute size-6 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                      shownKind === icon
                        ? "scale-100 rotate-0 opacity-100"
                        : "scale-50 -rotate-90 opacity-0",
                    )}
                    aria-hidden="true"
                    strokeWidth={2.5}
                  />
                );
              })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
