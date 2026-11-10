import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Check, Construction, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { FeedState } from "./use-feed";

export function PostComposer({ feed }: { feed: FeedState }) {
  if (!feed.sessionLoading && !feed.authenticated) {
    return (
      <Dialog>
        <DialogTrigger
          render={
            <button
              type="button"
              className="mx-auto block w-full max-w-xl rounded-[1.75rem] bg-muted px-4 py-4 text-left text-sm leading-5 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring sm:px-5 md:text-base md:leading-6"
            />
          }
        >
          What's on your mind?
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log in to post</DialogTitle>
            <DialogDescription>
              Sign in with CNS to share what's on your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button render={<a href="/auth/login" />}>Log in with CNS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return <AuthenticatedPostComposer feed={feed} />;
}

function AuthenticatedPostComposer({ feed }: { feed: FeedState }) {
  const [focused, setFocused] = useState(false);
  const [published, setPublished] = useState(false);
  const [submittedLength, setSubmittedLength] = useState(0);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const helpId = useId();
  const length = Array.from(feed.draft.trim()).length;
  const expanded = focused || feed.draft.length > 0 || attachmentsOpen;
  const closing = published && !expanded;
  const displayedLength = closing ? submittedLength : length;
  const nearLimit = displayedLength >= 1800;
  const valid = feed.canPost && length > 0 && length <= 2000;

  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    // Measure natural content separately so clearing the draft cannot snap the
    // visible textarea's height before its closing transition runs.
    function resize() {
      if (!input) return;
      const styles = getComputedStyle(input);
      const mirror = document.createElement("textarea");
      mirror.className = input.className;
      mirror.value = input.value;
      mirror.tabIndex = -1;
      mirror.setAttribute("aria-hidden", "true");
      mirror.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;height:0;min-height:0;max-height:none;transition:none;";
      mirror.style.width = `${input.getBoundingClientRect().width}px`;
      input.parentElement?.append(mirror);
      const collapsedHeight =
        parseFloat(styles.lineHeight) +
        parseFloat(styles.paddingTop) +
        parseFloat(styles.paddingBottom);
      const height = expanded
        ? Math.min(
            parseFloat(styles.maxHeight),
            Math.max(96, mirror.scrollHeight),
          )
        : collapsedHeight;
      mirror.remove();
      input.style.height = `${height}px`;
    }
    resize();
    let width = input.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = input.getBoundingClientRect().width;
      if (nextWidth !== width) {
        width = nextWidth;
        resize();
      }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [expanded, feed.draft]);

  useEffect(() => {
    if (!published) return;
    const timer = setTimeout(() => setPublished(false), 2000);
    return () => clearTimeout(timer);
  }, [published]);

  function publish() {
    if (!valid) return;
    const sending = feed.publishPost();
    if (!sending) return;
    textarea.current?.blur();
    setFocused(false);
    setSubmittedLength(length);
    setPublished(true);
  }

  return (
    <Dialog open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
      <form
        className={`mx-auto w-full max-w-xl rounded-[1.75rem] bg-muted px-4 py-2 transition-shadow duration-[420ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none sm:px-5 ${expanded ? "ring-1 ring-border" : ""}`}
        aria-label="Post composer"
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(false);
        }}
      >
        <div className="relative flex items-center gap-2">
          <Textarea
            ref={textarea}
            aria-label="Write a post"
            aria-describedby={helpId}
            aria-invalid={length > 2000}
            placeholder="What's on your mind?"
            rows={1}
            value={feed.draft}
            disabled={!feed.canPost}
            onChange={(event) => {
              setPublished(false);
              feed.setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!event.repeat) void publish();
              }
              if (event.key === "Escape" && !feed.draft) {
                event.currentTarget.blur();
              }
            }}
            className="h-10 max-h-60 min-h-0 min-w-0 flex-1 resize-none field-sizing-fixed rounded-none border-0 bg-transparent py-2 pl-0 pr-6 text-left text-sm shadow-none transition-[height] duration-[420ms] ease-[cubic-bezier(0.65,0,0.35,1)] focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100 motion-reduce:transition-none md:text-base dark:bg-transparent dark:disabled:bg-transparent"
          />
          <Check
            className={`pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-green-600 transition-opacity duration-300 ease-in-out motion-reduce:transition-none dark:text-green-400 ${published && !expanded ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
          />
        </div>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          inert={!expanded}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-1 pt-2">
              <div className="flex items-center gap-2">
                <DialogTrigger
                  render={
                    <IconButton
                      label="Add attachment"
                      type="button"
                      className="text-muted-foreground"
                    />
                  }
                >
                  <Plus />
                </DialogTrigger>
              </div>
              <div className="flex min-h-8 items-center gap-3">
                {nearLimit && (
                  <span
                    className={`text-xs tabular-nums ${length > 2000 ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {displayedLength}/2000
                  </span>
                )}
                <div
                  inert={length === 0}
                  className={`transition-opacity duration-[420ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none ${length > 0 || closing ? "opacity-100" : "pointer-events-none opacity-0"}`}
                >
                  <IconButton
                    label="Publish post"
                    type="submit"
                    variant="default"
                    className="rounded-[1.75rem]"
                    disabled={!valid}
                  >
                    <ArrowUp />
                  </IconButton>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p id={helpId} className="sr-only">
          {feed.canPost
            ? "Enter adds a new line. Press Ctrl+Enter or Command+Enter to post. Maximum 2000 characters."
            : "Sign in and complete your profile to post or reply."}
        </p>
        <p role="status" className="sr-only">
          {published ? "Post added" : ""}
        </p>
      </form>
      <DialogContent>
        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Construction className="size-6" aria-hidden="true" />
        </div>
        <DialogHeader>
          <DialogTitle>Attachments are under construction</DialogTitle>
          <DialogDescription>
            We're working on uploads. You can share a text post for now.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>Got it</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
