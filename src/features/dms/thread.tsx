import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Ban, Search, CornerUpLeft, EyeOff, LockKeyhole, LoaderCircle, Mail, SendHorizontal, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { MentionTextarea } from "@/features/feed/mention-textarea";
import { useNotifications } from "@/features/notifications/notifications-context";
import { ApiError } from "@/lib/api";
import { peekEmojiIndex, renderShortcodes } from "@/lib/emoji";
import { dmApi, dmError, requestLimit, type InviteResponse, type WireMessage } from "./dm-api";
import { decryptPage, readContext, transmitMessage, type Context, type DisplayMessage } from "./dm-context";
import { DeviceTrustError, matchDevice, messageByteLimit, type LocalDevice } from "./dm-crypto";
import { sendTyping, subscribeDm, useDmUpdates, type DmLiveEvent } from "./dm-live";
import { useVisibleMessageReads } from "./dm-read";
import { useDmUnread } from "./dm-unread";
import { confirmRoot } from "./dm-storage";
import { encryptFile } from "./dm-files";
import { encodePayload, type MessagePayload } from "./message-payload";
import { AttachMenu, VoiceRecorderBar, type Recorded } from "./composer-extras";
import { TypingBubble } from "./typing-bubble";
import { Collapse } from "@/components/ui/collapse";
import { ThreadSearch } from "./thread-search";
import { MessageRow, nameOf, PersonAvatar, type RowActions } from "./message-row";
import { ThreadSkeleton } from "./messages-loading";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const withEmoji = (text: string) => {
  const index = peekEmojiIndex();
  return index ? renderShortcodes(text, index) : text;
};
const snippet = (text: string | null) => text === null ? null : text.replace(/\s+/g, " ").trim().slice(0, 140);

