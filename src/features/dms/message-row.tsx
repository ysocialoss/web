import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CornerUpLeft, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MentionTextarea } from "@/features/feed/mention-textarea";
import { cn } from "@/lib/utils";
import type { DmUser } from "./dm-api";
import { messageByteLimit } from "./dm-crypto";
import type { DisplayMessage } from "./dm-context";
import { MessageBody } from "./message-body";
import { MessageReactions, type MessageReactionsHandle } from "./message-reactions";
import { PollMessage } from "./poll-message";
import { VoiceMessage } from "./voice-message";

export type { DisplayMessage };

export const nameOf = (user: DmUser) => user.displayName.trim() || user.handle;

export function PersonAvatar({ user, className }: { user: DmUser; className?: string }) {
  return (
    <Avatar className={className}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{nameOf(user).slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

function Stamp({ iso, className, children }: { iso: string; className?: string; children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<time dateTime={iso} className={className} />}>{children}</TooltipTrigger>
      <TooltipContent>{fullFormat.format(new Date(iso))}</TooltipContent>
    </Tooltip>
  );
}

export type RowActions = {
  reply: (message: DisplayMessage) => void;
  edit: (message: DisplayMessage, text: string) => Promise<void>;
  remove: (message: DisplayMessage) => void;
  react: (message: DisplayMessage, emoji: string | null) => Promise<unknown>;
  refetch: (message: DisplayMessage) => void;
  jump: (id: string) => void;
  vote: (message: DisplayMessage, option: number | null) => Promise<unknown>;
};

export function MessageRow({
  message, sender, peer, selfId, conversationId, withHeader, replied, editing, onEditing, flash, selected, onSelect, actions, canWrite,
}: {
  conversationId: string;
  message: DisplayMessage;
  sender: DmUser;
  peer: DmUser;
  selfId: string;
  withHeader: boolean;
  replied?: { sender: DmUser; text: string | null } | null;
  editing: boolean;
  onEditing: (editing: boolean) => void;
  flash: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  actions: RowActions;
  canWrite: boolean;
}) {
  const mine = sender.id === selfId;
  const readable = message.text !== null;
  const time = timeFormat.format(new Date(message.createdAt));
  const reactionsRef = useRef<MessageReactionsHandle>(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [wantTray, setWantTray] = useState(false);
  const trigger = useRef<{ element: HTMLElement; keyboard: boolean } | null>(null);
  const showReactions = message.reactions.length > 0 || trayOpen || wantTray;

  useEffect(() => {
    if (wantTray && trigger.current) reactionsRef.current?.open(trigger.current.element, trigger.current.keyboard);
  }, [wantTray]);

  return (
    <div
      data-message-id={message.id}
      data-selected={selected || undefined}
      onClick={(event) => {
        if (!window.matchMedia("(hover: none)").matches || (event.target as HTMLElement).closest("a,button,textarea")) return;
        onSelect(!selected);
      }}
      className={cn(
        "group relative isolate grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2.5 rounded-md px-2 transition-colors duration-75 hover:bg-muted/55 data-selected:bg-muted/55",
        withHeader ? "mt-2 py-1.5" : "py-0.5",
      )}
    >
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 rounded-md bg-accent transition-opacity motion-reduce:transition-none", flash ? "opacity-100 duration-100" : "opacity-0 duration-700")} />
      {withHeader ? <PersonAvatar user={sender} className="row-span-2 size-9" /> : (
        <Stamp iso={message.createdAt} className="select-none self-start pt-1 text-center text-[0.6rem] text-muted-foreground opacity-0 group-hover:opacity-100 group-data-selected:opacity-100">
          {time}
        </Stamp>
      )}
      {withHeader && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{nameOf(sender)}</span>
          <Stamp iso={message.createdAt} className="text-xs text-muted-foreground">{time}</Stamp>
        </div>
      )}

      {message.reply && (
        <button
          type="button"
          onClick={() => actions.jump(message.reply!)}
          disabled={!replied}
          className="col-start-2 mb-0.5 flex min-w-0 items-center gap-1.5 rounded-md text-left text-xs text-muted-foreground outline-none enabled:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CornerUpLeft aria-hidden="true" className="size-3.5 shrink-0" />
          {replied ? (
            <>
              <span className="shrink-0 font-medium text-foreground/80">{nameOf(replied.sender)}</span>
              <span className="truncate">{replied.text ?? "Message unavailable"}</span>
            </>
          ) : <span className="italic">Original message unavailable</span>}
        </button>
      )}

      {editing && readable ? (
        <EditBox initial={message.text!} onCancel={() => onEditing(false)} onSave={async (text) => {
          await actions.edit(message, text);
          onEditing(false);
        }} />
      ) : (
        <div className="col-start-2 min-w-0">
          {readable ? (
            <div className="space-y-1.5">
              {message.text && <MessageBody text={message.text} />}
              {message.gif && (
                <img
                  src={message.gif.url}
                  alt={message.gif.title || "GIF"}
                  width={message.gif.width}
                  height={message.gif.height}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="max-h-64 max-w-full rounded-xl object-contain"
                />
              )}
              {message.poll && (
                <PollMessage poll={message.poll} votes={message.votes} selfId={selfId} canVote={canWrite} onVote={(option) => void actions.vote(message, option).catch(() => {})} />
              )}
              {message.voice && <VoiceMessage voice={message.voice} conversationId={conversationId} />}
              {message.editedAt && (
                <Stamp iso={message.editedAt} className="block w-fit text-[0.65rem] text-muted-foreground">(edited)</Stamp>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">This message couldn’t be opened.</p>}
        </div>
      )}

      {readable && canWrite && showReactions && (
        <div className="col-start-2 mt-0.5">
          <MessageReactions
            ref={reactionsRef}
            reactions={message.reactions}
            selfId={selfId}
            peerName={nameOf(peer)}
            onReact={(emoji) => actions.react(message, emoji)}
            onFailed={() => actions.refetch(message)}
            onOpenChange={(open) => {
              setTrayOpen(open);
              if (open) setWantTray(false);
            }}
          />
        </div>
      )}
      {readable && !canWrite && message.reactions.length > 0 && (
        <div className="col-start-2 mt-0.5 flex flex-wrap gap-1.5">
          {[...new Set(message.reactions.map(({ emoji }) => emoji))].map((emoji) => (
            <span key={emoji} className="inline-flex h-7 items-center gap-1 rounded-full bg-background px-2 text-xs text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
              {emoji} {message.reactions.filter((reaction) => reaction.emoji === emoji).length}
            </span>
          ))}
        </div>
      )}

      {readable && !editing && (
        <div
          role="toolbar"
          aria-label="Message actions"
          className={cn(
            "absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 opacity-0 shadow-sm transition-opacity duration-100",
            "group-hover:opacity-100 group-focus-within:opacity-100 group-data-selected:opacity-100",
            trayOpen && "opacity-100",
          )}
        >
          {canWrite && (
            <IconButton label="Add reaction" size="icon-sm" onClick={(event) => {
              const keyboard = event.detail === 0;
              trigger.current = { element: event.currentTarget, keyboard };
              if (reactionsRef.current) reactionsRef.current.open(event.currentTarget, keyboard);
              else setWantTray(true);
            }}>
              <SmilePlus aria-hidden="true" />
            </IconButton>
          )}
          {canWrite && (
            <IconButton label="Reply" size="icon-sm" onClick={() => actions.reply(message)}>
              <CornerUpLeft aria-hidden="true" />
            </IconButton>
          )}
          {mine && !!message.text && (
            <IconButton label="Edit" size="icon-sm" onClick={() => { onSelect(false); onEditing(true); }}>
              <Pencil aria-hidden="true" />
            </IconButton>
          )}
          {mine && (
            <IconButton label="Delete" size="icon-sm" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => actions.remove(message)}>
              <Trash2 aria-hidden="true" />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);
  const tooLong = new TextEncoder().encode(value.trim()).length > messageByteLimit;
  const unchanged = value.trim() === initial;

  async function save() {
    const text = value.trim();
    if (busy || !text || tooLong) return;
    if (unchanged) return onCancel();
    setBusy(true);
    setError("");
    try {
      await onSave(text);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t save the change.");
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  }

  return (
    <div className="col-start-2 min-w-0 space-y-1.5">
      <div className="rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <MentionTextarea
          ref={textarea}
          aria-label="Edit message"
          value={value}
          onValueChange={setValue}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          readOnly={busy}
          rows={1}
          dropUp
          className="max-h-48 min-h-9 resize-none border-0 bg-transparent px-2.5 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {tooLong && <p role="alert" className="text-xs text-destructive">This message is too long.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy || !value.trim() || tooLong} onClick={() => void save()}>Save</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
