import { useEffect, useState, type RefObject } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostComposer } from "./post-composer";
import { setNewPostTarget } from "./new-post-target";
import type { FeedState } from "./use-feed";

const TOP_REVEAL = 8;

export function scrollerOf(element: Element | null) {
  return element?.closest<HTMLElement>(".content-scroll") ?? null;
}

export function scrollFeedToTop(element: Element | null) {
  const scroller = scrollerOf(element);
  if (!scroller) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
}

export function useAtTop(anchor: RefObject<Element | null>, onTop: () => void) {
  useEffect(() => {
    const scroller = scrollerOf(anchor.current);
    if (!scroller) return;
    const check = () => {
      if (scroller.scrollTop <= TOP_REVEAL) onTop();
    };
    scroller.addEventListener("scroll", check, { passive: true });
    return () => scroller.removeEventListener("scroll", check);
  }, [anchor, onTop]);
}

export function useOutOfView(
  target: RefObject<Element | null>,
  active: boolean,
) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = target.current;
    if (!active || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: scrollerOf(element) },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, active]);
  return active && !visible;
}

export function NewPostsNudge({
  count,
  anchor,
  onShow,
}: {
  count: number;
  anchor: RefObject<Element | null>;
  onShow: () => void;
}) {
  return (
    <div
      role="status"
      className="pointer-events-none sticky top-2 z-20 flex h-0 justify-center"
    >
      {count > 0 && (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onShow();
            scrollFeedToTop(anchor.current);
          }}
          className="pointer-events-auto h-9 rounded-full px-3.5 text-sm shadow-lg ring-1 ring-foreground/10 animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none"
        >
          <ArrowUp aria-hidden="true" />
          {count === 1 ? "1 new post" : `${count} new posts`}
        </Button>
      )}
    </div>
  );
}

export function NewPostDialog({
  feed,
  show,
  anchor,
  kind = "post",
}: {
  feed: FeedState;
  show: boolean;
  anchor: RefObject<Element | null>;
  /** A reply composer opens from the mobile nav only; desktop has it inline. */
  kind?: "post" | "reply";
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setNewPostTarget(show ? { open: () => setOpen(true), kind } : null);
    return () => setNewPostTarget(null);
  }, [show, kind]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto pt-12 sm:max-w-lg">
        <DialogHeader className="absolute top-1 left-4 flex h-11 justify-center sm:top-2 sm:h-8">
          <DialogTitle className="text-base font-semibold">
            {kind === "reply" ? "Write a reply" : "Write a post"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {kind === "reply" ? "Write a reply, add a GIF, voice message or poll." : "Write a post, add a GIF, voice message or poll."}
          </DialogDescription>
        </DialogHeader>
        <PostComposer
          feed={feed}
          autoFocus
          placeholder={kind === "reply" ? "Write a reply…" : undefined}
          inspire={kind !== "reply"}
          onSubmitted={() => {
            setOpen(false);
            if (kind === "post") scrollFeedToTop(anchor.current);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
