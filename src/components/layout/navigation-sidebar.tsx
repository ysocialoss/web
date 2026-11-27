import type { MouseEventHandler } from "react";
import { Plus, UserRound } from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useNewPostTarget } from "@/features/feed/new-post-target";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { defaultNavigation, hiddenNavigation, navigation } from "./navigation";
import { HiddenNavigation } from "./hidden-navigation";
import { useShowHiddenNavigation } from "@/lib/show-hidden-navigation";
import { countLabel, useDmUnread } from "@/features/dms/dm-unread";
import { LegalMenu } from "./legal-menu";
import { AccountMenu } from "@/features/auth/account-menu";
import { LoginDialogContent } from "@/features/auth/login-dialog-content";
import type { AuthState } from "@/features/auth/use-auth";
import { NotificationsBell } from "@/features/notifications/notifications";
import { useNotifications } from "@/features/notifications/notifications-context";
import { SiteLogoLink, SiteLogoMark, SiteWordmark } from "./site-wordmark";
import { preloadRoute } from "@/routes";
import { useSessionHint } from "@/features/auth/session-hint";
import { BetaTag, useFeedUnlock } from "@/features/feed/feed-unlock";

const navItemClass =
  "group/nav flex h-10 w-full items-center gap-3 rounded-lg px-3 outline-none transition-[background-color,color,transform] duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";
const inactiveNavItemClass = "font-medium text-muted-foreground hover:text-foreground";

