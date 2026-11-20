import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, errorMessage, type SocialNotification } from "@/lib/api";
import { NotificationPrompt } from "./notification-prompt";

function useNotificationState(userId: string | null, canWrite: boolean) {
  const [items, setItems] = useState<SocialNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const countRequest = useRef(0);
  const reading = useRef(new Set<string>());
  const refresh = useCallback(
    async (cursor?: string) => {
      if (!userId) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const countVersion = ++countRequest.current;
      setLoading(true);
      setError("");
      try {
        const result = await api.notifications(
          cursor,
          false,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setItems((previous) => {
          const existing = new Map(previous.map((item) => [item.id, item]));
          if (cursor)
            return [
              ...previous,
              ...result.notifications.filter((item) => !existing.has(item.id)),
            ];
          return result.notifications.map((item) => ({
            ...item,
            readAt: item.readAt ?? existing.get(item.id)?.readAt ?? null,
          }));
        });
        if (countVersion === countRequest.current)
          setUnreadCount(result.unreadCount);
        setNextCursor(result.nextCursor);
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [userId],
  );
  const syncUnreadCount = useCallback(async (signal?: AbortSignal) => {
    const countVersion = ++countRequest.current;
    try {
      const result = await api.notifications(undefined, false, signal);
      if (!signal?.aborted && countVersion === countRequest.current)
        setUnreadCount(result.unreadCount);
    } catch {
      /* The next poll or inbox refresh will update the count. */
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Poll only the count while idle. Opening the panel refreshes its contents.
    const poll = () => {
      if (document.visibilityState !== "visible" || !userId) return;
      void syncUnreadCount(controller.signal);
    };
    const controller = new AbortController();
    const timer = setInterval(() => void poll(), 30_000);
    const onPush = () => {
      void refresh();
    };
    window.addEventListener("focus", onPush);
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      clearInterval(timer);
      controller.abort();
      request.current?.abort();
      window.removeEventListener("focus", onPush);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [refresh, syncUnreadCount, userId]);
  const markSeen = useCallback(
    async (ids: string[], reportError = false) => {
      if (!canWrite) return;
      const pending = reading.current;
      const unread = ids.filter((id) => {
        if (pending.has(id)) return false;
        pending.add(id);
        return true;
      });
      if (unread.length === 0) return;
      if (reportError) setError("");
      const results = await Promise.allSettled(
        unread.map(async (id) => {
          await api.readNotification(id);
          return id;
        }),
      );
      const readIds = new Set(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        ),
      );
      for (const id of unread) pending.delete(id);
      if (reportError) {
        const failure = results.find((result) => result.status === "rejected");
        if (failure) setError(errorMessage(failure.reason));
      }
      if (readIds.size === 0) return;
      const readAt = new Date().toISOString();
      setItems((previous) =>
        previous.map((item) =>
          !item.readAt && readIds.has(item.id) ? { ...item, readAt } : item,
        ),
      );
      await syncUnreadCount();
    },
    [canWrite, syncUnreadCount],
  );
  async function markRead() {
    const newest = items[0];
    if (!canWrite || busy || !newest) return false;
    setBusy(true);
    setError("");
    try {
      await api.readAllNotifications(newest.createdAt);
      await refresh();
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    items,
    unreadCount,
    nextCursor,
    loading,
    error,
    busy,
    refresh,
    markRead,
    markSeen,
    signedIn: !!userId,
    canWrite,
  };
}
const NotificationsContext = createContext<ReturnType<
  typeof useNotificationState
> | null>(null);
export function NotificationsProvider({
  userId,
  canWrite,
  holdPrompt,
  children,
}: {
  userId: string | null;
  canWrite: boolean;
  holdPrompt: boolean;
  children: ReactNode;
}) {
  const value = useNotificationState(userId, canWrite);
  return (
    <NotificationsContext.Provider value={value}>
      {userId && canWrite && !holdPrompt && <NotificationPrompt key={userId} userId={userId} />}
      {children}
    </NotificationsContext.Provider>
  );
}
export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("NotificationsProvider is missing");
  return context;
}
