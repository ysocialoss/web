import { useRef, useState, type ComponentType } from "react";
import {
  Ban,
  Ellipsis,
  Flag,
  Link2,
  ShieldCheck,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-manager";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  loadProfileCard,
  patchProfileCard,
  useProfileCard,
} from "@/features/profile/profile-card-cache";
import { api, errorMessage } from "@/lib/api";
import { writeClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { setBlocked, useBlockedUser } from "./blocked-users";
import { ReportDialog, type ReportSubject } from "./report-dialog";

const subjectNoun = (subject: ReportSubject) =>
  subject.type === "post" ? subject.kind : subject.type === "user" ? "profile" : "message";

export type BlockTarget = { id: string; handle: string; blocking?: boolean };
export type MenuAction = {
  label: string;
  icon: ComponentType<{ "aria-hidden"?: boolean }>;
  onSelect: () => void;
  immediate?: boolean;
};

export function copyLinkAction(path: string, label = "Copy link"): MenuAction {
  return {
    label,
    icon: Link2,
    immediate: true,
    onSelect: () => {
      void writeClipboard(new URL(path, window.location.origin).href).then(
        () => toast.add({ title: "Link copied" }),
        (reason: unknown) => toast.add({ type: "error", title: errorMessage(reason) }),
      );
    },
  };
}

type Row =
  | { kind: "item"; key: string; icon: ComponentType<{ "aria-hidden"?: boolean }>; label: string; destructive?: boolean; immediate?: boolean; onSelect: () => void }
  | { kind: "pending"; key: string }
  | { kind: "separator"; key: string };

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
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [wantsFollow, setWantsFollow] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);
  const blockedHere = useBlockedUser(block?.id ?? "");
  const blocking = Boolean(block && (block.blocking ?? blockedHere));
  const showFollow = Boolean(follow) && !blocking;
  const { card, failed } = useProfileCard(
    follow?.handle ?? "",
    showFollow && (wantsFollow || open),
  );
  const following = followOverride ?? card?.isFollowing ?? false;
  const followReady = showFollow && card && !card.isSelf && card.signedIn;
  const followLoading = showFollow && !card && !failed;

  function warm() {
    if (!showFollow || !follow) return;
    setWantsFollow(true);
    void loadProfileCard(follow.handle).catch(() => undefined);
  }

  async function toggleFollow() {
    if (!follow) return;
    const next = !following;
    setFollowOverride(next);
    try {
      const result = await api.follow(follow.handle, next);
      setFollowOverride(result.isFollowing);
      patchProfileCard(follow.handle, {
        isFollowing: result.isFollowing,
        isFollowedBy: result.isFollowedBy,
      });
      toast.add({
        title: result.isFollowing ? `Following @${follow.handle}` : `Unfollowed @${follow.handle}`,
      });
    } catch (reason) {
      setFollowOverride(!next);
      toast.add({ type: "error", title: errorMessage(reason) });
    }
  }

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

  const rows: Row[] = [
    ...actions.map(({ label: text, icon, onSelect, immediate }): Row => ({
      kind: "item",
      key: `action:${text}`,
      icon,
      label: text,
      immediate,
      onSelect,
    })),
    ...(followLoading
      ? [{ kind: "pending", key: "follow" } as const]
      : followReady
        ? [
            {
              kind: "item",
              key: "follow",
              icon: following ? UserCheck : UserPlus,
              label: `${following ? "Unfollow" : "Follow"} @${follow?.handle}`,
              immediate: true,
              onSelect: () => void toggleFollow(),
            } as const,
          ]
        : []),
  ];
  const moderation: Row[] = [
    ...(block
      ? [
          {
            kind: "item",
            key: "block",
            icon: blocking ? ShieldCheck : Ban,
            label: `${blocking ? "Unblock" : "Block"} @${block.handle}`,
            destructive: !blocking,
            immediate: blocking,
            onSelect: () => (blocking ? void toggleBlock() : setConfirming(true)),
          } as const,
        ]
      : []),
    ...(subject
      ? [
          {
            kind: "item",
            key: "report",
            icon: Flag,
            label: `Report ${subjectNoun(subject)}`,
            destructive: true,
            onSelect: () => setReporting(true),
          } as const,
        ]
      : []),
  ];
  const all: Row[] =
    rows.length > 0 && moderation.length > 0
      ? [...rows, { kind: "separator", key: "separator" }, ...moderation]
      : [...rows, ...moderation];

  function select(row: Extract<Row, { kind: "item" }>) {
    setOpen(false);
    if (row.immediate || !mobile) row.onSelect();
    else afterClose.current = row.onSelect;
  }

  const trigger = (
    <IconButton
      variant="ghost"
      size="icon-sm"
      label={label}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      onPointerEnter={warm}
      onPointerDown={warm}
      onTouchStart={warm}
      onFocus={warm}
    >
      <Ellipsis aria-hidden="true" />
    </IconButton>
  );

  return (
    <>
      {mobile ? (
        <Drawer
          showSwipeHandle
          open={open}
          onOpenChange={setOpen}
          onOpenChangeComplete={(isOpen) => {
            if (isOpen) return;
            const run = afterClose.current;
            afterClose.current = null;
            run?.();
          }}
        >
          <DrawerTrigger render={trigger} />
          <DrawerContent aria-describedby={undefined}>
            <DrawerTitle className="sr-only">{label}</DrawerTitle>
            <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {all.map((row) => {
                if (row.kind === "separator")
                  return <div key={row.key} role="separator" className="my-2 border-t" />;
                if (row.kind === "pending")
                  return (
                    <div key={row.key} role="status" aria-label="Loading follow status" className="flex h-12 items-center gap-3 px-2.5">
                      <Skeleton className="size-5 rounded-full" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  );
                const Icon = row.icon;
                return (
                  <DrawerClose
                    key={row.key}
                    nativeButton
                    onClick={() => select(row)}
                    render={
                      <Button
                        variant="ghost"
                        className={cn(
                          "min-h-12 w-full cursor-pointer justify-start gap-3 text-base [&_svg:not([class*='size-'])]:size-5",
                          row.destructive && "text-destructive hover:text-destructive",
                        )}
                      />
                    }
                  >
                    <Icon aria-hidden={true} />
                    {row.label}
                  </DrawerClose>
                );
              })}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger render={trigger} />
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            {all.map((row) => {
              if (row.kind === "separator") return <DropdownMenuSeparator key={row.key} />;
              if (row.kind === "pending")
                return (
                  <div key={row.key} role="status" aria-label="Loading follow status" className="flex h-8 items-center gap-2 px-1.5">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                );
              const Icon = row.icon;
              return (
                <DropdownMenuItem
                  key={row.key}
                  variant={row.destructive ? "destructive" : "default"}
                  onClick={() => select(row)}
                >
                  <Icon aria-hidden={true} />
                  {row.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
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
