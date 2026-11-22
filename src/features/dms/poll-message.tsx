import { Check, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WireVote } from "./dm-api";
import type { MessagePoll } from "./message-payload";

export function PollMessage({ poll, votes, selfId, canVote, onVote }: {
  poll: MessagePoll;
  votes: WireVote[];
  selfId: string;
  canVote: boolean;
  onVote: (option: number | null) => void;
}) {
  const mine = votes.find((vote) => vote.userId === selfId)?.option;
  const total = votes.length;
  return (
    <div role="group" aria-label={`Poll: ${poll.title}`} className="w-full max-w-sm space-y-2 rounded-xl border bg-card px-3.5 py-3 text-sm text-card-foreground">
      <p dir="auto" className="flex items-start gap-2 font-semibold wrap-anywhere">
        <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        {poll.title}
      </p>
      <div className="space-y-1.5">
        {poll.options.map((option, index) => {
          const count = votes.filter((vote) => vote.option === index).length;
          const share = total ? Math.round((count / total) * 100) : 0;
          const chosen = mine === index;
          return (
            <button
              key={index}
              type="button"
              disabled={!canVote}
              aria-pressed={chosen}
              onClick={() => onVote(chosen ? null : index)}
              className="relative flex w-full items-center gap-2 overflow-hidden rounded-lg border border-border bg-background px-3 py-2 text-left outline-none transition-colors enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
            >
              <span
                aria-hidden="true"
                className={cn("absolute inset-y-0 left-0 transition-[width] duration-500 ease-out motion-reduce:transition-none", chosen ? "bg-primary/20" : "bg-muted")}
                style={{ width: `${share}%` }}
              />
              <span className="relative flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/60">
                {chosen && <Check aria-hidden="true" className="size-3" />}
              </span>
              <span dir="auto" className="relative min-w-0 flex-1 wrap-anywhere">{option}</span>
              <span className="relative shrink-0 text-xs text-muted-foreground tabular-nums">{share}%</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{total} {total === 1 ? "vote" : "votes"}{canVote ? "" : " · open once accepted"}</p>
    </div>
  );
}
