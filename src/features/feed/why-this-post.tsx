import { Link } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FeedReason, RepostContext } from "@/lib/api";
import type { FeedSurface } from "./tracking/tracker";

export const explainedSurfaces = new Set<FeedSurface>(["following", "for_you"]);

const reasonText: Record<FeedReason, (authorHandle: string) => string> = {
  following: (handle) => `You follow @${handle}, and posts from people you follow rank higher.`,
  network: () => "Someone you follow reposted it.",
  conversation: () => "People you follow are replying to it.",
  social: () => "People you follow liked it.",
  nearby: (handle) => `People you follow often engage with @${handle}.`,
  popular: () => "It is getting a lot of likes, replies and reposts right now.",
  recent: () => "It was posted recently.",
  explore: () => "It is a small random pick, so your feed does not only show more of the same.",
};

export function whyThisPost(
  surface: FeedSurface,
  authorHandle: string,
  repost: RepostContext | null,
  reason?: FeedReason,
) {
  const reposted = repost
    ? `@${repost.by.handle} reposted it${repost.others ? ` (and ${repost.others} more)` : ""}.`
    : null;
  if (surface === "following")
    return [`It is in your Following feed because ${repost ? "someone you follow shared it" : `you follow @${authorHandle} or it is your own post`}.`, reposted]
      .filter(Boolean).join(" ");
  const main = reason ? reasonText[reason](authorHandle) : "This post was picked for you by the ranked feed.";
  return [main, reason !== "network" ? reposted : null].filter(Boolean).join(" ");
}

export function WhyThisPostDialog({
  open,
  onOpenChange,
  surface,
  authorHandle,
  repost,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: FeedSurface;
  authorHandle: string;
  repost: RepostContext | null;
  reason?: FeedReason;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why am I seeing this?</DialogTitle>
          <DialogDescription className="leading-relaxed">{whyThisPost(surface, authorHandle, repost, reason)}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Learn more in <Link to="/legal/feed?lang=en" className="underline underline-offset-4" onClick={() => onOpenChange(false)}>How the feed works</Link>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
