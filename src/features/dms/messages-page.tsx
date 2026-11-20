import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole, Mail, Send, ShieldCheck } from "lucide-react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { useNotifications } from "@/features/notifications/notifications-context";
import { usePageTitle } from "@/hooks/use-page-title";
import { ApiError, type Session } from "@/lib/api";
import { dmApi, dmError, type Conversation, type DmUser, type InviteResponse } from "./dm-api";
import {
  DeviceTrustError, decryptMessage, encryptMessage, fingerprint, formatCode, matchDevice, messageByteLimit,
  verifyDirectory, type DeviceKeys, type LocalDevice, type ReceivedMessage,
} from "./dm-crypto";
import { DmDeviceGate } from "./dm-devices";
import { useDmUpdates, type DmLiveEvent } from "./dm-live";
import { useVisibleMessageReads } from "./dm-read";
import { MessageBody } from "./message-body";
import { confirmRoot, historicalSenderKeys, pinConversation, rememberRemovals, rootStatus, trustedRoot } from "./dm-storage";

export function MessagesPage({ session, managingDevices = false }: { session: Session | null; managingDevices?: boolean }) {
  usePageTitle(managingDevices ? "Chat devices" : "Messages");
  const { conversationId } = useParams();
  if (!session?.authenticated || session.needsOnboarding || session.pendingApproval || session.ban) {
    return (
      <div className="mx-auto max-w-xl space-y-2 px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {session === null ? "Loading…" : !session.authenticated ? <Link to="/login" className="underline">Sign in to use Messages.</Link>
            : "Messages are available to approved accounts in good standing."}
        </p>
      </div>
    );
  }
  return (
    <DmDeviceGate key={session.user.id} userId={session.user.id} managingDevices={managingDevices}>
      {(device, pending) => <Inbox device={device} conversationId={conversationId} pending={pending} />}
    </DmDeviceGate>
  );
}

const inboxChange = (event: { type: string }) => event.type === "conversation" ? true : undefined;

const nameOf = (user: DmUser) => user.displayName.trim() || user.handle;

