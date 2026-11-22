import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { setBlocked } from "./blocked-users";

type BlockedUser = Awaited<ReturnType<typeof api.blocks>>["users"][number];

function BlockedList({ onNavigate }: { onNavigate: () => void }) {
  const [users, setUsers] = useState<(BlockedUser & { unblocked?: boolean })[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api.blocks(controller.signal).then(
      (result) => setUsers(result.users),
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      },
    );
    return () => controller.abort();
  }, []);

  async function toggle(user: BlockedUser & { unblocked?: boolean }) {
    setBusy(user.id);
    setError("");
    try {
      const blocking = await setBlocked(user, Boolean(user.unblocked));
      setUsers((current) => current?.map((entry) => (entry.id === user.id ? { ...entry, unblocked: !blocking } : entry)) ?? null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  if (error && !users) return <p role="alert" className="py-4 text-sm text-destructive">{error}</p>;
  if (!users)
    return (
      <div role="status" aria-label="Loading blocked accounts" className="space-y-3 py-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-[30%]" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  if (!users.length)
    return (
      <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="rounded-full bg-muted p-3"><Ban className="size-5 text-muted-foreground" aria-hidden="true" /></span>
        <p className="font-medium">You haven't blocked anyone</p>
        <p className="max-w-64 text-sm text-muted-foreground">Block someone from the ⋯ menu on their profile or posts.</p>
      </div>
    );
  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ul className="max-h-[50dvh] divide-y overflow-y-auto overscroll-contain">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 py-2.5">
            <Link to={`/@${user.handle}`} onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-9 shrink-0" aria-hidden="true">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                <AvatarFallback className="text-xs">{(user.displayName || user.handle).slice(0, 2)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.displayName || user.handle}</span>
                <span className="block truncate text-xs text-muted-foreground">@{user.handle}</span>
              </span>
            </Link>
            <Button
              size="sm"
              variant={user.unblocked ? "destructive" : "outline"}
              disabled={busy === user.id}
              onClick={() => void toggle(user)}
              aria-label={user.unblocked ? `Block @${user.handle} again` : `Unblock @${user.handle}`}
            >
              {user.unblocked ? "Block" : "Unblock"}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function BlockedAccountsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Blocked accounts</DialogTitle>
          <DialogDescription>
            Blocked people can't follow you, message you, or interact with your posts, and their posts are hidden from you.
          </DialogDescription>
        </DialogHeader>
        {open && <BlockedList onNavigate={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
