import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageSquarePlus } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { type Session } from "@/lib/api";
import { ConversationList } from "./conversation-list";
import { dmApi, dmError, type Conversation } from "./dm-api";
import { type LocalDevice } from "./dm-crypto";
import { DmDeviceGate } from "./dm-devices";
import { subscribeDm, useDmUpdates } from "./dm-live";
import { useDmUnread } from "./dm-unread";
import { openConversation } from "./dm-send";
import { NewMessageDialog } from "./new-message-dialog";
import { MessagingOff, useMessagingPreference } from "./messaging-preference";
import { ChatDevicesSkeleton, MessagesLayout, MessagesSkeleton } from "./messages-loading";
import { Thread } from "./thread";

export function MessagesPage({ session, sessionError, managingDevices = false }: { session: Session | null; sessionError: string; managingDevices?: boolean }) {
  const title = managingDevices ? "Chat devices" : "Messages";
  usePageTitle(title);
  const { conversationId } = useParams();
  const loading = managingDevices ? <ChatDevicesSkeleton /> : <MessagesSkeleton showThread={!!conversationId} />;
  if (session === null && !sessionError) return loading;
  if (!session?.authenticated || session.needsOnboarding || session.pendingApproval || session.ban) {
    return (
      <div className="mx-auto max-w-xl space-y-2 px-4 py-5 sm:px-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        {session && (
          <p className="text-sm text-muted-foreground">
            {!session.authenticated ? <Link to="/login" className="underline">Sign in to use Messages.</Link>
              : "Messages are available to approved accounts in good standing."}
          </p>
        )}
      </div>
    );
  }
  return (
    <DmDeviceGate key={session.user.id} userId={session.user.id} managingDevices={managingDevices} loading={loading}>
      {(device, pending) => <Inbox device={device} conversationId={conversationId} pending={pending} />}
    </DmDeviceGate>
  );
}

const inboxChange = (event: { type: string }) => event.type === "conversation" ? true : undefined;

function Inbox({ device, conversationId, pending }: { device: LocalDevice; conversationId?: string; pending: number }) {
  const [conversations, setConversations] = useState<Conversation[]>();
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [typing, setTyping] = useState<ReadonlySet<string>>(new Set());
  const [query] = useSearchParams();
  const target = query.get("to");
  const { refresh: refreshUnread } = useDmUnread();
  const messaging = useMessagingPreference(device);
  const navigate = useNavigate();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
  const changed = useCallback(() => {
    refreshNow();
    refreshUnread();
  }, [refreshNow, refreshUnread]);

  useEffect(() => {
    const active = timers.current;
    const unsubscribe = subscribeDm(device.userId, (event) => {
      if (event.type !== "typing") return;
      clearTimeout(active.get(event.id));
      setTyping((current) => new Set(current).add(event.id));
      active.set(event.id, setTimeout(() => {
        active.delete(event.id);
        setTyping((current) => {
          const next = new Set(current);
          next.delete(event.id);
          return next;
        });
      }, 5500));
    });
    return () => {
      unsubscribe();
      active.forEach(clearTimeout);
      active.clear();
    };
  }, [device.userId]);

  async function close(conversation: Conversation) {
    try {
      await dmApi.close(conversation.id, device);
      setConversations((list) => list?.filter(({ id }) => id !== conversation.id));
      if (conversation.id === conversationId) void navigate("/messages", { replace: true });
      refreshNow();
    } catch (reason) {
      setError(dmError(reason));
    }
  }

  if (messaging.enabled === false) return <MessagingOff onEnable={() => messaging.change(true)} error={messaging.error} />;
  return (
    <MessagesLayout showThread={!!conversationId} sidebar={(
      <ConversationList
        conversations={conversations}
        error={error}
        userId={device.userId}
        typing={typing}
        pendingDevices={pending}
        onNew={() => setComposing(true)}
        onClose={(conversation) => void close(conversation)}
      />
    )}>
      {target && !conversationId ? (
        <OpenTarget key={target} handle={target} device={device} onOpened={changed} />
      ) : conversationId ? (
        <Thread key={conversationId} id={conversationId} device={device} onChange={changed} />
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-6 text-center md:flex">
          <MessageSquarePlus aria-hidden="true" className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Your messages</p>
            <p className="text-sm text-muted-foreground">Pick a conversation, or start a new one.</p>
          </div>
          <Button size="sm" onClick={() => setComposing(true)}>New message</Button>
        </div>
      )}
      <NewMessageDialog open={composing} onOpenChange={setComposing} device={device} selfId={device.userId} onOpened={changed} />
    </MessagesLayout>
  );
}

function OpenTarget({ handle, device, onOpened }: { handle: string; device: LocalDevice; onOpened: () => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/.test(clean)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("That isn’t a valid handle.");
      return;
    }
    openConversation(clean, device).then((id) => {
      if (!active) return;
      onOpened();
      void navigate(`/messages/${id}`, { replace: true });
    }).catch((reason) => {
      if (active) setError(dmError(reason));
    });
    return () => { active = false; };
  }, [handle, device, navigate, onOpened, attempt]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      {error ? (
        <>
          <p role="alert" className="text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setError(""); setAttempt((n) => n + 1); }}>Try again</Button>
            <Button size="sm" variant="ghost" render={<Link to="/messages" />} nativeButton={false}>Back to messages</Button>
          </div>
        </>
      ) : (
        <>
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
          <p role="status">Opening your conversation with @{handle.replace(/^@/, "")}…</p>
        </>
      )}
    </div>
  );
}
