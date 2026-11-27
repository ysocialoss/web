import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type FeedFactorKind, type FeedReason, type FeedWhy, type RepostContext } from "@/lib/api";
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
  topic: () => "It is about a topic you asked to see more of.",
  control: (handle) => `You said you are interested in posts like this or from @${handle}.`,
};

const factorText: Record<FeedFactorKind, (handle: string) => string> = {
  following: (handle) => `You follow @${handle}`,
  social: () => "People you follow liked or reposted it",
  conversation: () => "People you follow are in the conversation",
  affinity: (handle) => `You often interact with @${handle}`,
  topic: () => "It matches topics you engage with",
  popular: () => "It is popular right now",
  recent: () => "It is recent",
  network: (handle) => `People you follow engage with @${handle}`,
  format: () => "You tend to open posts like this one",
  explore: () => "It is a random pick to keep your Feed varied",
  control: () => "Your Feed controls",
};
const strengthText = { high: "Strong reason", medium: "Some influence", low: "Small influence" } as const;
const sliderNames = { discovery: "Discovery", freshness: "Freshness", replies: "Replies" } as const;

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

function Explanation({ why, authorHandle }: { why: FeedWhy; authorHandle: string }) {
  const tuned = (Object.keys(sliderNames) as (keyof typeof sliderNames)[]).filter((key) => why.controls.sliders[key] !== 0);
  return (
    <div className="space-y-3 text-sm">
      {!!why.factors.length && (
        <ul className="space-y-1.5" aria-label="What ranked this post">
          {why.factors.map((factor) => (
            <li key={factor.kind} className="flex items-baseline justify-between gap-3">
              <span>{factorText[factor.kind](authorHandle)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{strengthText[factor.strength]}</span>
            </li>
          ))}
        </ul>
      )}
      {(why.controls.author || why.controls.topics.length > 0 || tuned.length > 0) && (
        <div className="rounded-lg border px-3 py-2">
          <p className="font-medium">Your controls</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {why.controls.author && (
              <li>{why.controls.author === "more" ? `You asked for more like posts from @${authorHandle}.` : `You marked posts from @${authorHandle} as not interesting.`}</li>
            )}
            {why.controls.topics.map((entry) => (
              <li key={entry.topic}>{entry.direction === "more" ? `More about #${entry.topic}` : `Fewer about #${entry.topic}`}</li>
            ))}
            {tuned.map((key) => (
              <li key={key}>{sliderNames[key]}: {why.controls.sliders[key] > 0 ? "more" : "less"}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function WhyThisPostDialog({
  open,
  onOpenChange,
  surface,
  authorHandle,
  repost,
  reason,
  postId,
  requestId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surface: FeedSurface;
  authorHandle: string;
  repost: RepostContext | null;
  reason?: FeedReason;
  postId?: string;
  requestId?: string | null;
}) {
  const [why, setWhy] = useState<{ key: string; value: FeedWhy | null } | null>(null);
  const key = postId && requestId ? `${postId}:${requestId}` : null;
  useEffect(() => {
    if (!open || !key || !postId || !requestId || why?.key === key) return;
    const controller = new AbortController();
    api.feedWhy(postId, requestId, controller.signal)
      .then((value) => setWhy({ key, value }))
      .catch(() => {
        if (!controller.signal.aborted) setWhy({ key, value: null });
      });
    return () => controller.abort();
  }, [open, key, postId, requestId, why?.key]);
  const loaded = why && why.key === key ? why.value : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why am I seeing this?</DialogTitle>
          <DialogDescription className="leading-relaxed">{whyThisPost(surface, authorHandle, repost, reason)}</DialogDescription>
        </DialogHeader>
        {loaded && <Explanation why={loaded} authorHandle={authorHandle} />}
        <p className="text-sm text-muted-foreground">
          Learn more in <Link to="/legal/feed?lang=en" className="underline underline-offset-4" onClick={() => onOpenChange(false)}>How the feed works</Link>
          {surface === "for_you" && (
            <>, or change what you see in <Link to="/settings/feed" className="underline underline-offset-4" onClick={() => onOpenChange(false)}>Feed settings</Link></>
          )}.
        </p>
      </DialogContent>
    </Dialog>
  );
}
