import { Link, NavLink } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigation } from "./navigation";

export function NavigationSidebar() {
  return (
    <aside
      aria-label="Sidebar"
      className="min-h-0 min-w-0 overflow-hidden p-2 lg:p-3"
    >
      <div className="flex flex-col items-start gap-4">
        <Link
          to="/"
          className="w-fit max-w-full rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-3"
          aria-label="ysocial home"
        >
          <img
            src="/favicon.png"
            alt="ysocial"
            width={48}
            height={48}
            className="lg:hidden"
          />
          <img
            src="/logo.png"
            alt="ysocial"
            width={1708}
            height={644}
            className="hidden h-auto w-32 object-contain object-left lg:block"
          />
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
                      aria-label={label}
                      className={({ isActive }) =>
                        `flex h-10 w-full items-center gap-3 rounded-lg px-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-muted font-bold text-foreground" : "font-medium text-muted-foreground"}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className="size-5 shrink-0"
                            strokeWidth={isActive ? 2.75 : 2}
                          />
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
      </div>
    </aside>
  );
}
