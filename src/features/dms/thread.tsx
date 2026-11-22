import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type FormEvent, type ReactElement, type RefObject } from "react";
import { ArrowDown, ArrowLeft, Ban, Search, CornerUpLeft, EyeOff, LockKeyhole, Mail, SendHorizontal, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";
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
import { MessageRow, nameOf, PersonAvatar, reportText, type RowActions, type OutgoingMessage } from "./message-row";
import { EarlierMessagesSkeleton, ThreadSkeleton } from "./messages-loading";
import { maxReportContext } from "@/features/reports/report-dialog";
import { useMessageWindow } from "./message-window";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const olderFadeMs = 180;
const withEmoji = (text: string) => {
  const index = peekEmojiIndex();
  return index ? renderShortcodes(text, index) : text;
};
const snippet = (text: string | null) => text === null ? null : text.replace(/\s+/g, " ").trim().slice(0, 140);

export function Thread({ id, device, drafts, outbox, updateOutbox, sendingLifetime, onChange, onClose, renderCloseConfirmation }: {
  id: string;
  device: LocalDevice;
  drafts: RefObject<Map<string, string>>;
  outbox: OutgoingMessage[];
  updateOutbox: (id: string, update: (current: OutgoingMessage[]) => OutgoingMessage[]) => void;
  sendingLifetime: RefObject<AbortController | null>;
  onChange: () => void;
  onClose: () => void;
  renderCloseConfirmation: (trigger: ReactElement) => ReactElement;
}) {
  const { refresh: refreshNotifications } = useNotifications();
  const { refresh: refreshUnread } = useDmUnread();
  const [context, setContext] = useState<Context>();
  const contextRef = useRef<Context>(undefined);
  const [messages, setMessages] = useState<DisplayMessage[]>();
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const [fadingOlder, setFadingOlder] = useState<ReadonlySet<string>>();
  const [readError, setReadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [locked, setLocked] = useState(false);
  const [draft, setDraftValue] = useState(() => drafts.current.get(id) ?? "");
  const [uploading, setUploading] = useState(false);
  const sending = uploading || outbox.some(({ delivery }) => delivery === "sending");
  const [newMessages, setNewMessages] = useState(0);
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
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const historyWindow = useRef<{ scrollToMessage: (id: string) => void }>(null);
  const cursor = useRef<string | undefined>(undefined);
  const messageRequests = useRef(new Map<string, AbortController>());
  const operations = useRef<AbortController | null>(null);
  const sendBusy = useRef(false);
  const paging = useRef(false);
  const historyVersion = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingSent = useRef(0);
  const setOutbox = useCallback((update: (current: OutgoingMessage[]) => OutgoingMessage[]) => {
    updateOutbox(id, update);
  }, [id, updateOutbox]);

  function setDraft(value: string) {
    setDraftValue(value);
    if (value) drafts.current.set(id, value);
    else drafts.current.delete(id);
  }

  useEffect(() => {
    const controller = new AbortController();
    operations.current = controller;
    return () => controller.abort();
  }, []);

  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const older = useRef<HTMLDivElement>(null);
  const loadOlderRef = useRef<() => void>(() => {});
  const [params, setParams] = useSearchParams();
  const jumpTo = params.get("m");
  const jumpTries = useRef(0);

  const firstId = messages?.[0]?.id;
  useEffect(() => {
    const target = older.current;
    const root = scroller;
    if (!target || !root || !more || loadingOlder || olderError || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadOlderRef.current();
    }, { root });
    observer.observe(target);
    return () => observer.disconnect();
  }, [more, loadingOlder, olderError, firstId, scroller]);

  useEffect(() => {
    if (!fadingOlder) return;
    const timer = setTimeout(() => setFadingOlder(undefined), olderFadeMs);
    return () => clearTimeout(timer);
  }, [fadingOlder]);

  const refresh = useCallback(async (signal: AbortSignal, full: boolean) => {
    try {
      const previousCursor = cursor.current;
      let after = previousCursor;
      const cached = contextRef.current;
      const [initial, freshContext] = await Promise.all([
        dmApi.messages(id, device, after && !full ? { after } : undefined, signal),
        full || !cached ? readContext(id, device, signal) : cached,
      ]);
      const floor = initial.messages[0]?.sequence;
      const recent = full && previousCursor !== undefined && (!initial.more || (floor !== undefined && BigInt(floor) <= BigInt(previousCursor)));
      let page = full && previousCursor && !recent ? await dmApi.messages(id, device, { after: previousCursor }, signal) : initial;
      let firstPage = !previousCursor;
      let olderAvailable = firstPage && page.more;
      const encrypted: WireMessage[] = [];
      while (true) {
        encrypted.push(...page.messages);
        after = page.messages.at(-1)?.sequence ?? after;
        if (firstPage || recent || !page.more || !after) break;
        page = await dmApi.messages(id, device, { after }, signal);
      }
      const next = freshContext === cached && !cached.peerIdentity && encrypted.some((message) => !cached.senderKeys.has(message.senderDeviceId))
        ? await readContext(id, device, signal)
        : freshContext;
      if (signal.aborted) return;
      if (cached?.peerIdentity && !next.peerIdentity && !firstPage) {
        const latest = full ? initial : await dmApi.messages(id, device, undefined, signal);
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
      if (firstPage || recent || incoming.length) {
        cursor.current = previousCursor && (!after || BigInt(after) < BigInt(previousCursor)) ? previousCursor : after;
        if (firstPage || (recent && !initial.more)) {
          historyVersion.current++;
          setMore(firstPage && olderAvailable);
          setOlderError("");
        }
        setMessages((current) => {
          if (firstPage) return !current?.length && !incoming.length && current ? current : incoming;
          if (recent) {
            const earlier = initial.more && floor ? (current ?? []).filter(({ sequence }) => BigInt(sequence) < BigInt(floor)) : [];
            return [...earlier, ...incoming];
          }
          return [...(current ?? []), ...incoming];
        });
        if (incoming.length) {
          const arrived = new Set(incoming.map(({ id }) => id));
          setOutbox((current) => current.some(({ id }) => arrived.has(id)) ? current.filter(({ id }) => !arrived.has(id)) : current);
        }
        const fromPeer = incoming.filter(({ senderId, sequence }) => senderId === next.peer.id
          && (!previousCursor || BigInt(sequence) > BigInt(previousCursor))).length;
        if (fromPeer) {
          setTyping(false);
          if (!firstPage && !stickToBottom.current) setNewMessages((count) => count + fromPeer);
        }
      }
    } catch (error) {
      if (!signal.aborted) {
        if (error instanceof DeviceTrustError) setLocked(true);
        setReadError(dmError(error));
      }
    }
  }, [id, device, setOutbox]);
  const threadChange = useCallback((event: DmLiveEvent) => {
    if (event.type === "devices") return true;
    if (event.type === "conversation" && event.id === id && !event.message && !event.read) return event.roster;
  }, [id]);
  const refreshNow = useDmUpdates(device.userId, refresh, threadChange);
  useEffect(() => {
    if (outbox.some(({ delivery }) => delivery !== "sending")) refreshNow(false);
  }, [outbox, refreshNow]);

  const refreshOne = useCallback(async (messageId: string) => {
    const lifetime = operations.current?.signal;
    const current = contextRef.current;
    if (!lifetime || !current) return;
    const requests = messageRequests.current;
    requests.get(messageId)?.abort();
    const request = new AbortController();
    requests.set(messageId, request);
    const signal = AbortSignal.any([lifetime, request.signal]);
    try {
      const { message } = await dmApi.message(id, messageId, device, signal);
      const [next] = await decryptPage(id, device, contextRef.current ?? current, [message]);
      if (!signal.aborted) setMessages((list) => list?.some(({ id }) => id === messageId)
        ? list.map((entry) => entry.id === next.id ? next : entry) : list);
    } catch (error) {
      if (!signal.aborted && error instanceof ApiError && error.message === "dm_message_not_found")
        setMessages((list) => list?.some(({ id }) => id === messageId) ? list.filter((entry) => entry.id !== messageId) : list);
    } finally {
      if (requests.get(messageId) === request) requests.delete(messageId);
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

  async function loadOlder() {
    const first = messages?.[0];
    const signal = operations.current?.signal;
    if (!first || !context || !signal || paging.current) return;
    paging.current = true;
    const version = historyVersion.current;
    setLoadingOlder(true);
    setOlderError("");
    try {
      const result = await dmApi.messages(id, device, { before: first.sequence }, signal);
      const currentContext = contextRef.current ?? context;
      const older = await decryptPage(id, device, currentContext, result.messages);
      if (signal.aborted || version !== historyVersion.current) return;
      if (older.length) setFadingOlder(new Set(older.map(({ id }) => id)));
      setMessages((current) => [...older, ...(current ?? [])]);
      setMore(result.more);
    } catch (error) {
      if (!signal.aborted && version === historyVersion.current) setOlderError(dmError(error));
    } finally {
      paging.current = false;
      if (!signal.aborted) setLoadingOlder(false);
    }
  }

  const transmit = useCallback(async (
    messageId: string, payload: string, send: Parameters<typeof transmitMessage>[0]["send"], signal = operations.current?.signal,
  ) => {
    const current = contextRef.current;
    if (!signal || !current) throw new Error("This conversation isn’t ready yet.");
    await transmitMessage({
      id, device, signal, peerId: current.peer.id, messageId, payload, send,
      onStale: () => refreshNow(),
    });
  }, [id, device, refreshNow]);

  const sentInRequest = useMemo(
    () => (messages ?? []).filter((message) => message.senderId === device.userId).length,
    [messages, device.userId],
  );
  const asked = context?.inviteStatus === "pending" && context.invitedBy === device.userId;
  const accepted = context?.inviteStatus === "accepted";
  const requestCount = Math.max(context?.requestSent ?? 0, sentInRequest + outbox.filter(({ delivery }) => delivery !== "failed").length);
  const requestOpen = asked && requestCount < requestLimit;
  const peer = context?.peer;
  const needsDevice = !!context && !context.theirs?.active.length;
  const paused = !!context && (context.peerOptedOut || context.selfOptedOut);
  const canSend = (accepted || requestOpen) && !needsDevice && !paused && !context?.peerIdentity && !locked;
  const payload = encodePayload({ text: withEmoji(draft.trim()), reply: replyTo?.id });
  const tooLong = new TextEncoder().encode(payload).length > messageByteLimit;

  const deliver = useCallback(async (message: OutgoingMessage) => {
    const signal = sendingLifetime.current?.signal;
    if (sendBusy.current || sending || !signal || signal.aborted) return;
    sendBusy.current = true;
    setActionError("");
    setOutbox((current) => current.some(({ id }) => id === message.id)
      ? current.map((entry) => entry.id === message.id ? { ...message, delivery: "sending" } : entry)
      : [...current, { ...message, delivery: "sending" }]);
    try {
      await transmit(message.id, encodePayload(message), (encrypted, signal) =>
        dmApi.send(id, message.voice ? { ...encrypted, attachmentId: message.voice.id } : encrypted, signal), signal);
      if (signal.aborted) return;
      setOutbox((current) => current.map((entry) => entry.id === message.id ? { ...entry, delivery: "sent" } : entry));
      onChange();
    } catch (error) {
      if (!signal.aborted) {
        setOutbox((current) => current.map((entry) => entry.id === message.id
          ? { ...entry, delivery: "failed", error: dmError(error) }
          : entry));
      }
    } finally {
      sendBusy.current = false;
    }
  }, [id, onChange, sending, sendingLifetime, setOutbox, transmit]);

  function sendParts(parts: Omit<MessagePayload, "text"> & { text?: string }) {
    const text = withEmoji(parts.text ?? "");
    const message = {
      ...parts, text, reply: replyTo?.id, id: crypto.randomUUID(), senderId: device.userId,
      createdAt: new Date().toISOString(), delivery: "sending",
    } satisfies OutgoingMessage;
    if (sendBusy.current || sending || !canSend || (!text && !parts.gif && !parts.poll && !parts.voice)
      || new TextEncoder().encode(encodePayload(message)).length > messageByteLimit) return false;
    setReplyTo(null);
    typingSent.current = 0;
    stickToBottom.current = true;
    setNewMessages(0);
    void deliver(message);
    return true;
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || tooLong) return;
    if (sendParts({ text: draft.trim() })) setDraft("");
  }

  async function sendVoice({ blob, seconds, wave, mime }: Recorded) {
    setRecording(false);
    const signal = operations.current?.signal;
    if (!signal || sending || sendBusy.current) return;
    sendBusy.current = true;
    setUploading(true);
    setActionError("");
    try {
      const { data, key, iv } = await encryptFile(blob);
      const attachmentId = await dmApi.upload(id, data as Uint8Array<ArrayBuffer>, signal);
      if (signal.aborted) return;
      sendBusy.current = false;
      setUploading(false);
      sendParts({ voice: { id: attachmentId, key, iv, mime, seconds, wave } });
    } catch (error) {
      sendBusy.current = false;
      if (!signal.aborted) {
        setActionError(dmError(error));
        setUploading(false);
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
  const dismissOutgoing = useCallback((id: string) => {
    setOutbox((current) => current.filter((entry) => entry.id !== id));
  }, [setOutbox]);

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
      historyWindow.current?.scrollToMessage(messageId);
      setFlashId(messageId);
      setTimeout(() => setFlashId((current) => current === messageId ? null : current), 1400);
    },
  }), [id, refreshOne, transmit]);

  useEffect(() => {
    loadOlderRef.current = () => void loadOlder();
  });

  useEffect(() => {
    if (!jumpTo || !messages || loadingOlder || olderError) return;
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
  }, [jumpTo, messages, more, loadingOlder, olderError]);

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
            { label: "Close conversation", icon: EyeOff, kind: "action", onClick: onClose, renderInDrawer: renderCloseConfirmation, destructive: true },
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={setScroller} onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.clientHeight - element.scrollTop < 64;
          if (stickToBottom.current) setNewMessages(0);
        }} tabIndex={0} aria-label="Message history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <div ref={setContent} className="flex min-h-full flex-col justify-end overflow-x-clip px-2 pt-6 pb-2 sm:px-3">
            {more && (
              <div ref={older} className="h-25 shrink-0">
                {loadingOlder && <span role="status" className="sr-only">Fetching earlier messages</span>}
                {olderError ? (
                  <div className="flex h-full items-center justify-center">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void loadOlder()}>
                      Retry earlier messages
                    </Button>
                  </div>
                ) : <EarlierMessagesSkeleton />}
              </div>
            )}
            {hasHistory && messages?.length === 0 && !outbox.length && !readError && (
              <p className="px-2 text-sm text-muted-foreground">
                {needsDevice || paused || asked ? "No messages yet." : accepted ? "No messages on this device yet." : null}
              </p>
            )}
            {scroller && content && hasHistory && messages && (messages.length > 0 || outbox.length > 0) && (
              <MessageRows
                historyWindow={historyWindow} scroller={scroller} content={content} stickToBottom={stickToBottom}
                messages={messages} outbox={outbox} peer={context.peer} self={context.self} conversationId={id} byId={byId} actions={actions} acknowledge={acknowledge}
                editingId={editingId} setEditingId={setEditingId} selectedId={selectedId} setSelectedId={setSelectedId}
                flashId={flashId} fadingOlder={fadingOlder} canWrite={accepted} retry={deliver} dismiss={dismissOutgoing}
                retryDisabled={sending || paused || needsDevice || !!context.peerIdentity || blocked || blocker}
              />
            )}
            {blocked && !locked && <p className="px-2 pt-3 text-sm text-muted-foreground">@{context.peer.handle} isn’t accepting messages from you.</p>}
            {typing && peer && accepted && <TypingBubble user={peer} />}
          </div>
        </div>
        {newMessages > 0 && (
          <Button type="button" variant="outline" size="sm" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-sm"
            onClick={() => {
              const element = scroller;
              if (!element) return;
              stickToBottom.current = true;
              element.scrollTop = element.scrollHeight;
              setNewMessages(0);
              element.focus({ preventScroll: true });
            }}>
            <ArrowDown aria-hidden="true" /> {newMessages} new {newMessages === 1 ? "message" : "messages"}
          </Button>
        )}
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
        <form onSubmit={submit} className="shrink-0 px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {needsDevice || paused ? (
            <p role="status" className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground">
              <ShieldQuestion aria-hidden="true" className="size-4 shrink-0" />
              <span>
                {context.selfOptedOut ? "You turned Messages off. Turn them back on from Chat devices to write here."
                  : context.peerOptedOut ? `@${context.peer.handle} has turned off Messages.`
                  : `@${context.peer.handle} needs a verified device to receive messages.`}
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
                        submit();
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="shrink-0 rounded-lg" aria-label="Send message" disabled={!canSend || sending || tooLong || !draft.trim()}
                    onMouseDown={(event) => { if (document.activeElement === composer.current) event.preventDefault(); }}>
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
  messages, outbox, peer, self, conversationId, byId, actions, acknowledge, editingId, setEditingId, selectedId, setSelectedId,
  flashId, fadingOlder, canWrite, retry, dismiss, retryDisabled, historyWindow, scroller, content, stickToBottom,
}: {
  messages: DisplayMessage[];
  outbox: OutgoingMessage[];
  peer: Context["peer"];
  self: Context["self"];
  conversationId: string;
  byId: Map<string, DisplayMessage>;
  actions: RowActions;
  acknowledge: (ids: string[], signal: AbortSignal) => Promise<void>;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  flashId: string | null;
  fadingOlder?: ReadonlySet<string>;
  canWrite: boolean;
  retry: (message: OutgoingMessage) => void;
  dismiss: (id: string) => void;
  retryDisabled: boolean;
  historyWindow: RefObject<{ scrollToMessage: (id: string) => void } | null>;
  scroller: HTMLDivElement;
  content: HTMLDivElement;
  stickToBottom: RefObject<boolean>;
}) {
  const list = useRef<HTMLOListElement>(null);
  const [focusedId, setFocusedId] = useState<string>();
  const [interacting, setInteracting] = useState(new Set<string>());
  useVisibleMessageReads(list, acknowledge);
  const rows = useMemo(() => {
    const timeline = [...messages, ...outbox];
    return timeline.map((message, index) => {
      const previous = timeline[index - 1];
      const date = new Date(message.createdAt);
      const day = dateFormat.format(date);
      const newDay = !previous || dateFormat.format(new Date(previous.createdAt)) !== day;
      const withHeader = newDay || previous.senderId !== message.senderId
        || date.getTime() - Date.parse(previous.createdAt) > 5 * 60_000 || !!message.reply;
      const estimatedHeight = (withHeader ? 55 : 28) + (newDay ? 38 : 0) + (message.reply ? 18 : 0)
        + (message.text ? Math.floor(message.text.length / 55) * 20 : 0)
        + (message.gif ? 180 : message.voice ? 66 : message.poll ? 110 : 0);
      return { id: message.id, estimatedHeight, message, day, newDay, withHeader, sender: message.senderId === self.id ? self : peer };
    });
  }, [messages, outbox, self, peer]);
  const retained = useMemo(() => {
    const ids = new Set(interacting);
    if (selectedId) ids.add(selectedId);
    if (focusedId) ids.add(focusedId);
    if (editingId) ids.add(editingId);
    return ids;
  }, [editingId, focusedId, interacting, selectedId]);
  const { height, positions, offsets, observeRow, scrollToMessage } = useMessageWindow({
    items: rows, list, scroller, content, stickToBottom, retained,
  });
  useImperativeHandle(historyWindow, () => ({
    scrollToMessage(id) {
      stickToBottom.current = false;
      scrollToMessage(id);
    },
  }), [scrollToMessage, stickToBottom]);
  const onInteraction = useCallback((id: string, active: boolean) => {
    setInteracting((current) => {
      if (active === current.has(id)) return current;
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  return (
    <ol ref={list} aria-label="Messages" data-selecting={!!selectedId && byId.has(selectedId) || undefined}
      className="relative shrink-0 [&[data-selecting]>li:not(:has([data-selected]))]:blur-[1.5px]" style={{ height }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(undefined);
      }}>
      {positions.map((position) => {
        const { message, day, newDay, withHeader, sender } = rows[position];
        const original = message.reply ? byId.get(message.reply) : undefined;
        const pending = "delivery" in message;
        return (
          <MessageListItem key={message.id} id={message.id} top={offsets[position]} position={position}
            count={rows.length} readable={message.text !== null && sender.id === peer.id} fading={fadingOlder?.has(message.id)}
            observe={observeRow} onFocus={setFocusedId}>
            {newDay && <div className="my-3 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{day}</div>}
            <MessageRow
              message={message}
              sender={sender}
              peer={peer}
              self={self}
              conversationId={conversationId}
              withHeader={withHeader}
              replied={original}
              editing={editingId === message.id}
              onEditing={setEditingId}
              flash={flashId === message.id}
              selected={selectedId === message.id}
              onSelect={setSelectedId}
              actions={actions}
              canWrite={canWrite}
              retry={pending ? retry : undefined}
              dismiss={pending ? dismiss : undefined}
              sending={pending && retryDisabled}
              onInteraction={onInteraction}
              reportContext={!pending && sender.id === peer.id
                ? () => messages.slice(0, position).filter(({ text }) => text !== null).slice(-maxReportContext)
                  .map((earlier) => ({ id: earlier.id, text: reportText(earlier) }))
                : undefined}
            />
          </MessageListItem>
        );
      })}
    </ol>
  );
});

function MessageListItem({ id, top, position, count, readable, fading, observe, onFocus, children }: {
  id: string;
  top: number;
  position: number;
  count: number;
  readable: boolean;
  fading?: boolean;
  observe: (id: string, row: HTMLLIElement) => () => void;
  onFocus: (id: string) => void;
  children: React.ReactNode;
}) {
  const ref = useCallback((row: HTMLLIElement | null) => {
    if (row) return observe(id, row);
  }, [id, observe]);
  return (
    <li ref={ref} data-virtual-message={id} data-readable-message={readable ? id : undefined}
      aria-posinset={position + 1} aria-setsize={count} tabIndex={-1} onFocus={() => onFocus(id)}
      className={`absolute inset-x-0 pb-px outline-none has-[[data-selected]]:z-20 ${fading ? "animate-in fade-in-0 motion-reduce:animate-none" : ""}`}
      style={{ top, animationDuration: fading ? olderFadeMs + "ms" : undefined }}>
      {children}
    </li>
  );
}
