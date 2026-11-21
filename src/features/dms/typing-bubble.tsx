import type { DmUser } from "./dm-api";
import { nameOf, PersonAvatar } from "./message-row";

export function TypingBubble({ user }: { user: DmUser }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2.5 px-2 pt-2 pb-1">
      <PersonAvatar user={user} className="size-7 self-end justify-self-center" />
      <div role="status" className="origin-bottom-left animate-[typing-pop_320ms_cubic-bezier(0.34,1.56,0.64,1)_both] motion-reduce:animate-none">
        <span className="sr-only">{nameOf(user)} is typing</span>
        <span aria-hidden="true" className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="size-1.5 rounded-full bg-muted-foreground animate-[typing-dot_1.2s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:opacity-70"
              style={{ animationDelay: `${dot * 160}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
