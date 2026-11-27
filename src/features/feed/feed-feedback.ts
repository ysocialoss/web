import { AlarmClockOff, Hash, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "@/components/ui/toast-manager";
import { api, errorMessage, type FeedFeedbackInput, type Post } from "@/lib/api";
import type { MenuAction } from "@/features/reports/report-menu";

type Dismiss = (match: (post: Post) => boolean) => () => void;

async function send(input: FeedFeedbackInput, postId: string, done: string, restore?: () => void) {
  try {
    const saved = await api.addFeedFeedback(input, postId);
    toast.add({
      title: done,
      timeout: 6000,
      actionProps: {
        children: "Undo",
        onClick: () => {
          restore?.();
          const previous = saved.previousDirection;
          const undo = previous !== null && input.kind !== "snooze"
            ? api.addFeedFeedback({ ...input, direction: previous }, postId)
            : api.removeFeedFeedback(saved.id);
          void undo.catch((reason) => {
            toast.add({ type: "error", title: "Couldn't undo", description: errorMessage(reason) });
          });
        },
      },
    });
  } catch (reason) {
    restore?.();
    toast.add({ type: "error", title: "Couldn't save that", description: errorMessage(reason) });
  }
}

export function feedbackActions(post: Post, dismiss: Dismiss): MenuAction[] {
  return [
    {
      label: "Interested",
      icon: ThumbsUp,
      immediate: true,
      onSelect: () => void send({ kind: "post", postId: post.id, direction: 1 }, post.id, "You'll see more posts like this."),
    },
    {
      label: "Not interested",
      icon: ThumbsDown,
      immediate: true,
      onSelect: () => {
        const restore = dismiss((entry) => entry.id === post.id);
        void send({ kind: "post", postId: post.id, direction: -1 }, post.id, "Post removed from your Feed.", restore);
      },
    },
    {
      label: `Snooze @${post.author.handle} for 30 days`,
      icon: AlarmClockOff,
      immediate: true,
      onSelect: () => {
        const restore = dismiss((entry) => entry.author.id === post.author.id);
        void send({ kind: "snooze", authorId: post.author.id }, post.id, `@${post.author.handle} is snoozed for 30 days.`, restore);
      },
    },
    ...post.topics.slice(0, 2).map((topic): MenuAction => ({
      label: `Fewer about #${topic}`,
      icon: Hash,
      immediate: true,
      onSelect: () => void send({ kind: "topic", topic, direction: -1 }, post.id, `You'll see fewer posts about #${topic}.`),
    })),
  ];
}
