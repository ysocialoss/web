import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { DisplayName } from "@/components/display-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoadMore } from "@/hooks/use-load-more";
import { api, errorMessage, type ConnectionUser, type Profile } from "@/lib/api";
import { toast } from "@/components/ui/toast-manager";

export type ConnectionList = "followers" | "following";

const emptyText: Record<ConnectionList, string> = {
  followers: "No followers yet.",
  following: "Not following anyone yet.",
};

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: count }, (_, row) => (
        <div key={row} className="flex items-center gap-3 px-2 py-3">
          <Skeleton className="size-9 shrink-0 rounded-[30%] [corner-shape:squircle]" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectionPanel({
  handle,
  list,
  onNavigate,
  canFollow,
}: {
  handle: string;
  list: ConnectionList;
  onNavigate: () => void;
  canFollow: boolean;
}) {
  const [users, setUsers] = useState<ConnectionUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void api.connections(handle, list, { cursor, signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return;
        setUsers((previous) =>
          cursor
            ? [...previous, ...result.users.filter((user) => !previous.some(({ id }) => id === user.id))]
            : result.users,
        );
        setNextCursor(result.nextCursor);
        setLoading(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason));
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [handle, list, cursor, attempt]);
  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setLoading(true);
    setCursor(nextCursor);
  }, [nextCursor]);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  async function toggleFollow(user: ConnectionUser) {
    const next = !user.isFollowing;
    const update = (following: boolean) =>
      setUsers((current) => current.map((entry) => (entry.id === user.id ? { ...entry, isFollowing: following } : entry)));
    setPending((current) => new Set(current).add(user.id));
    update(next);
    try {
      const result = await api.follow(user.handle, next);
      update(result.isFollowing);
    } catch (reason) {
      update(!next);
      toast.add({ title: errorMessage(reason) });
    } finally {
      setPending((current) => {
        const copy = new Set(current);
        copy.delete(user.id);
        return copy;
      });
    }
  }
  const sentinel = useLoadMore(loadMore, Boolean(nextCursor) && !loading && !error);

  return (
    <div className="relative h-full min-h-0 overflow-y-auto overscroll-contain" aria-busy={loading}>
      {loading && users.length === 0 && (
        <LoadingSkeleton label={`Loading ${list}…`}>
          <Rows count={6} />
        </LoadingSkeleton>
      )}
      <ul className="divide-y">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex items-center gap-2 transition-opacity duration-300 ease-in-out starting:opacity-0 motion-reduce:transition-none"
          >
            <Link
              to={`/@${user.handle}`}
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar userId={user.id} className="size-9 shrink-0" aria-hidden="true">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback className="text-xs">{(user.displayName || user.handle).slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  <DisplayName user={user} name={user.displayName || user.handle} />
                </p>
                <p className="truncate text-xs text-muted-foreground">@{user.handle}</p>
                {user.bio && <p className="mt-1 line-clamp-1 text-xs wrap-anywhere">{user.bio}</p>}
              </div>
            </Link>
            {user.isSelf ? (
              <span className="shrink-0 px-2 text-xs text-muted-foreground">You</span>
            ) : canFollow ? (
              <Button
                size="sm"
                variant={user.isFollowing ? "secondary" : "default"}
                aria-pressed={user.isFollowing}
                aria-label={user.isFollowing ? `Unfollow @${user.handle}` : `Follow @${user.handle}`}
                disabled={pending.has(user.id)}
                onClick={() => void toggleFollow(user)}
                className="min-w-24 shrink-0"
              >
                {user.isFollowing ? "Following" : "Follow"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {loading && users.length > 0 && (
        <div role="status" aria-label={`Loading more ${list}`}>
          <Rows count={2} />
        </div>
      )}
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {!loading && !error && users.length === 0 && (
        <p role="status" className="py-6 text-center text-sm text-muted-foreground">
          {emptyText[list]}
        </p>
      )}
      {error && (
        <div className="space-y-2 py-4 text-center">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

const panelClass =
  "col-start-1 row-start-1 min-h-0 transition-opacity duration-300 ease-in-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none";

export function ConnectionsDialog({
  profile,
  list,
  onListChange,
  onClose,
  canFollow,
}: {
  canFollow: boolean;
  profile: Profile["profile"];
  list: ConnectionList | null;
  onListChange: (list: ConnectionList) => void;
  onClose: () => void;
}) {
  const { handle, displayName } = profile;
  return (
    <Dialog open={list !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <DisplayName user={profile} name={displayName || `@${handle}`} />
          </DialogTitle>
          <DialogDescription>People who follow @{handle} and people @{handle} follows.</DialogDescription>
        </DialogHeader>
        <Tabs
          value={list ?? "followers"}
          onValueChange={(value) => onListChange(value as ConnectionList)}
          className="min-w-0 gap-3"
        >
          <TabsList className="w-full rounded-full" aria-label="Connections">
            <TabsTrigger value="followers" className="rounded-full">Followers</TabsTrigger>
            <TabsTrigger value="following" className="rounded-full">Following</TabsTrigger>
          </TabsList>
          <div className="grid h-[min(55dvh,24rem)] min-h-0 overflow-hidden">
            <TabsContent value="followers" keepMounted className={panelClass}>
              <ConnectionPanel handle={handle} list="followers" onNavigate={onClose} canFollow={canFollow} />
            </TabsContent>
            <TabsContent value="following" keepMounted className={panelClass}>
              <ConnectionPanel handle={handle} list="following" onNavigate={onClose} canFollow={canFollow} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
