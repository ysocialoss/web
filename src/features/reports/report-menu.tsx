import { useState, type ComponentType } from "react";
import { Ban, Ellipsis, Flag, ShieldCheck, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast-manager";
import { patchProfileCard, useProfileCard } from "@/features/profile/profile-card-cache";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { setBlocked, useBlockedUser } from "./blocked-users";
import { ReportDialog, type ReportSubject } from "./report-dialog";

const subjectNoun = (subject: ReportSubject) =>
  subject.type === "post" ? subject.kind : subject.type === "user" ? "profile" : "message";

export type BlockTarget = { id: string; handle: string; blocking?: boolean };
export type MenuAction = { label: string; icon: ComponentType<{ "aria-hidden"?: boolean }>; onSelect: () => void };

function FollowItem({ handle, enabled }: { handle: string; enabled: boolean }) {
  const { card } = useProfileCard(handle, enabled);
  const [override, setOverride] = useState<boolean | null>(null);
  const following = override ?? card?.isFollowing ?? false;
  if (!card || card.isSelf || !card.signedIn) return null;
  async function toggle() {
    const next = !following;
    setOverride(next);
    try {
      const result = await api.follow(handle, next);
      setOverride(result.isFollowing);
      patchProfileCard(handle, { isFollowing: result.isFollowing, isFollowedBy: result.isFollowedBy });
      toast.add({ title: result.isFollowing ? `Following @${handle}` : `Unfollowed @${handle}` });
    } catch (reason) {
      setOverride(!next);
      toast.add({ type: "error", title: errorMessage(reason) });
    }
  }
  return (
    <DropdownMenuItem onClick={() => void toggle()}>
      {following ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
      {following ? "Unfollow" : "Follow"} @{handle}
    </DropdownMenuItem>
  );
}

export function ReportMenu({
  subject,
  block,
  onBlockChange,
  follow,
  actions = [],
  label = "More options",
  className,
}: {
  subject?: ReportSubject;
  block?: BlockTarget;
  onBlockChange?: (blocking: boolean) => void;
  follow?: { handle: string };
  actions?: MenuAction[];
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const blockedHere = useBlockedUser(block?.id ?? "");
  const blocking = Boolean(block && (block.blocking ?? blockedHere));

  async function toggleBlock() {
    if (!block) return false;
    setError("");
    try {
      const next = await setBlocked(block, !blocking);
      onBlockChange?.(next);
      toast.add({
        title: next ? `Blocked @${block.handle}` : `Unblocked @${block.handle}`,
        description: next ? "You won't see their posts, and they can't interact with you." : undefined,
      });
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    }
  }

  const moderation = Boolean(block || subject);
  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              className={cn("text-muted-foreground hover:text-foreground", className)}
            />
          }
        >
          <Ellipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-48">
          {actions.map(({ label: text, icon: Icon, onSelect }) => (
            <DropdownMenuItem key={text} onClick={onSelect}>
              <Icon aria-hidden={true} />
              {text}
            </DropdownMenuItem>
          ))}
          {follow && !blocking && <FollowItem handle={follow.handle} enabled={open} />}
          {(actions.length > 0 || follow) && moderation && <DropdownMenuSeparator />}
          {block && (
            <DropdownMenuItem
              variant={blocking ? "default" : "destructive"}
              onClick={() => (blocking ? void toggleBlock() : setConfirming(true))}
            >
              {blocking ? <ShieldCheck aria-hidden="true" /> : <Ban aria-hidden="true" />}
              {blocking ? "Unblock" : "Block"} @{block.handle}
            </DropdownMenuItem>
          )}
          {subject && (
            <DropdownMenuItem variant="destructive" onClick={() => setReporting(true)}>
              <Flag aria-hidden="true" />
              Report {subjectNoun(subject)}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {subject && <ReportDialog subject={subject} open={reporting} onOpenChange={setReporting} />}
      {block && (
        <ConfirmationDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={`Block @${block.handle}?`}
          description="They won't be able to follow you, message you, or like, reply to or quote your posts, and you won't see their posts. Existing follows between you are removed. They aren't told."
          confirmLabel="Block"
          destructive
          error={error}
          onConfirm={toggleBlock}
        />
      )}
    </>
  );
}
