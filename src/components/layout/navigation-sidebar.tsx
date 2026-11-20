import type { MouseEventHandler } from "react";
import { Plus } from "lucide-react";
import { Link, NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { useNewPostTarget } from "@/features/feed/new-post-target";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigation } from "./navigation";
import { countLabel, useDmUnread } from "@/features/dms/dm-unread";
import { LegalMenu } from "./legal-menu";
import { AccountMenu } from "@/features/auth/account-menu";
import type { AuthState } from "@/features/auth/use-auth";
import { NotificationsBell } from "@/features/notifications/notifications";
import { SiteWordmark } from "./site-wordmark";

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
  return (
    <aside
      aria-label="Sidebar"
      className="hidden min-h-0 min-w-0 flex-col overflow-y-auto p-2 md:flex lg:p-3"
    >
      <div className="flex flex-col items-start gap-4">
        <Link
          to="/"
          className="w-fit max-w-full rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3"
          aria-label="ysocial home"
          onClick={onLogoClick}
        >
          <img
            src="/favicon.png"
            alt="ysocial"
            width={48}
            height={48}
            className="lg:hidden"
          />
          <SiteWordmark className="hidden w-32 lg:block" />
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex w-full flex-col gap-1"
        >
          {navigation.map(({ label, icon: Icon, to, disabled }) => (
            <Tooltip key={to}>
              <TooltipTrigger
                render={
                  disabled ? (
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
                      aria-label={to === "/messages" && unread > 0 ? `${label}, ${unread} unread` : label}
                      className={({ isActive }) =>
                        `group/nav flex h-10 w-full items-center gap-3 rounded-lg px-3 outline-none transition-[background-color,color,transform] duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] ${isActive ? "bg-muted font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground"}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative shrink-0">
                            <Icon
                              className="size-5 transition-transform duration-200 group-hover/nav:scale-110"
                              strokeWidth={isActive ? 2.25 : 2}
                            />
                            {to === "/messages" && unread > 0 && (
                              <span
                                aria-hidden="true"
                                className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-bold text-primary-foreground ring-2 ring-background"
                              >
                                {countLabel(unread)}
                              </span>
                            )}
                          </span>
                          <span className="hidden lg:inline">{label}</span>
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
                {disabled ? "This feature is planned" : label}
              </TooltipContent>
            </Tooltip>
          ))}
        </nav>
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