function PersonAvatar({ user, className }: { user: DmUser; className?: string }) {
  return (
    <Avatar className={className}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{nameOf(user).slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}

function Inbox({ device, conversationId, pending }: { device: LocalDevice; conversationId?: string; pending: number }) {
  const [conversations, setConversations] = useState<Conversation[]>();
  const [error, setError] = useState("");
  const [query] = useSearchParams();
  const target = query.get("to") ?? "";
  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      const result = await dmApi.conversations(device, signal);
      if (!signal.aborted) {
        setConversations(result.conversations);
        setError("");
      }
    } catch (error) {
      if (!signal.aborted) setError(dmError(error));
    }
  }, [device]);
  const refreshNow = useDmUpdates(device.userId, refresh, inboxChange);
  return (
    <div className="flex h-full min-h-0 min-w-0">
      <aside aria-label="Conversations" className={`w-full shrink-0 flex-col border-border bg-muted/25 md:flex md:w-64 md:border-r xl:w-72 ${conversationId ? "hidden" : "flex"}`}>
        <header className="space-y-3 border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-semibold">Messages</h1>
            <DevicesLink pending={pending} />
          </div>
          <StartConversation key={target} target={target} device={device} onOpen={refreshNow} />
        </header>
        <nav aria-label="Messages" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {error && <p role="alert" className="px-2 py-2 text-sm text-destructive">{error}</p>}
          {!conversations && !error && <p role="status" className="px-2 py-2 text-sm text-muted-foreground">Loading conversations…</p>}
          {conversations?.length === 0 && !error && <p className="px-2 py-2 text-sm text-muted-foreground">No conversations yet.</p>}
          {conversations?.map(({ id, peer, invitedBy, inviteStatus }) => (
            <NavLink key={id} to={`/messages/${id}`}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-muted">
              <PersonAvatar user={peer} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{nameOf(peer)}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {inviteStatus === "pending" ? (invitedBy === device.userId ? "Invite sent" : "New invite") : `@${peer.handle}`}
                </span>
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {conversationId ? (
        <Thread key={conversationId} id={conversationId} device={device} onChange={refreshNow} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground md:flex">
          <Mail aria-hidden="true" className="size-7" />
          <p>Choose a conversation or enter someone’s handle.</p>
        </div>
      )}
    </div>
  );
}

function DevicesLink({ pending }: { pending: number }) {
  return (
    <Link to="/messages/devices" className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
      <ShieldCheck aria-hidden="true" className="size-4" />
      Devices{pending > 0 && <span aria-label={`${pending} pending requests`}>({pending})</span>}
    </Link>
  );
}

function StartConversation({ device, target, onOpen }: { device: LocalDevice; target: string; onOpen: () => void }) {
  const navigate = useNavigate();
  const [handle, setHandle] = useState(target);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/i.test(clean)) {
      setError("Enter a valid handle.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { id, peerId } = await dmApi.open(clean, device);
      if (!await pinConversation(device.userId, id, peerId))
        throw new DeviceTrustError("The conversation participants could not be verified.");
      setHandle("");
      onOpen();
      void navigate(`/messages/${id}`);
    } catch (error) {
      setError(dmError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-2">
      <div className="flex gap-2">
        <Input aria-label="Recipient handle" placeholder="@handle" value={handle} onChange={(event) => setHandle(event.target.value)} maxLength={33} autoComplete="off" spellCheck={false} />
        <Button type="submit" size="sm" variant="secondary" className="h-9 pointer-coarse:h-10" disabled={busy || !handle.trim()}>Start</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

type Context = Awaited<ReturnType<typeof readContext>>;
type DisplayMessage = ReceivedMessage & { text: string | null };

async function readContext(id: string, device: LocalDevice, signal?: AbortSignal) {
  const { members, devices, inviteStatus, invitedBy } = await dmApi.context(id, device, signal);
  const peer = members.find(({ id }) => id !== device.userId);
  const self = members.find(({ id }) => id === device.userId);
  if (!self || !peer || members.length !== 2)
    throw new DeviceTrustError("The conversation participants could not be verified.");
  const [own, theirs] = await Promise.all([verifyDirectory(self.id, devices), verifyDirectory(peer.id, devices)]);
  if (!own || !await trustedRoot(self.id, own.root, false)) {
    throw new DeviceTrustError("This browser’s approval could not be verified.");
  }
  await rememberRemovals(self.id, own);
  if (!own.active.some((entry) => matchDevice(device, entry)))
    throw new DeviceTrustError("This browser’s approval could not be verified.");
  if (!await pinConversation(self.id, id, peer.id))
    throw new DeviceTrustError("The conversation participants could not be verified.");
  const peerTrusted = theirs ? await trustedRoot(self.id, theirs.root, true) : false;
  if (theirs && peerTrusted) await rememberRemovals(self.id, theirs);
  const peerIdentity = theirs && !peerTrusted ? await rootStatus(self.id, theirs.root) : undefined;
  const senderKeys = new Map<string, DeviceKeys>(own.verified);
  if (theirs) {
    for (const [key, sender] of await historicalSenderKeys(self.id, theirs, devices)) senderKeys.set(key, sender);
    if (peerTrusted) for (const [key, sender] of theirs.verified) senderKeys.set(key, sender);
  }
  return {
    self, peer, own, theirs, inviteStatus, invitedBy, senderKeys, peerIdentity,
    peerCode: theirs ? formatCode(await fingerprint(theirs.root)) : "",
  };
}

async function decryptPage(id: string, device: LocalDevice, context: Context, messages: ReceivedMessage[]) {
  return Promise.all(messages.map(async (message): Promise<DisplayMessage> => {
    const sender = context.senderKeys.get(message.senderDeviceId);
    if (sender) {
      try {
        return { ...message, text: await decryptMessage(id, device, sender, message) };
      } catch {
        // Keep the rest of the conversation readable if an individual message fails verification.
      }
    }
    return { ...message, text: null };
  }));
}

function Thread({ id, device, onChange }: { id: string; device: LocalDevice; onChange: () => void }) {
  const { refresh: refreshNotifications } = useNotifications();
  const [context, setContext] = useState<Context>();
  const contextRef = useRef<Context>(undefined);
  const [messages, setMessages] = useState<DisplayMessage[]>();
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readError, setReadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [locked, setLocked] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [responding, setResponding] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ height: number; top: number } | undefined>(undefined);
  const stickToBottom = useRef(true);
  const cursor = useRef<string | undefined>(undefined);
  const operations = useRef<AbortController | null>(null);
  const pending = useRef<{ text: string; id: string } | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    operations.current = controller;
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (anchor.current) {
      element.scrollTop = anchor.current.top + element.scrollHeight - anchor.current.height;
      anchor.current = undefined;
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const refresh = useCallback(async (signal: AbortSignal, full: boolean) => {
    try {
      let after = cursor.current;
      let page = await dmApi.messages(id, device, after ? { after } : undefined, signal);
      let firstPage = !after;
      let olderAvailable = firstPage && page.more;
      const encrypted: ReceivedMessage[] = [];
      while (true) {
        encrypted.push(...page.messages);
        after = page.messages.at(-1)?.sequence ?? after;
        if (firstPage || !page.more || !after) break;
        page = await dmApi.messages(id, device, { after }, signal);
      }
      const cached = contextRef.current;
      const next = full || !cached || (!cached.peerIdentity && encrypted.some((message) => !cached.senderKeys.has(message.senderDeviceId)))
        ? await readContext(id, device, signal)
        : cached;
      if (signal.aborted) return;
      if (cached?.peerIdentity && !next.peerIdentity && !firstPage) {
        const latest = await dmApi.messages(id, device, undefined, signal);
        encrypted.splice(0, encrypted.length, ...latest.messages);
        after = latest.messages.at(-1)?.sequence;
        firstPage = true;
        olderAvailable = latest.more;
      }
      const incoming = await decryptPage(id, device, next, encrypted);
      if (signal.aborted) return;
      contextRef.current = next;
      setContext(next);
      setReadError("");
      setLocked(false);
      if (firstPage || incoming.length) {
        cursor.current = after;
        if (firstPage) setMore(olderAvailable);
        setMessages((current) => firstPage ? incoming : [...(current ?? []), ...incoming]);
      }
    } catch (error) {
      if (!signal.aborted) {
        if (error instanceof DeviceTrustError) setLocked(true);
        setReadError(dmError(error));
      }
    }
  }, [id, device]);
  const threadChange = useCallback((event: DmLiveEvent) => {
    if (event.type === "devices") return true;
    if (event.type === "conversation" && event.id === id) return event.roster;
  }, [id]);
  const refreshNow = useDmUpdates(device.userId, refresh, threadChange);
  const acknowledge = useCallback(async (ids: string[], signal: AbortSignal) => {
    await dmApi.read(id, device, ids, signal);
    if (!signal.aborted) void refreshNotifications();
  }, [id, device, refreshNotifications]);

  async function confirmPeer() {
    const signal = operations.current?.signal;
    if (!context?.theirs || !context.peerIdentity || !signal || confirming) return;
    setConfirming(true);
    setActionError("");
    try {
      const current = await readContext(id, device, signal);
      if (!current.theirs || !matchDevice(current.theirs.root, context.theirs.root))
        throw new DeviceTrustError("The contact’s security code changed again. Check it before continuing.");
      signal.throwIfAborted();
      await confirmRoot(device.userId, current.theirs.root, context.peerIdentity.known?.current);
      refreshNow();
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
    } finally {
      if (!signal.aborted) setConfirming(false);
    }
  }

  async function respond(response: InviteResponse) {
    const signal = operations.current?.signal;
    if (!signal || responding || locked) return;
    setResponding(true);
    setActionError("");
    try {
      await dmApi.respondToInvite(id, device, response, signal);
      if (signal.aborted) return;
      if (contextRef.current) {
        contextRef.current = { ...contextRef.current, inviteStatus: response };
        setContext(contextRef.current);
      }
      onChange();
      void refreshNotifications();
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
    } finally {
      if (!signal.aborted) {
        setResponding(false);
        refreshNow();
      }
    }
  }

  async function loadOlder() {
    const first = messages?.[0];
    const signal = operations.current?.signal;
    if (!first || !context || !signal || loadingOlder) return;
    setLoadingOlder(true);
    setActionError("");
    try {
      const result = await dmApi.messages(id, device, { before: first.sequence }, signal);
      const currentContext = contextRef.current ?? context;
      const older = await decryptPage(id, device, currentContext, result.messages);
      if (signal.aborted) return;
      const element = scroller.current;
      if (element) anchor.current = { height: element.scrollHeight, top: element.scrollTop };
      setMessages((current) => [...older, ...(current ?? [])]);
      setMore(result.more);
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
    } finally {
      if (!signal.aborted) setLoadingOlder(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    const signal = operations.current?.signal;
    if (!text || sending || locked || context?.inviteStatus !== "accepted" || !context.theirs?.active.length || !signal) return;
    setSending(true);
    setActionError("");
    if (pending.current?.text !== text) pending.current = { id: crypto.randomUUID(), text };
    try {
      const messageId = pending.current.id;
      for (let attempt = 0; ; attempt++) {
        const next = await readContext(id, device, signal);
        if (next.peer.id !== context.peer.id) throw new DeviceTrustError("The conversation participants changed. This conversation is locked.");
        if (next.peerIdentity) {
          refreshNow();
          throw new DeviceTrustError("Verify the contact’s new security code before sending.");
        }
        if (!next.theirs?.active.length) throw new Error("The other person needs a verified device to receive messages.");
        const body = await encryptMessage(id, messageId, device, [...next.own.active, ...next.theirs.active], text);
        try {
          await dmApi.send(id, body, signal);
          if (!signal.aborted) {
            contextRef.current = next;
            setContext(next);
          }
          break;
        } catch (error) {
          if (attempt || !(error instanceof ApiError) || error.message !== "dm_device_roster_changed") throw error;
        }
      }
      if (signal.aborted) return;
      pending.current = undefined;
      setDraft("");
      stickToBottom.current = true;
      refreshNow(false);
      onChange();
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
    } finally {
      if (!signal.aborted) setSending(false);
    }
  }

  const peer = context?.peer;
  const canSend = context?.inviteStatus === "accepted" && !!context.theirs?.active.length && !context.peerIdentity && !locked;
  const tooLong = new TextEncoder().encode(draft.trim()).length > messageByteLimit;
  return (
    <section aria-label={peer ? `Conversation with ${nameOf(peer)}` : "Conversation"} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <Link to="/messages" aria-label="Back to conversations" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:hidden">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        {peer && <PersonAvatar user={peer} />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{peer ? nameOf(peer) : "Conversation"}</h2>
          {peer && <Link to={`/@${peer.handle}`} className="block truncate text-xs text-muted-foreground hover:underline">@{peer.handle}</Link>}
        </div>
        <IconButton label="Chat security code" aria-expanded={showCode} onClick={() => setShowCode((open) => !open)}>
          <LockKeyhole aria-hidden="true" />
        </IconButton>
      </header>
      {context?.peerIdentity && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm" role="status">
          <p>Verify this contact’s new security code before sending messages.</p>
          {!showCode && <Button size="sm" variant="outline" onClick={() => setShowCode(true)}>View code</Button>}
        </div>
      )}
      {showCode && (
        <div className="shrink-0 space-y-1 border-b border-border bg-muted/25 px-4 py-3 text-sm">
          {context?.peerCode ? (
            <>
              <p className="text-muted-foreground">Compare this security code with @{peer?.handle} outside this app.</p>
              <code className="block font-mono text-xs wrap-anywhere">{context.peerCode}</code>
              {context.peerIdentity && !context.peerIdentity.known?.previous.includes(context.peerIdentity.code) && (
                <Button size="sm" disabled={confirming} onClick={() => void confirmPeer()}>Confirm code matches</Button>
              )}
            </>
          ) : <p className="text-muted-foreground">Security code unavailable.</p>}
        </div>
      )}
      <div ref={scroller} onScroll={(event) => {
        const element = event.currentTarget;
        stickToBottom.current = element.scrollHeight - element.clientHeight - element.scrollTop < 64;
      }} tabIndex={0} aria-label="Message history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3">
        {more && <Button type="button" variant="ghost" size="sm" className="mx-auto mb-2 flex" disabled={loadingOlder || locked} onClick={() => void loadOlder()}>Load earlier messages</Button>}
        {!messages && !readError && <p role="status" className="px-2 text-sm text-muted-foreground">Loading messages…</p>}
        {context?.inviteStatus === "accepted" && messages?.length === 0 && !readError && (
          <p className="px-2 text-sm text-muted-foreground">No messages on this device yet.</p>
        )}
        {context?.inviteStatus === "accepted" && !locked && <MessageRows messages={messages ?? []} context={context} acknowledge={acknowledge} />}
        {context?.inviteStatus === "pending" && !locked && (
          <div className="space-y-3 px-2 py-2 text-sm">
            {context.invitedBy === device.userId ? (
              <p className="text-muted-foreground">Invite sent to @{context.peer.handle}. You can message when they accept.</p>
            ) : (
              <>
                <p>@{context.peer.handle} wants to chat with you.</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={responding} onClick={() => void respond("accepted")}>Accept invite</Button>
                  <Button size="sm" variant="outline" disabled={responding} onClick={() => void respond("declined")}>Decline</Button>
                </div>
              </>
            )}
          </div>
        )}
        {context?.inviteStatus === "declined" && !locked && <p className="px-2 text-sm text-muted-foreground">This invite was declined.</p>}
      </div>
      {readError && <div className="flex items-center justify-between gap-2 px-4 py-1 text-xs text-destructive">
        <p role="alert">{readError}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => refreshNow()}>Retry</Button>
      </div>}
      {actionError && <p role="alert" className="px-4 py-1 text-xs text-destructive">{actionError}</p>}
      {context?.inviteStatus === "accepted" && <form onSubmit={(event) => void submit(event)} className="shrink-0 space-y-1 border-t border-border px-3 pt-2 pb-1 md:pb-3">
        {context && !context.theirs?.active.length && <p className="px-1 text-xs text-muted-foreground">@{context.peer.handle} needs a verified device to receive messages.</p>}
        {tooLong && <p role="alert" className="px-1 text-xs text-destructive">This message is too long.</p>}
        <div className="flex items-end gap-2 rounded-lg border border-input bg-muted/30 p-1 focus-within:border-ring">
          <textarea aria-label="Message" value={draft} onChange={(event) => setDraft(event.target.value)}
            placeholder={peer ? `Message @${peer.handle}` : "Message"}
            disabled={!canSend} readOnly={sending} rows={2} maxLength={messageByteLimit}
            className="min-w-0 flex-1 resize-none rounded px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground md:text-sm"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!tooLong) event.currentTarget.form?.requestSubmit();
              }
            }} />
          <Button type="submit" size="icon" className="shrink-0" aria-label="Send message" disabled={!canSend || sending || tooLong || !draft.trim()}>
            <Send aria-hidden="true" />
          </Button>
        </div>
      </form>}
    </section>
  );
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

function MessageRows({ messages, context, acknowledge }: {
  messages: DisplayMessage[];
  context: Context;
  acknowledge: (ids: string[], signal: AbortSignal) => Promise<void>;
}) {
  const list = useRef<HTMLOListElement>(null);
  useVisibleMessageReads(list, messages, acknowledge);
  return (
    <ol ref={list} aria-label="Messages" className="space-y-px">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const date = new Date(message.createdAt);
        const day = dateFormat.format(date);
        const newDay = !previous || dateFormat.format(new Date(previous.createdAt)) !== day;
        const withHeader = newDay || previous.senderId !== message.senderId
          || date.getTime() - Date.parse(previous.createdAt) > 5 * 60_000;
        const sender = message.senderId === context.self.id ? context.self : context.peer;
        const time = timeFormat.format(date);
        return (
          <li key={message.id} data-readable-message={message.text !== null && sender.id === context.peer.id ? message.id : undefined}>
            {newDay && <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{day}</div>}
            <div className={`group grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2.5 rounded-md px-2 hover:bg-muted/55 ${withHeader ? "mt-2 py-1.5" : "py-0.5"}`}>
              {withHeader ? <PersonAvatar user={sender} className="row-span-2 size-9" /> : (
                <time dateTime={message.createdAt} className="self-start pt-0.5 text-center text-[0.6rem] text-muted-foreground opacity-0 group-hover:opacity-100">{time}</time>
              )}
              {withHeader && (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{nameOf(sender)}</span>
                  <time dateTime={message.createdAt} className="text-xs text-muted-foreground">{time}</time>
                </div>
              )}
              {message.text === null
                ? <p className="col-start-2 text-sm text-muted-foreground">This message couldn’t be opened.</p>
                : <MessageBody text={message.text} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