export function NavigationSidebar({
  showAccount = false,
  auth,
  onLogoClick,
}: {
  showAccount?: boolean;
  auth?: AuthState;
  onLogoClick: MouseEventHandler<HTMLAnchorElement>;
}) {
  const newPost = useNewPostTarget();
  const { unread } = useDmUnread();
  const { unreadCount, signedIn: confirmedSignedIn } = useNotifications();
  const session = auth?.session ?? null;
  const hint = useSessionHint(session);
  const signedIn = confirmedSignedIn || !!hint;
  const account = session?.authenticated && !session.needsOnboarding ? session : null;
  const user = account?.user ?? hint;
  const profilePath = user ? `/@${user.handle}` : session?.authenticated ? "/profile" : null;
  const items = account?.user.navigation ?? defaultNavigation;
  const showHidden = useShowHiddenNavigation();
  const feedUnlock = useFeedUnlock(auth);
  const hidden = showHidden ? hiddenNavigation(items, signedIn) : [];
  const entries = items
    .filter((id) => id !== "profile" || profilePath !== null)
    .map((id) => id === "profile" && profilePath
      ? { ...navigation[id], to: profilePath }
      : navigation[id]);
  return (
    <aside
      aria-label="Sidebar"
      className="hidden min-h-0 min-w-0 flex-col overflow-y-auto p-2 md:flex lg:p-3"
    >
      <div className="flex flex-col items-start gap-4">
        <SiteLogoLink
          onHomeClick={onLogoClick}
          tooltipSide="right"
          className="w-fit max-w-full cursor-pointer rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3"
        >
          {(variation) => (
            <>
              <SiteLogoMark variation={variation} className="lg:hidden" />
              <SiteWordmark
                rem={7.75}
                variation={variation}
                className="hidden lg:block"
              />
            </>
          )}
        </SiteLogoLink>
        <nav
          aria-label="Main navigation"
          className="flex w-full flex-col gap-1"
        >
          {entries.filter((entry) => !entry.auth || signedIn).map(({ label, icon: Icon, to, disabled }) => (
            <Tooltip key={to}>
              <TooltipTrigger
                render={
                  to === "/" && feedUnlock.locked ? (
                    <button
                      type="button"
                      onClick={feedUnlock.unlock}
                      aria-label={`${label}, turned off. Turn it on`}
                      className={`${navItemClass} ${inactiveNavItemClass} opacity-60`}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="hidden items-center gap-2 lg:inline-flex">
                        {label}
                        <BetaTag />
                      </span>
                    </button>
                  ) : disabled ? (
                    <span
                      tabIndex={0}
                      aria-label={`${label}: This feature is planned`}
                      className="block w-full cursor-not-allowed rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <button
                        type="button"
                        disabled
                        aria-label={label}
                        className="pointer-events-none flex h-10 w-full items-center gap-3 rounded-lg px-3 font-medium text-muted-foreground opacity-50"
                      >
                        <Icon className="size-5 shrink-0" />
                        <span className="hidden lg:inline">{label}</span>
                      </button>
                    </span>
                  ) : (
                    <NavLink
                      to={to}
                      end={to === "/"}
                      onPointerEnter={() => preloadRoute(to)}
                      onTouchStart={() => preloadRoute(to)}
                      onFocus={() => preloadRoute(to)}
                      aria-label={(() => { const n = to === "/messages" ? unread : to === "/activity" ? unreadCount : 0; return n > 0 ? `${label}, ${n} unread` : label; })()}
                      className={({ isActive }) =>
                        `${navItemClass} ${isActive ? "bg-muted font-semibold text-foreground" : inactiveNavItemClass}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative shrink-0">
                            <Icon
                              className="size-5 transition-transform duration-200 group-hover/nav:scale-110"
                              strokeWidth={isActive ? 2.25 : 2}
                            />
                            {to === "/activity" && unreadCount > 0 && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-bold text-primary-foreground ring-2 ring-background"
                              >
                                {countLabel(unreadCount)}
                              </span>
                            )}
                            {to === "/messages" && unread > 0 && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-bold text-primary-foreground ring-2 ring-background"
                              >
                                {countLabel(unread)}
                              </span>
                            )}
                          </span>
                          <span className="hidden items-center gap-2 lg:inline-flex">
                            {label}
                            {to === "/" && <BetaTag />}
                          </span>
                        </>
                      )}
                    </NavLink>
                  )
                }
              />
              <TooltipContent
                side="right"
                className={disabled ? "rounded-full" : undefined}
              >
                {disabled ? "This feature is planned" : to === "/" && feedUnlock.locked ? "Turn on the Feed" : label}
              </TooltipContent>
            </Tooltip>
          ))}
          {!profilePath && (
            <Dialog>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DialogTrigger
                      aria-label="Profile"
                      className={`${navItemClass} ${inactiveNavItemClass}`}
                    >
                      <UserRound
                        aria-hidden="true"
                        className="size-5 shrink-0 transition-transform duration-200 group-hover/nav:scale-110"
                      />
                      <span className="hidden lg:inline">Profile</span>
                    </DialogTrigger>
                  }
                />
                <TooltipContent side="right">Profile</TooltipContent>
              </Tooltip>
              <LoginDialogContent
                title="Log in to view your profile"
                description="Sign in with CNS to access your profile."
              />
            </Dialog>
          )}
          {hidden.length > 0 && profilePath && (
            <HiddenNavigation items={hidden} profilePath={profilePath} />
          )}
        </nav>
        {feedUnlock.dialog}
        {newPost && newPost.kind !== "reply" && (
          <Button
            type="button"
            onClick={newPost.open}
            aria-label="Write a new post"
            className="h-11 w-full rounded-full text-base animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
          >
            <Plus className="size-5" aria-hidden="true" strokeWidth={2.5} />
            <span className="hidden lg:inline">Post</span>
          </Button>
        )}
      </div>
      {showAccount && auth && (
        // Pages without the right-hand column keep the account controls here:
        // avatar on the left, menu and bell on the right (stacked when narrow).
        <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-6 lg:flex-row lg:justify-between">
          <AccountMenu auth={auth} />
          <div className="flex flex-col items-center gap-1 lg:flex-row">
            <LegalMenu />
            <NotificationsBell className="size-9" />
          </div>
        </div>
      )}
    </aside>
  );
}
