import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("devices") }),
  z.object({ type: z.literal("conversation"), id: z.uuid(), roster: z.boolean(), message: z.uuid().optional(), read: z.literal(true).optional() }),
  z.object({ type: z.literal("typing"), id: z.uuid(), userId: z.uuid() }),
  z.object({ type: z.literal("notifications") }),
  z.object({ type: z.literal("previews"), hidden: z.boolean() }),
]);
export type DmLiveEvent = z.infer<typeof eventSchema> | { type: "offline" };
type Listener = (event: DmLiveEvent) => void;

const subscriptions = new Map<string, ReturnType<typeof connection>>();

function connection() {
  const listeners = new Set<Listener>();
  let socket: WebSocket | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let delay = 1000;
  let ready = false;
  const notify = (event: DmLiveEvent) => listeners.forEach((listener) => listener(event));

  function connect() {
    if (socket || retry || document.hidden || !listeners.size || typeof WebSocket === "undefined") return;
    const url = new URL("/api/dms/live", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const next = new WebSocket(url);
    socket = next;
    next.addEventListener("message", ({ data }) => {
      if (socket !== next || typeof data !== "string") return;
      try {
        const event = eventSchema.parse(JSON.parse(data));
        if (event.type === "ready") {
          ready = true;
          delay = 1000;
        }
        notify(event);
      } catch {
        // Ignore malformed frames and continue receiving updates.
      }
    });
    next.addEventListener("close", () => {
      if (socket !== next) return;
      socket = undefined;
      ready = false;
      notify({ type: "offline" });
      if (document.hidden || !listeners.size) return;
      retry = setTimeout(() => {
        retry = undefined;
        connect();
      }, delay + Math.random() * 500);
      delay = Math.min(delay * 2, 30_000);
    });
  }

  function disconnect() {
    clearTimeout(retry);
    retry = undefined;
    const previous = socket;
    socket = undefined;
    ready = false;
    previous?.close();
  }

  function visibilityChanged() {
    if (document.hidden) {
      disconnect();
      notify({ type: "offline" });
    } else connect();
  }

  document.addEventListener("visibilitychange", visibilityChanged);
  return {
    listeners,
    subscribe(listener: Listener) {
      listeners.add(listener);
      if (ready) listener({ type: "ready" });
      connect();
    },
    send(frame: string) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(frame);
    },
    close() {
      disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
    },
  };
}

export function sendTyping(userId: string, conversationId: string) {
  subscriptions.get(userId)?.send(JSON.stringify({ type: "typing", id: conversationId }));
}

export function subscribeDm(userId: string, listener: Listener) {
  const current = subscriptions.get(userId) ?? connection();
  subscriptions.set(userId, current);
  current.subscribe(listener);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size) return;
    current.close();
    subscriptions.delete(userId);
  };
}

type Refresh = (signal: AbortSignal, full: boolean) => Promise<void>;

export function useDmUpdates(userId: string, refresh: Refresh, match: (event: DmLiveEvent) => boolean | undefined, batchMs = 0) {
  const request = useRef<((full?: boolean) => void) | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    let queued: boolean | undefined;
    let online = false;
    let batch: ReturnType<typeof setTimeout> | undefined;

    async function drain() {
      busy = true;
      try {
        while (!controller.signal.aborted && queued !== undefined && !document.hidden) {
          const full = queued;
          queued = undefined;
          await refresh(controller.signal, full);
        }
      } finally {
        busy = false;
      }
    }

    function schedule(full: boolean, deferred = false) {
      queued = !!queued || full;
      if (busy || document.hidden) return;
      if (deferred && batchMs) {
        batch ??= setTimeout(() => {
          batch = undefined;
          if (!busy) void drain();
        }, batchMs);
        return;
      }
      clearTimeout(batch);
      batch = undefined;
      void drain();
    }

    const refreshNow = (full = true) => schedule(full);
    request.current = refreshNow;
    const unsubscribe = subscribeDm(userId, (event) => {
      if (event.type === "ready") {
        online = true;
        refreshNow();
      } else if (event.type === "offline") {
        online = false;
      } else {
        const mode = match(event);
        if (mode !== undefined) schedule(mode, true);
      }
    });
    const fallback = setInterval(() => { if (!online) refreshNow(); }, 25_000);
    const onVisibility = () => { if (!document.hidden) refreshNow(); };
    document.addEventListener("visibilitychange", onVisibility);
    if (!online) refreshNow();
    return () => {
      controller.abort();
      clearTimeout(batch);
      clearInterval(fallback);
      unsubscribe();
      request.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, refresh, match, batchMs]);
  return useCallback((full = true) => request.current?.(full), []);
}
