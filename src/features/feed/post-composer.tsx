import { useRef } from "react";
import { Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import type { FeedState } from "./use-feed";

export function PostComposer({
  draft,
  setDraft,
  publishPost,
}: Pick<FeedState, "draft" | "setDraft" | "publishPost">) {
  const attachmentInput = useRef<HTMLInputElement>(null);
  return (
    <div className="mx-auto flex min-h-14 w-full max-w-xl items-center gap-2 rounded-[1.75rem] bg-muted px-3 py-2 sm:gap-3 sm:px-4">
      <Avatar className="size-8" aria-label="User avatar">
        <AvatarFallback>
          <UserRound className="size-5" />
        </AvatarFallback>
      </Avatar>
      <Textarea
        aria-label="Write a post"
        placeholder="On your mind?"
        rows={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            event.ctrlKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!event.repeat) publishPost();
          }
        }}
        className="max-h-60 min-h-9 min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent text-center text-sm shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
      />
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full text-muted-foreground"
        aria-label="Add attachment"
        onClick={() => attachmentInput.current?.click()}
      >
        <Plus className="size-6" />
      </Button>
      <input
        ref={attachmentInput}
        type="file"
        className="hidden"
        aria-label="Choose attachment"
      />
    </div>
  );
}