export function Thread({ id, device, onChange }: { id: string; device: LocalDevice; onChange: () => void }) {
  const navigate = useNavigate();
  const { refresh: refreshNotifications } = useNotifications();
  const { refresh: refreshUnread } = useDmUnread();
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
  const [replyTo, setReplyTo] = useState<DisplayMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DisplayMessage | null>(null);
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [searching, setSearching] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const anchor = useRef<{ height: number; top: number } | undefined>(undefined);
  const stickToBottom = useRef(true);
  const cursor = useRef<string | undefined>(undefined);
  const operations = useRef<AbortController | null>(null);
  const pending = useRef<{ text: string; reply?: string; id: string } | undefined>(undefined);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingSent = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    operations.current = controller;
    return () => controller.abort();
  }, []);

  const content = useRef<HTMLDivElement>(null);
  const older = useRef<HTMLDivElement>(null);
  const loadOlderRef = useRef<() => void>(() => {});
  const [params, setParams] = useSearchParams();
  const jumpTo = params.get("m");
  const jumpTries = useRef(0);

  useEffect(() => {
    const element = scroller.current;
    const inner = content.current;
    if (!element || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current && !anchor.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [context]);

  const firstId = messages?.[0]?.id;
  useEffect(() => {
    const target = older.current;
    const root = scroller.current;
    if (!target || !root || !more || loadingOlder || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadOlderRef.current();
    }, { root, rootMargin: "300px 0px 0px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [more, loadingOlder, firstId]);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (anchor.current) {
      element.scrollTop = anchor.current.top + element.scrollHeight - anchor.current.height;
      anchor.current = undefined;
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, typing]);

  const refresh = useCallback(async (signal: AbortSignal, full: boolean) => {
    try {
      let after = cursor.current;
      let page = await dmApi.messages(id, device, after ? { after } : undefined, signal);
      let firstPage = !after;
      let olderAvailable = firstPage && page.more;
      const encrypted: WireMessage[] = [];
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
        setMessages((current) => {
          if (firstPage) return incoming;
          const known = new Set((current ?? []).map(({ id }) => id));
          return [...(current ?? []), ...incoming.filter(({ id }) => !known.has(id))];
        });
        if (incoming.some(({ senderId }) => senderId === next.peer.id)) setTyping(false);
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
    if (event.type === "conversation" && event.id === id) return event.message ? undefined : event.roster;
  }, [id]);
  const refreshNow = useDmUpdates(device.userId, refresh, threadChange);

  const refreshOne = useCallback(async (messageId: string) => {
    const signal = operations.current?.signal;
    const current = contextRef.current;
    if (!signal || !current) return;
    try {
      const { message } = await dmApi.message(id, messageId, device, signal);
      const [next] = await decryptPage(id, device, current, [message]);
      if (!signal.aborted) setMessages((list) => list?.map((entry) => entry.id === next.id ? next : entry));
    } catch (error) {
      if (!signal.aborted && error instanceof ApiError && error.message === "dm_message_not_found")
        setMessages((list) => list?.filter((entry) => entry.id !== messageId));
    }
  }, [id, device]);

  useEffect(() => subscribeDm(device.userId, (event) => {
    if (event.type === "typing" && event.id === id) {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 5500);
    } else if (event.type === "conversation" && event.id === id && event.message) {
      void refreshOne(event.message);
    }
  }), [device.userId, id, refreshOne]);
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  const acknowledge = useCallback(async (ids: string[], signal: AbortSignal) => {
    await dmApi.read(id, device, ids, signal);
    if (!signal.aborted) {
      void refreshNotifications();
      refreshUnread();
    }
  }, [id, device, refreshNotifications, refreshUnread]);

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
      refreshUnread();
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
    } finally {
      if (!signal.aborted) {
        setResponding(false);
        refreshNow();
      }
    }
  }

  async function unblock() {
    const signal = operations.current?.signal;
    if (!signal || responding) return;
    setResponding(true);
    setActionError("");
    try {
      await dmApi.unblock(id, device);
      onChange();
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
    } finally {
      if (!signal.aborted) {
        setResponding(false);
        refreshNow();
      }
    }
  }

  async function closeConversation() {
    setActionError("");
    try {
      await dmApi.close(id, device);
      onChange();
      void navigate("/messages", { replace: true });
    } catch (error) {
      setActionError(dmError(error));
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

  async function transmit(messageId: string, payload: string, send: Parameters<typeof transmitMessage>[0]["send"]) {
    const signal = operations.current?.signal;
    if (!signal || !context) throw new Error("This conversation isn’t ready yet.");
    await transmitMessage({
      id, device, signal, peerId: context.peer.id, messageId, payload, send,
      onStale: () => refreshNow(),
      onContext: (next) => {
        if (signal.aborted) return;
        contextRef.current = next;
        setContext(next);
      },
    });
  }

  const sentInRequest = useMemo(
    () => (messages ?? []).filter((message) => message.senderId === device.userId).length,
    [messages, device.userId],
  );
  const asked = context?.inviteStatus === "pending" && context.invitedBy === device.userId;
  const accepted = context?.inviteStatus === "accepted";
  const requestOpen = asked && Math.max(sentInRequest, context.requestSent) < requestLimit;
  const peer = context?.peer;
  const needsDevice = !!context && !context.theirs?.active.length;
  const paused = !!context && (context.peerOptedOut || context.selfOptedOut);
  const canSend = (accepted || requestOpen) && !needsDevice && !paused && !context?.peerIdentity && !locked;
  const payload = encodePayload({ text: withEmoji(draft.trim()), reply: replyTo?.id });
  const tooLong = new TextEncoder().encode(payload).length > messageByteLimit;

  async function sendParts(parts: Omit<MessagePayload, "text"> & { text?: string }, attachmentId?: string) {
    const signal = operations.current?.signal;
    const text = withEmoji(parts.text ?? "");
    const reply = replyTo?.id;
    const body = encodePayload({ ...parts, text, reply });
    if (sending || !canSend || !signal || (!text && !parts.gif && !parts.poll && !parts.voice) || new TextEncoder().encode(body).length > messageByteLimit) return false;
    setSending(true);
    setActionError("");
    const key = JSON.stringify([text, reply, parts.gif?.url, parts.poll?.title, parts.voice?.id]);
    if (pending.current?.text !== key) pending.current = { id: crypto.randomUUID(), text: key, reply };
    try {
      await transmit(pending.current.id, body, (encrypted, signal) => dmApi.send(id, attachmentId ? { ...encrypted, attachmentId } : encrypted, signal));
      if (signal.aborted) return false;
      pending.current = undefined;
      setReplyTo(null);
      typingSent.current = 0;
      stickToBottom.current = true;
      refreshNow(false);
      onChange();
      return true;
    } catch (error) {
      if (!signal.aborted) setActionError(dmError(error));
      return false;
    } finally {
      if (!signal.aborted) setSending(false);
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || tooLong) return;
    if (await sendParts({ text: draft.trim() })) setDraft("");
  }

  async function sendVoice({ blob, seconds, wave, mime }: Recorded) {
    setRecording(false);
    const signal = operations.current?.signal;
    if (!signal || sending) return;
    setSending(true);
    setActionError("");
    try {
      const { data, key, iv } = await encryptFile(blob);
      const attachmentId = await dmApi.upload(id, data as Uint8Array<ArrayBuffer>, signal);
      setSending(false);
      await sendParts({ voice: { id: attachmentId, key, iv, mime, seconds, wave } }, attachmentId);
    } catch (error) {
      if (!signal.aborted) {
        setActionError(dmError(error));
        setSending(false);
      }
    }
  }

  function onDraft(value: string) {
    setDraft(value);
    if (accepted && value.trim() && Date.now() - typingSent.current > 3000) {
      typingSent.current = Date.now();
      sendTyping(device.userId, id);
    }
  }

  const byId = useMemo(() => new Map((messages ?? []).map((message) => [message.id, message])), [messages]);

  const actions = useMemo<RowActions>(() => ({
    reply(message) {
      setReplyTo(message);
      setSelectedId(null);
      requestAnimationFrame(() => composer.current?.focus());
    },
    async edit(message, text) {
      try {
        await transmit(message.id, encodePayload({ text: withEmoji(text), reply: message.reply, gif: message.gif, poll: message.poll, voice: message.voice }), (body, signal) => dmApi.edit(id, body, signal));
      } catch (error) {
        throw new Error(dmError(error), { cause: error });
      }
      await refreshOne(message.id);
    },
    remove: setDeleting,
    async react(message, emoji) {
      const signal = operations.current?.signal;
      try {
        await dmApi.react(id, message.id, emoji, signal);
      } catch (error) {
        if (!signal?.aborted) setActionError(dmError(error));
        throw error;
      }
    },
    refetch: (message) => void refreshOne(message.id),
    async vote(message, option) {
      const signal = operations.current?.signal;
      try {
        await dmApi.vote(id, message.id, option, signal);
      } catch (error) {
        if (!signal?.aborted) setActionError(dmError(error));
        throw error;
      }
    },
    jump(messageId) {
      const element = scroller.current?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
      if (!element) return;
      element.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      setFlashId(messageId);
      setTimeout(() => setFlashId((current) => current === messageId ? null : current), 1400);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [id, refreshOne, context]);

  useEffect(() => {
    loadOlderRef.current = () => void loadOlder();
  });

  useEffect(() => {
    if (!jumpTo || !messages || loadingOlder) return;
    const done = () => {
      jumpTries.current = 0;
      setParams((current) => { const next = new URLSearchParams(current); next.delete("m"); return next; }, { replace: true });
    };
    if (byId.has(jumpTo)) {
      const frame = requestAnimationFrame(() => { actions.jump(jumpTo); done(); });
      return () => cancelAnimationFrame(frame);
    }
    if (more && jumpTries.current++ < 40) loadOlderRef.current();
    else done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo, messages, more, loadingOlder]);

  async function deleteMessage() {
    const target = deleting;
    if (!target) return false;
    try {
      await dmApi.remove(id, target.id);
      setMessages((list) => list?.filter((entry) => entry.id !== target.id));
      if (replyTo?.id === target.id) setReplyTo(null);
      onChange();
      return true;
    } catch (error) {
      setActionError(dmError(error));
      return false;
    }
  }

  const blocker = context?.inviteStatus === "declined" && context.invitedBy !== device.userId;
  const blocked = context?.inviteStatus === "declined" && context.invitedBy === device.userId;
  const hasHistory = !!context && !locked;

  if (!messages && !readError) return <ThreadSkeleton />;

  return (
    <section aria-label={peer ? `Conversation with ${nameOf(peer)}` : "Conversation"} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 md:pt-2">
        <Link to="/messages" aria-label="Back to conversations" className="grid size-10 shrink-0 place-items-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:hidden">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        {peer ? (
          <Link to={`/@${peer.handle}`} className="group/profile flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <PersonAvatar user={peer} />
            <span className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold group-hover/profile:underline">{nameOf(peer)}</h2>
              <span className="block truncate text-xs text-muted-foreground">@{peer.handle}</span>
            </span>
          </Link>
        ) : (
          <div className="min-w-0 flex-1 px-1"><h2 className="truncate text-sm font-semibold">Conversation</h2></div>
        )}
        <IconButton label="Search this conversation" aria-expanded={searching} onClick={() => setSearching((open) => !open)}>
          <Search aria-hidden="true" />
        </IconButton>
        <IconButton label="Chat security code" aria-expanded={showCode} onClick={() => setShowCode((open) => !open)}>
          <LockKeyhole aria-hidden="true" />
        </IconButton>
        <ActionMenu
          title="Conversation"
          hideTitle
          trigger={<IconButton label="Conversation options" aria-label="Conversation options"><span aria-hidden="true" className="text-lg leading-none">⋯</span></IconButton>}
          items={[
            { label: "Security code", icon: ShieldCheck, kind: "action", onClick: () => setShowCode(true) },
            { label: "Close conversation", icon: EyeOff, kind: "action", onClick: () => void closeConversation(), destructive: true },
          ]}
        />
      </header>
      <Collapse open={searching && !!context}>
        {context && <ThreadSearch
          device={device}
          conversationId={id}
          peer={context.peer}
          self={context.self}
          lastMessageAt={messages?.at(-1)?.createdAt ?? null}
          onPick={(messageId) => setParams((current) => { const next = new URLSearchParams(current); next.set("m", messageId); return next; }, { replace: true })}
          onClose={() => setSearching(false)}
        />}
      </Collapse>
      {context?.peerIdentity && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm" role="status">
          <p>Verify this contact’s new security code before sending messages.</p>
          {!showCode && <Button size="sm" variant="outline" onClick={() => setShowCode(true)}>View code</Button>}
        </div>
      )}
      <Collapse open={showCode}>
        <div className="space-y-1 border-b border-border bg-muted/25 px-4 py-3 text-sm">
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
      </Collapse>

      {context?.inviteStatus === "pending" && !locked && context.invitedBy !== device.userId && (
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium">@{context.peer.handle} wants to message you</p>
            <p className="text-xs text-muted-foreground">They can send up to {requestLimit} messages until you accept. Declining blocks messages between you two.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" disabled={responding} onClick={() => void respond("accepted")}>Accept</Button>
            <Button size="sm" variant="outline" disabled={responding} onClick={() => void respond("declined")}>
              <Ban aria-hidden="true" /> Decline
            </Button>
          </div>
        </div>
      )}
      {blocker && !locked && (
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium">You blocked messages from @{context.peer.handle}</p>
            <p className="text-xs text-muted-foreground">Neither of you can send messages. Unblock to talk again.</p>
          </div>
          <Button size="sm" variant="outline" disabled={responding} onClick={() => void unblock()}>Unblock</Button>
        </div>
      )}

      <div ref={scroller} onScroll={(event) => {
        const element = event.currentTarget;
        stickToBottom.current = element.scrollHeight - element.clientHeight - element.scrollTop < 64;
      }} tabIndex={0} aria-label="Message history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <div ref={content} className="flex min-h-full flex-col justify-end px-2 pt-6 pb-2 sm:px-3">
          {more && (
            <div ref={older} className="flex h-8 items-center justify-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              {loadingOlder && <><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> Loading earlier messages…</>}
            </div>
          )}
          {hasHistory && messages?.length === 0 && !readError && (
            <p className="px-2 text-sm text-muted-foreground">
              {needsDevice || paused || asked ? "No messages yet." : accepted ? "No messages on this device yet." : null}
            </p>
          )}
          {hasHistory && messages && messages.length > 0 && (
            <MessageRows
              messages={messages} context={context} conversationId={id} byId={byId} actions={actions} acknowledge={acknowledge}
              editingId={editingId} setEditingId={setEditingId} selectedId={selectedId} setSelectedId={setSelectedId}
              flashId={flashId} canWrite={accepted}
            />
          )}
          {blocked && !locked && <p className="px-2 pt-3 text-sm text-muted-foreground">@{context.peer.handle} isn’t accepting messages from you.</p>}
          {typing && peer && accepted && <TypingBubble user={peer} />}
        </div>
      </div>

      {readError && <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-1 text-xs text-destructive">
        <p role="alert">{readError}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => refreshNow()}>Retry</Button>
      </div>}
      {actionError && <p role="alert" className="shrink-0 px-4 py-1 text-xs text-destructive">{actionError}</p>}

      {asked && !needsDevice && !paused && (
        <div role="status" className="mb-2 flex shrink-0 items-start gap-3 border-y border-border bg-muted px-3 py-3 sm:px-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background text-muted-foreground">
            <Mail aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-semibold">Message request</p>
              <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {Math.min(requestLimit, Math.max(sentInRequest, context.requestSent))} of {requestLimit} sent
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              You’re asking to start a conversation. {requestOpen
                ? `You can send up to ${requestLimit} messages before the other person accepts.`
                : "You’ve reached the limit. The other person needs to accept before you can send more."}
            </p>
          </div>
        </div>
      )}
      {(accepted || asked) && (
        <form onSubmit={(event) => void submit(event)} className="shrink-0 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {needsDevice || paused ? (
            <p role="status" className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground">
              <ShieldQuestion aria-hidden="true" className="size-4 shrink-0" />
              <span>
                {context.selfOptedOut ? "You turned Messages off. Turn them back on from Chat devices to write here."
                  : context.peerOptedOut ? `@${context.peer.handle} has turned off Messages.`
                  : `@${context.peer.handle} has turned off Messages.`}
              </span>
            </p>
          ) : null}
          {tooLong && <p role="alert" className="px-1 pb-1 text-xs text-destructive">This message is too long.</p>}
          {!needsDevice && !paused && <div className="rounded-xl border border-input bg-muted/30 transition-colors focus-within:border-ring">
            {replyTo && (
              <div className="flex items-center gap-2 border-b border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                <CornerUpLeft aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  Replying to <span className="font-medium text-foreground">{nameOf(replyTo.senderId === device.userId ? context!.self : context!.peer)}</span>
                  {snippet(replyTo.text) ? <> · {snippet(replyTo.text)}</> : null}
                </span>
                <IconButton label="Cancel reply" size="icon-xs" onClick={() => setReplyTo(null)}>
                  <X aria-hidden="true" />
                </IconButton>
              </div>
            )}
            <div className="flex items-end gap-1 p-1">
              {recording ? (
                <VoiceRecorderBar onCancel={() => setRecording(false)} onSend={(recorded) => void sendVoice(recorded)} />
              ) : (
                <>
                  <AttachMenu
                    disabled={!canSend || sending}
                    onVoice={() => setRecording(true)}
                    onGif={(gif) => void sendParts({ gif })}
                    onPoll={(poll) => void sendParts({ poll })}
                  />
                  <MentionTextarea
                    ref={composer}
                    aria-label="Message"
                    value={draft}
                    onValueChange={onDraft}
                    onChange={(event) => onDraft(event.target.value)}
                    placeholder={!canSend && !accepted && !requestOpen ? "Waiting for them to accept" : peer ? `Message @${peer.handle}` : "Message"}
                    disabled={!canSend}
                    readOnly={sending}
                    rows={1}
                    dropUp
                    wrapperClassName="relative min-w-0 flex-1"
                    className="max-h-40 min-h-9 resize-none rounded-lg border-0 bg-transparent px-2 py-[7px] shadow-none focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent"
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) return;
                      if (event.key === "Escape" && replyTo) {
                        setReplyTo(null);
                      } else if (event.key === "Enter" && !event.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
                        event.preventDefault();
                        void submit();
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="shrink-0 rounded-lg" aria-label="Send message" disabled={!canSend || sending || tooLong || !draft.trim()}>
                    <SendHorizontal aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>
          </div>}
        </form>
      )}
      <ConfirmationDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Delete this message?"
        description="It disappears for both of you and can’t be brought back."
        confirmLabel="Delete"
        destructive
        onConfirm={deleteMessage}
      />
    </section>
  );
}

const MessageRows = memo(function MessageRows({
  messages, context, conversationId, byId, actions, acknowledge, editingId, setEditingId, selectedId, setSelectedId, flashId, canWrite,
}: {
  messages: DisplayMessage[];
  context: Context;
  conversationId: string;
  byId: Map<string, DisplayMessage>;
  actions: RowActions;
  acknowledge: (ids: string[], signal: AbortSignal) => Promise<void>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  flashId: string | null;
  canWrite: boolean;
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
          || date.getTime() - Date.parse(previous.createdAt) > 5 * 60_000 || !!message.reply;
        const sender = message.senderId === context.self.id ? context.self : context.peer;
        const original = message.reply ? byId.get(message.reply) : undefined;
        return (
          <li key={message.id} data-readable-message={message.text !== null && sender.id === context.peer.id ? message.id : undefined}>
            {newDay && <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{day}</div>}
            <MessageRow
              message={message}
              sender={sender}
              peer={context.peer}
              selfId={context.self.id}
              conversationId={conversationId}
              withHeader={withHeader}
              replied={original ? { sender: original.senderId === context.self.id ? context.self : context.peer, text: snippet(original.text) } : null}
              editing={editingId === message.id}
              onEditing={(editing) => setEditingId(editing ? message.id : null)}
              flash={flashId === message.id}
              selected={selectedId === message.id}
              onSelect={(selected) => setSelectedId(selected ? message.id : null)}
              actions={actions}
              canWrite={canWrite}
            />
          </li>
        );
      })}
    </ol>
  );
});


