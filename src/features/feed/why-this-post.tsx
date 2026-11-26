import { Link } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RepostContext } from "@/lib/api";
import type { FeedSurface } from "./tracking/tracker";

export const explainedSurfaces = new Set<FeedSurface>(["latest", "following", "for_you"]);

export function whyThisPost(surface: FeedSurface, authorHandle: string, repost: RepostContext | null) {
  const reason = repost
    ? `@${repost.by.handle} reposted it${repost.others ? ` (and ${repost.others} more)` : ""}.`
    : null;
  if (surface === "following")
    return [`It is in your Following feed because ${repost ? "someone you follow shared it" : `you follow @${authorHandle} or it is your own post`}.`, reason]
      .filter(Boolean).join(" ");
  if (surface === "latest")
    return ["Latest shows every public post, newest first. Nothing about you is used to choose or order it.", reason]
      .filter(Boolean).join(" ");
  return "This post was picked for you based on how you use ysocial.";
}

export function WhyThisPostDialog({
  open,
  onOpenChange,
  surface,
  authorHandle,
  repost,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: FeedSurface;
  authorHandle: string;
  repost: RepostContext | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why am I seeing this?</DialogTitle>
          <DialogDescription className="leading-relaxed">{whyThisPost(surface, authorHandle, repost)}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Learn more in <Link to="/legal/feed?lang=en" className="underline underline-offset-4" onClick={() => onOpenChange(false)}>How the feed works</Link>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
