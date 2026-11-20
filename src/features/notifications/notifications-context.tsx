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
import { subscribeDm } from "@/features/dms/dm-live";
import { NotificationPrompt } from "./notification-prompt";
import { registerPushWorker, supportsPush } from "./enable-push";

function useNotificationState(userId: string | null, canWrite: boolean) {
  const [items, setItems] = useState<SocialNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const previewVisibility = useRef<boolean | undefined>(undefined);
  const [hideContent, setHideContent] = useState(false);
  const applyPrivacy = useCallback((hidden: boolean | undefined) => {
    if (hidden === undefined) return;
    previewVisibility.current = hidden;
    setHideContent(hidden);
    if (hidden) {
      setItems((previous) => previous.map((item) => item.chatPreview || item.preview
        ? { ...item, chatPreview: false, preview: null }
        : item));
    }
  }, []);
  const refresh = useCallback(
    async (cursor?: string) => {
      if (!userId) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError("");
      try {
        const result = await api.notifications(
          cursor,
          false,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        applyPrivacy(result.hideContent);
        setItems((previous) =>
          cursor
            ? [
                ...previous,
                ...result.notifications.filter(
                  (item) => !previous.some((old) => old.id === item.id),
                ),
              ]
            : result.notifications,
        );
        setUnreadCount(result.unreadCount);
        setNextCursor(result.nextCursor);
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [userId, applyPrivacy],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Keep the badge and privacy setting current even without a live connection.
    const poll = async () => {
      if (document.visibilityState !== "visible" || !userId) return;
      const startedWithRequest = request.current;
      const revision = privacyRevision;
      try {
        const result = await api.notifications(
          undefined,
          false,
          controller.signal,
        );
        if (controller.signal.aborted || request.current !== startedWithRequest || revision !== privacyRevision) return;
        setUnreadCount(result.unreadCount);
        if (result.hideContent !== undefined && result.hideContent !== previewVisibility.current) {
          applyPrivacy(result.hideContent);
          void refresh();
        }
      } catch {
        /* The panel exposes errors with a retry action. */
      }
    };
    const controller = new AbortController();
    let privacyRevision = 0;
    let liveRefresh: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = userId && canWrite ? subscribeDm(userId, (event) => {
      if (event.type === "previews") {
        privacyRevision++;
        request.current?.abort();
        applyPrivacy(event.hidden);
      }
      if (event.type === "ready" || event.type === "notifications" || event.type === "previews") {
        clearTimeout(liveRefresh);
        liveRefresh = setTimeout(() => void refresh(), 100);
      }
    }) : undefined;
    const timer = setInterval(() => void poll(), 30_000);
    const onPush = () => {
      void refresh();
    };
    window.addEventListener("focus", onPush);
    navigator.serviceWorker?.addEventListener("message", onPush);
    return () => {
      clearInterval(timer);
      clearTimeout(liveRefresh);
      unsubscribe?.();
      controller.abort();
      request.current?.abort();
      window.removeEventListener("focus", onPush);
      navigator.serviceWorker?.removeEventListener("message", onPush);
    };
  }, [refresh, userId, canWrite, applyPrivacy]);
  useEffect(() => {
    if (!userId || !supportsPush()) return;
    void navigator.serviceWorker.getRegistration("/").then((registration) => {
      if (registration) return registerPushWorker();
    }).catch(() => {});
  }, [userId]);
  async function markRead(id?: string) {
    const newest = items[0];
    if (!canWrite || busy || (!id && !newest)) return false;
    setBusy(true);
    setError("");
    try {
      if (id) await api.readNotification(id);
      else await api.readAllNotifications(newest.createdAt);
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
    userId,
    hideContent,
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
