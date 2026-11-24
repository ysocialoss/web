import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CornerUpLeft, Flag, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmojiPicker } from "./emoji-picker";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MentionTextarea } from "@/features/feed/mention-textarea";
import { cn } from "@/lib/utils";
import { DisplayName } from "@/components/display-name";
import type { DmUser } from "./dm-api";
import { messageByteLimit } from "./dm-crypto";
import type { DisplayMessage } from "./dm-context";
import { ReportDialog, type MessageContext } from "@/features/reports/report-dialog";
import { MessageBody } from "./message-body";
import { MessageReactions } from "./message-reactions";
import { PollMessage } from "./poll-message";
import { VoiceMessage } from "./voice-message";
import type { MessagePayload } from "./message-payload";

export type { DisplayMessage };
export type OutgoingMessage = MessagePayload & Pick<DisplayMessage, "id" | "senderId" | "createdAt"> & (
  { delivery: "sending" | "sent" } | { delivery: "failed"; error: string }
);

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

export const MessageRow = memo(function MessageRow({
  message, sender, peer, self, conversationId, withHeader, replied, editing, onEditing, flash, selected, onSelect, actions, canWrite,
  retry, dismiss, sending, onInteraction, reportContext,
}: {
  conversationId: string;
  message: DisplayMessage | OutgoingMessage;
  sender: DmUser;
  peer: DmUser;
  self: DmUser;
  withHeader: boolean;
  replied?: DisplayMessage;
  editing: boolean;
  onEditing: (id: string | null) => void;
  flash: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
  actions: RowActions;
  canWrite: boolean;
  reportContext?: () => MessageContext[];
  retry?: (message: OutgoingMessage) => void;
  dismiss?: (id: string) => void;
  sending?: boolean;
  onInteraction: (id: string, active: boolean) => void;
}) {
  const pending = "delivery" in message ? message : undefined;
  const confirmed = "delivery" in message ? undefined : message;
  const selfId = self.id;
  const mine = sender.id === selfId;
  const replyAuthor = replied?.senderId === selfId ? self : peer;
  const [reporting, setReporting] = useState<MessageContext[] | null>(null);
  const readable = message.text !== null;
  const time = timeFormat.format(new Date(message.createdAt));
  const [trayOpen, setTrayOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const showReactions = confirmed && (confirmed.reactions.length > 0 || trayOpen);
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const interacting = !!reporting || pickingEmoji || trayOpen || voiceActive;
  const touch = useRef<{ id: number; x: number; y: number; time: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const row = useRef<HTMLDivElement>(null);
  const [toolsBelow, setToolsBelow] = useState(false);
  useEffect(() => {
    if (!selected) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !row.current?.contains(event.target)) onSelect(null);
    };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onSelect(null); };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape);
    };
  }, [selected, onSelect]);
  useEffect(() => () => clearTimeout(hold.current), []);

  useEffect(() => {
    if (!interacting) return;
    onInteraction(message.id, true);
    return () => onInteraction(message.id, false);
  }, [interacting, message.id, onInteraction]);

  return (
    <div
      ref={row}
      data-message-id={message.id}
      data-selected={selected || undefined}
      data-delivery={pending?.delivery}
      onPointerDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        clearTimeout(hold.current);
        if (event.pointerType !== "touch" || !event.isPrimary || !confirmed || !readable || !canWrite || editing
          || (event.target as Element).closest("a,button,input,textarea,select,[role=slider],[contenteditable=true]")) {
          touch.current = null;
          lastTap.current = null;
          return;
        }
        touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false };
        onSelect(null);
        hold.current = setTimeout(() => {
          touch.current = null;
          lastTap.current = null;
          const host = row.current?.closest("[aria-label='Message history']");
          if (host && row.current) {
            const viewport = host.getBoundingClientRect();
            const message = row.current.getBoundingClientRect();
            setToolsBelow(viewport.bottom - message.bottom > message.top - viewport.top);
          }
          navigator.vibrate?.(10);
          onSelect(message.id);
        }, 450);
      }}
      onPointerMove={(event) => {
        const start = touch.current;
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = Math.abs(event.clientY - start.y);
        if (Math.max(Math.abs(dx), dy) > 10) {
          clearTimeout(hold.current);
          start.moved = true;
        }
        if (dy > 14 && dy >= Math.abs(dx)) {
          touch.current = null;
          lastTap.current = null;
          event.currentTarget.style.removeProperty("--drag");
          event.currentTarget.style.removeProperty("--reply-progress");
          delete event.currentTarget.dataset.replyReady;
        } else {
          const distance = dx > dy * 1.5 ? Math.max(0, dx - 8) : 0;
          event.currentTarget.style.setProperty("--drag", Math.min(distance * 0.65, 44) + "px");
          event.currentTarget.style.setProperty("--reply-progress", String(Math.min(distance / 48, 1)));
          const ready = dx >= 64 && dx > dy * 2;
          if (ready && !event.currentTarget.dataset.replyReady) navigator.vibrate?.(8);
          if (ready) event.currentTarget.dataset.replyReady = "true";
          else delete event.currentTarget.dataset.replyReady;
        }
      }}
      onPointerCancel={(event) => {
        clearTimeout(hold.current);
        touch.current = null;
        lastTap.current = null;
        event.currentTarget.style.removeProperty("--drag");
        event.currentTarget.style.removeProperty("--reply-progress");
        delete event.currentTarget.dataset.replyReady;
      }}
      onPointerUp={(event) => {
        clearTimeout(hold.current);
        const start = touch.current;
        touch.current = null;
        event.currentTarget.style.removeProperty("--drag");
        event.currentTarget.style.removeProperty("--reply-progress");
        delete event.currentTarget.dataset.replyReady;
        if (!confirmed || !canWrite || !start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = Math.abs(event.clientY - start.y);
        if (start.moved || Math.max(Math.abs(dx), dy) > 10) {
          lastTap.current = null;
          if (dx >= 64 && dx > dy * 2) actions.reply(confirmed);
          return;
        }
        if (event.timeStamp - start.time > 350) {
          lastTap.current = null;
          return;
        }
        const previous = lastTap.current;
        if (previous && event.timeStamp - previous.time <= 320 && Math.hypot(start.x - previous.x, start.y - previous.y) <= 32) {
          lastTap.current = null;
          onSelect(null);
          if (!confirmed.reactions.some(({ userId, emoji }) => userId === selfId && emoji === "❤️")) {
            void actions.react(confirmed, "❤️").then(() => actions.refetch(confirmed)).catch(() => {});
          }
        } else lastTap.current = { x: start.x, y: start.y, time: event.timeStamp };
      }}
      onContextMenu={(event) => {
        if (window.matchMedia("(pointer: coarse)").matches && !(event.target as Element).closest("a,button,input,textarea,[role=slider]")) {
          event.preventDefault();
        }
      }}
      className={cn(
        "group relative isolate grid touch-pan-y touch-pinch-zoom grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2.5 rounded-md px-2 transition-[translate,background-color] duration-150 ease-out active:duration-0 motion-reduce:transition-none pointer-coarse:select-none hover:bg-muted/55 data-selected:bg-muted/55",
        "translate-x-[var(--drag,0px)] data-selected:bg-accent",
        withHeader ? "mt-2 py-1.5" : "py-0.5",
      )}
    >
      <span aria-hidden="true" data-swipe-reply className="pointer-events-none absolute right-full top-1/2 mr-0.5 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-muted text-muted-foreground opacity-[var(--reply-progress,0)] group-data-reply-ready:bg-primary group-data-reply-ready:text-primary-foreground">
        <CornerUpLeft className="size-4" />
      </span>
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 -z-10 rounded-md bg-accent transition-opacity motion-reduce:transition-none", flash ? "opacity-100 duration-100" : "opacity-0 duration-700")} />
      {withHeader ? <PersonAvatar user={sender} className="row-span-2 size-9" /> : (
        <Stamp iso={message.createdAt} className="select-none self-start pt-1 text-center text-[0.6rem] text-muted-foreground opacity-0 group-hover:opacity-100 group-data-selected:opacity-100">
          {time}
        </Stamp>
      )}
      {withHeader && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <DisplayName user={sender} name={nameOf(sender)} className="text-sm font-semibold" />
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
              <DisplayName
                user={replyAuthor}
                name={nameOf(replyAuthor)}
                className="shrink-0 font-medium text-foreground/80"
              />
              <span className="truncate">{replied.text?.replace(/\s+/g, " ").trim().slice(0, 140) ?? "Message unavailable"}</span>
            </>
          ) : <span className="italic">Original message unavailable</span>}
        </button>
      )}

      {editing && confirmed?.text != null ? (
        <EditBox initial={confirmed.text} onCancel={() => onEditing(null)} onSave={async (text) => {
          await actions.edit(confirmed, text);
          onEditing(null);
        }} />
      ) : (
        <div data-message-body className="col-start-2 min-w-0">
          {readable ? (
            <div className={cn("space-y-1.5 transition-opacity duration-150 motion-reduce:transition-none", pending?.delivery === "sending" && "opacity-65")}>
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
                <PollMessage poll={message.poll} votes={confirmed?.votes ?? []} selfId={selfId} canVote={canWrite && !!confirmed} onVote={(option) => {
                  if (confirmed) void actions.vote(confirmed, option).catch(() => {});
                }} />
              )}
              {message.voice && (confirmed ? <VoiceMessage voice={message.voice} conversationId={conversationId} onActiveChange={setVoiceActive} /> : <p className="text-sm">Voice message</p>)}
              {confirmed?.editedAt && (
                <Stamp iso={confirmed.editedAt} className="block w-fit text-[0.65rem] text-muted-foreground">(edited)</Stamp>
              )}
              {pending?.delivery === "failed" && (
                <div className="flex flex-wrap items-center gap-x-2 text-xs">
                  <span role="alert" className="text-destructive">{pending.error}</span>
                  <Button type="button" size="sm" variant="ghost" disabled={sending} onClick={() => retry?.(pending)}>Retry</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => dismiss?.(pending.id)}>Dismiss</Button>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-muted-foreground">This message couldn’t be opened.</p>}
          {pending && pending.delivery !== "failed" && (
            <p role="status" className="sr-only">{pending.delivery === "sending" ? "Sending…" : "Sent"}</p>
          )}
        </div>
      )}

      {confirmed && readable && canWrite && showReactions && (
        <div className="col-start-2 mt-0.5">
          <MessageReactions
            reactions={confirmed.reactions}
            selfId={selfId}
            peerName={nameOf(peer)}
            onReact={(emoji) => actions.react(confirmed, emoji)}
            onFailed={() => actions.refetch(confirmed)}
            onOpenChange={setTrayOpen}
          />
        </div>
      )}
      {confirmed && readable && !canWrite && confirmed.reactions.length > 0 && (
        <div className="col-start-2 mt-0.5 flex flex-wrap gap-1.5">
          {[...new Set(confirmed.reactions.map(({ emoji }) => emoji))].map((emoji) => (
            <span key={emoji} className="inline-flex h-7 items-center gap-1 rounded-full bg-background px-2 text-xs text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
              {emoji} {confirmed.reactions.filter((reaction) => reaction.emoji === emoji).length}
            </span>
          ))}
        </div>
      )}

      {pickingEmoji && confirmed && (
        <Dialog open onOpenChange={setPickingEmoji}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Choose an emoji</DialogTitle>
            <EmojiPicker onPick={(emoji) => {
              setPickingEmoji(false);
              void actions.react(confirmed, emoji).then(() => actions.refetch(confirmed)).catch(() => {});
            }} />
          </DialogContent>
        </Dialog>
      )}
      {confirmed && readable && !editing && (
        <div
          role="toolbar"
          aria-label="Message actions"
          className={cn(
            "absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5 opacity-0 shadow-sm transition-opacity duration-100",
            "pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-data-selected:pointer-events-auto group-data-selected:opacity-100",
            !selected && "pointer-coarse:hidden",
            trayOpen && "opacity-100",
            selected && "w-max max-w-[calc(100%-1rem)] flex-col items-stretch gap-1 rounded-2xl p-1 shadow-md animate-in fade-in zoom-in-95 motion-reduce:animate-none",
            selected && (toolsBelow ? "top-full" : "top-auto bottom-full"),
          )}
        >
          {selected && canWrite && <div className="flex border-b border-border pb-1">{["❤️", "😂", "👍"].map((emoji) => (
            <button key={emoji} type="button" aria-label={`React with ${emoji}`} className="grid size-11 place-items-center rounded-full text-xl active:bg-muted" onClick={() => {
              onSelect(null);
              void actions.react(confirmed, emoji).then(() => actions.refetch(confirmed)).catch(() => {});
            }}>{emoji}</button>
          ))}</div>}
          {canWrite && (
            <Button variant="ghost" aria-label="Add reaction" title="Add reaction" size={selected ? "sm" : "icon-sm"} className={selected ? "h-11 justify-start text-sm" : undefined} onClick={() => {
              onSelect(null);
              setPickingEmoji(true);
            }}>
              <SmilePlus aria-hidden="true" />{selected && "React"}
            </Button>
          )}
          {canWrite && (
            <IconButton label="Reply" size={selected ? "sm" : "icon-sm"} className={selected ? "h-11 justify-start text-sm" : undefined} onClick={() => actions.reply(confirmed)}>
              <CornerUpLeft aria-hidden="true" />{selected && "Reply"}
            </IconButton>
          )}
          {mine && !!message.text && (
            <IconButton label="Edit" size={selected ? "sm" : "icon-sm"} className={selected ? "h-11 justify-start text-sm" : undefined} onClick={() => { onSelect(null); onEditing(confirmed.id); }}>
              <Pencil aria-hidden="true" />{selected && "Edit"}
            </IconButton>
          )}
          {mine && (
            <IconButton label="Delete" size={selected ? "sm" : "icon-sm"} className={cn("hover:bg-destructive/10 hover:text-destructive", selected && "h-11 justify-start text-sm")} onClick={() => actions.remove(confirmed)}>
              <Trash2 aria-hidden="true" />{selected && "Delete"}
            </IconButton>
          )}
          {!mine && reportContext && (
            <IconButton label="Report message" size={selected ? "sm" : "icon-sm"} className={cn("hover:bg-destructive/10 hover:text-destructive", selected && "h-11 justify-start text-sm")} onClick={() => { onSelect(null); setReporting(reportContext()); }}>
              <Flag aria-hidden="true" />{selected && "Report"}
            </IconButton>
          )}
        </div>
      )}
      {reporting && confirmed && (
        <ReportDialog
          open
          onOpenChange={(open) => !open && setReporting(null)}
          subject={{
            type: "message",
            conversationId,
            messageId: message.id,
            peerHandle: peer.handle,
            message: { id: message.id, text: reportText(confirmed) },
            earlier: reporting,
          }}
        />
      )}
    </div>
  );
});

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
    <div data-message-body className="col-start-2 min-w-0 space-y-1.5">
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

export function reportText(message: DisplayMessage) {
  return [
    message.text,
    message.gif && "[GIF]",
    message.poll && `[Poll: ${message.poll.title}]`,
    message.voice && "[Voice message]",
  ].filter(Boolean).join("\n");
}
