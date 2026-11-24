import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { subscribeDm } from "./dm-live";
import { dmApi } from "./dm-api";

type Unread = { unread: number; requests: number; refresh: () => void };

const DmUnreadContext = createContext<Unread>({ unread: 0, requests: 0, refresh: () => {} });

export function DmUnreadProvider({ userId, enabled, children }: { userId: string | null; enabled: boolean; children: ReactNode }) {
  const [counts, setCounts] = useState({ unread: 0, requests: 0 });
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    if (!userId || !enabled) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    dmApi.unread(controller.signal).then((next) => {
      if (!controller.signal.aborted) setCounts((current) => current.unread === next.unread && current.requests === next.requests ? current : next);
    }).catch(() => undefined);
  }, [userId, enabled]);

  useEffect(() => {
    if (!userId || !enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    };
    soon();
    const unsubscribe = subscribeDm(userId, (event) => {
      if (event.type === "ready" || event.type === "conversation" || event.type === "notifications") soon();
    });
    const poll = setInterval(() => { if (!document.hidden) refresh(); }, 45_000);
    const onVisible = () => { if (!document.hidden) soon(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      unsubscribe();
      request.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, enabled, refresh]);

  const value = useMemo(() => ({ ...counts, refresh }), [counts, refresh]);
  return <DmUnreadContext.Provider value={value}>{children}</DmUnreadContext.Provider>;
}

export function useDmUnread() {
  return useContext(DmUnreadContext);
}

export function countLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}
