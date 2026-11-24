import { useMemo, useState } from "react";
import { Ban, Mail, Plus, ShieldCheck, X } from "lucide-react";
import { NavLink } from "react-router";
import { DisplayName } from "@/components/display-name";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { JellyRadio } from "@/components/ui/jelly-radio";
import { cn } from "@/lib/utils";
import { requestLimit, type Conversation } from "./dm-api";
import { countLabel } from "./dm-unread";
import { nameOf, PersonAvatar } from "./message-row";
import { ConversationListSkeleton } from "./messages-loading";

type Filter = "all" | "requests" | "unread";

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

function shortTime(iso: string) {
  const date = new Date(iso);
  const age = Date.now() - date.getTime();
  if (new Date().toDateString() === date.toDateString()) return timeFormat.format(date);
  return age < 6 * 86_400_000 ? dayFormat.format(date) : dateFormat.format(date);
}

const incoming = (conversation: Conversation, userId: string) =>
  conversation.inviteStatus === "pending" && conversation.invitedBy !== userId;
const blockedByMe = (conversation: Conversation, userId: string) =>
  conversation.inviteStatus === "declined" && conversation.invitedBy !== userId;

export function ConversationList({
  conversations, error, userId, typing, pendingDevices, onNew, onClose,
}: {
  conversations: Conversation[] | undefined;
  error: string;
  userId: string;
  typing: ReadonlySet<string>;
  pendingDevices: number;
  onNew: () => void;
  onClose: (conversation: Conversation) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = useMemo(() => {
    const list = conversations ?? [];
    return {
      requests: list.filter((conversation) => incoming(conversation, userId)).length,
      unread: list.filter((conversation) => conversation.unread > 0 && !blockedByMe(conversation, userId)).length,
    };
  }, [conversations, userId]);
  const shown = useMemo(() => (conversations ?? []).filter((conversation) => {
    if (filter === "requests") return incoming(conversation, userId) || blockedByMe(conversation, userId);
    if (filter === "unread") return conversation.unread > 0 && !blockedByMe(conversation, userId);
    return !incoming(conversation, userId) && !blockedByMe(conversation, userId);
  }), [conversations, filter, userId]);

  const pills: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: 0 },
    { key: "requests", label: "Requests", count: counts.requests },
    { key: "unread", label: "Unread", count: counts.unread },
  ];

  return (
    <>
      <header className="space-y-3 border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold">Messages</h1>
          <div className="-mr-1.5 flex items-center gap-0.5">
            <span className="relative">
              <IconLink label="Chat devices" to="/messages/devices" className="text-muted-foreground hover:text-foreground">
                <ShieldCheck aria-hidden="true" />
              </IconLink>
              {pendingDevices > 0 && (
                <span aria-label={`${pendingDevices} pending device requests`} className="pointer-events-none absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-none font-semibold text-primary-foreground">
                  {pendingDevices}
                </span>
              )}
            </span>
            <IconButton label="New message" onClick={onNew}>
              <Plus aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <JellyRadio
          ariaLabel="Filter conversations"
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          className="-mx-2 -my-1"
          items={pills.map(({ key, label, count }) => ({
            value: key,
            label: (
              <span className="inline-flex items-center gap-1">
                {label}
                {count > 0 && (
                  <span className={cn(
                    "-mr-1 ml-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.65rem] leading-none font-semibold",
                    filter === key ? "bg-background/25 text-background" : "bg-primary text-primary-foreground",
                  )}>
                    {countLabel(count)}
                  </span>
                )}
              </span>
            ),
          }))}
        />
      </header>
      <nav aria-label="Conversations" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
        {error && <p role="alert" className="px-2 py-2 text-sm text-destructive">{error}</p>}
        {!conversations && !error && <ConversationListSkeleton />}
        {conversations && shown.length === 0 && !error && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <Mail aria-hidden="true" className="size-6" />
            <p>
              {filter === "requests" ? "No message requests." : filter === "unread" ? "You’re all caught up." : "No conversations yet."}
            </p>
          </div>
        )}
        {shown.map((conversation) => {
          const { id, peer, unread, lastMessageAt, inviteStatus } = conversation;
          const isTyping = typing.has(id);
          const asked = inviteStatus === "pending" && conversation.invitedBy === userId;
          const request = incoming(conversation, userId);
          const blocked = blockedByMe(conversation, userId);
          const preview = isTyping ? "typing…"
            : blocked ? "Blocked"
            : request ? "Message request"
            : asked ? `Request · ${conversation.requestSent}/${requestLimit} sent`
            : inviteStatus === "declined" ? "Request declined"
            : `@${peer.handle}`;
          return (
            <div key={id} className="group relative">
              <NavLink
                to={`/messages/${id}`}
                className="flex items-center gap-3 rounded-lg px-2.5 py-2 pr-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted"
              >
                <PersonAvatar user={peer} className="size-10" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", unread > 0 ? "font-semibold" : "font-medium")}>
                    <DisplayName user={peer} name={nameOf(peer)} />
                  </span>
                  <span className={cn("flex items-center gap-1 truncate text-xs", unread > 0 || isTyping ? "text-foreground" : "text-muted-foreground", isTyping && "italic")}>
                    {blocked && <Ban aria-hidden="true" className="size-3 shrink-0" />}
                    <span className="truncate">{preview}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {lastMessageAt && <time dateTime={lastMessageAt} className="text-[0.65rem] text-muted-foreground group-hover:invisible group-focus-within:invisible">{shortTime(lastMessageAt)}</time>}
                  {unread > 0 && (
                    <span aria-label={`${unread} unread`} className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.7rem] leading-none font-semibold text-primary-foreground">
                      {countLabel(unread)}
                    </span>
                  )}
                </span>
              </NavLink>
              <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:hidden">
                <IconButton label="Close conversation" size="icon-xs" onClick={() => onClose(conversation)}>
                  <X aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );
}
