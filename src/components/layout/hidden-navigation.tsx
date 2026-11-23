import { useId, useState } from "react";
import { ChevronDown, Ellipsis } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { NavLink } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  floatingNavigationIconClass,
  floatingNavigationItemClass,
} from "@/components/ui/floating-navigation";
import { countLabel, useDmUnread } from "@/features/dms/dm-unread";
import { useNotifications } from "@/features/notifications/notifications-context";
import type { NavigationItem } from "@/lib/navigation-items";
import { cn } from "@/lib/utils";
import { preloadRoute } from "@/routes";
import { navigation } from "./navigation";

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
const spring = {
  type: "spring",
  stiffness: 390,
  damping: 34,
  mass: 0.75,
} as const;

export function HiddenNavigation({
  items,
  profilePath,
  mobile = false,
}: {
  items: readonly NavigationItem[];
  profilePath: string;
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reduceMotion = useReducedMotion();
  if (!mobile) {
    return (
      <div>
        <motion.button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={spring}
          className="group flex h-11 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg text-center text-[0.625rem] leading-tight font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground aria-expanded:shadow-[inset_0_1px_0_var(--color-background)] lg:h-10 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
        >
          <motion.span
            aria-hidden="true"
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : spring}
            className="shrink-0"
          >
            <ChevronDown className="size-4 lg:size-5" />
          </motion.span>
          <span>{open ? "Show fewer" : "Show hidden"}</span>
        </motion.button>
        <motion.div
          id={panelId}
          inert={!open}
          aria-hidden={!open}
          initial={false}
          animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { height: spring, opacity: { duration: 0.16 } }
          }
          className="overflow-hidden"
        >
          <HiddenShortcutList
            items={items}
            profilePath={profilePath}
            open={open}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="Show hidden"
            className={cn(
              floatingNavigationItemClass,
              "shrink-0 cursor-pointer",
            )}
          />
        }
      >
        <span aria-hidden="true" className={floatingNavigationIconClass}>
          <Ellipsis />
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="pr-10">
          <DialogTitle>Hidden shortcuts</DialogTitle>
        </DialogHeader>
        <HiddenShortcutList
          items={items}
          profilePath={profilePath}
          open={open}
          onNavigate={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function HiddenShortcutList({
  items,
  profilePath,
  open,
  onNavigate,
}: {
  items: readonly NavigationItem[];
  profilePath: string;
  open: boolean;
  onNavigate?: () => void;
}) {
  const { unread } = useDmUnread();
  const { unreadCount } = useNotifications();
  const reduceMotion = useReducedMotion();
  const inline = !onNavigate;
  const animateRows = inline && !reduceMotion;
  const shortcutClass = cn(
    rowClass,
    inline && "relative max-lg:justify-center max-lg:px-0",
  );
  return (
    <ul
      aria-label="Hidden shortcuts"
      className={cn(
        "space-y-1",
        inline &&
          "mt-1 rounded-xl border border-border/70 bg-linear-to-b from-muted/55 to-muted/20 p-1 shadow-[inset_0_1px_0_var(--color-background)]",
      )}
    >
      {items.map((id, index) => {
        const { label, to: route, icon: Icon, disabled } = navigation[id];
        const to = id === "profile" ? profilePath : route;
        const badge =
          id === "messages" ? unread : id === "activity" ? unreadCount : 0;
        const content = (
          <>
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className={cn("flex-1", inline && "max-lg:sr-only")}>
              {label}
            </span>
            {badge > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground",
                  inline && "max-lg:absolute max-lg:top-0 max-lg:right-0",
                )}
              >
                {countLabel(badge)}
              </span>
            )}
          </>
        );

        return (
          <motion.li
            key={id}
            initial={animateRows ? { opacity: 0, y: -6 } : false}
            animate={
              inline
                ? {
                    opacity: open ? 1 : 0,
                    y: open || reduceMotion ? 0 : -6,
                  }
                : undefined
            }
            transition={
              !animateRows
                ? { duration: 0 }
                : {
                    opacity: {
                      duration: 0.15,
                      delay: open ? index * 0.025 : 0,
                    },
                    y: { ...spring, delay: open ? index * 0.025 : 0 },
                  }
            }
          >
            {disabled ? (
              <button
                type="button"
                disabled
                title={inline ? label : undefined}
                className={cn(shortcutClass, "text-left opacity-50")}
              >
                {content}
              </button>
            ) : (
              <NavLink
                to={to}
                end={to === "/"}
                state={onNavigate ? { navigationTab: true } : undefined}
                onClick={onNavigate}
                onPointerEnter={() => preloadRoute(to)}
                onTouchStart={() => preloadRoute(to)}
                onFocus={() => preloadRoute(to)}
                aria-label={badge > 0 ? `${label}, ${badge} unread` : undefined}
                title={inline ? label : undefined}
                className={cn(
                  shortcutClass,
                  "transition-colors hover:bg-background/80 aria-[current=page]:bg-background",
                )}
              >
                {content}
              </NavLink>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
