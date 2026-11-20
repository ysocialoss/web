import { useState } from "react";
import {
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  UserPlus,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "./notifications-context";
import { PushSettings } from "./push-settings";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

const kinds = {
  like: {
    icon: Heart,
    text: "liked your post",
    color: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  },
  repost: {
    icon: Repeat2,
    text: "reposted your post",
    color:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  quote: {
    icon: Quote,
    text: "quoted your post",
    color:
      "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  },
  reply: {
    icon: MessageCircle,
    text: "replied to your post",
    color: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  },
  mention: {
    icon: MessageCircle,
    text: "mentioned you in a post",
    color: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  },
  follow: {
    icon: UserPlus,
    text: "followed you",
    color:
      "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  },
};

function NotificationsContent({ onNavigate }: { onNavigate?: () => void }) {
  const { items, loading, nextCursor, error, refresh, markRead, signedIn, canWrite, hideContent } =
    useNotifications();
  const navigate = useNavigate();
  const visible = items;
  if (!signedIn)
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Sign in and choose your handle to see your notifications.
      </p>
    );
  return (
    <>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        aria-busy={loading}
      >
        {loading && items.length === 0 && (
          <div
            className="space-y-5 p-4"
            role="status"
            aria-label="Loading notifications"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
        <ul className="divide-y">
          {visible.map((item) => {
            const kind = kinds[item.kind],
              Icon = kind.icon;
            return (
              <li
                key={item.id}
                className={cn("relative", !item.readAt && "bg-primary/5")}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => {
                    if (!item.readAt) void markRead(item.id);
                    onNavigate?.();
                    navigate(
                      item.postId
                        ? `/posts/${item.postId}`
                        : `/@${item.actor.handle}`,
                    );
                  }}
                >
                  <div className="relative shrink-0">
                    <Avatar className="size-10">
                      {item.actor.avatarUrl && (
                        <AvatarImage src={item.actor.avatarUrl} alt="" />
                      )}
                      <AvatarFallback>
                        {(item.actor.displayName || item.actor.handle).slice(
                          0,
                          2,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-background",
                        kind.color,
                      )}
                    >
                      <Icon className="size-3" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">
                        {item.actor.displayName || item.actor.handle}
                      </span>{" "}
                      {kind.text}
                    </p>
                    {!hideContent && item.preview && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.preview}
                      </p>
                    )}
                    <time
                      dateTime={item.createdAt}
                      className="mt-1.5 block text-xs text-muted-foreground"
                    >
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                  </div>
                  {!item.readAt && <span className="sr-only">Unread</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {!loading && !error && visible.length === 0 && (
          <div
            role="status"
            className="flex flex-col items-center gap-2 px-6 py-12 text-center"
          >
            <span className="mb-1 rounded-full bg-muted p-4">
              <Bell className="size-6 text-muted-foreground" />
            </span>
            <p className="font-medium">No notifications yet</p>
            <p className="max-w-64 text-sm text-muted-foreground">
              When someone interacts with you, you'll see it here.
            </p>
          </div>
        )}
        {error && (
          <div className="space-y-2 p-4 text-center">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        )}
        {nextCursor && !error && loading && items.length > 0 && (
          <div
            className="space-y-5 p-4"
            role="status"
            aria-label="Loading more notifications"
          >
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
        {nextCursor && !error && !loading && (
          <Button
            variant="ghost"
            className="my-2 w-full"
            onClick={() => void refresh(nextCursor)}
          >
            Load more
          </Button>
        )}
      </div>
      {canWrite && <div className="shrink-0 border-t p-3">
        <PushSettings />
      </div>}
    </>
  );
}

function MarkAllRead() {
  const { busy, unreadCount, items, markRead, canWrite } = useNotifications();
  if (!canWrite) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy || unreadCount === 0 || items.length === 0}
      onClick={() => void markRead()}
      aria-label="Mark all notifications as read"
    >
      <CheckCheck aria-hidden="true" />
      <span className="text-xs">Mark all read</span>
    </Button>
  );
}

export function NotificationsBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { unreadCount, refresh, signedIn } = useNotifications();
  if (!signedIn) return null;
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void refresh();
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", className)}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          />
        }
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="h-[min(42rem,80dvh)] w-[min(26rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <PopoverTitle className="text-lg font-semibold">
              Notifications
            </PopoverTitle>
            <PopoverDescription className="sr-only">
              Your latest activity and browser notification settings.
            </PopoverDescription>
          </div>
          <div className="flex items-center gap-1">
            <MarkAllRead />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>
        </div>
        {open && <NotificationsContent onNavigate={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

export function NotificationsPage() {
  usePageTitle("Notifications");
  return (
    <div className="mx-auto flex h-[min(48rem,80dvh)] max-w-xl flex-col overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <MarkAllRead />
      </div>
      <NotificationsContent />
    </div>
  );
}
