import { useEffect, useRef, type RefObject } from "react";

type Acknowledge = (ids: string[], signal: AbortSignal) => Promise<unknown>;

export function useVisibleMessageReads(list: RefObject<HTMLOListElement | null>, messageVersion: unknown, read: Acknowledge) {
  const acknowledged = useRef(new Set<string>());
  const pending = useRef(new Set<string>());

  useEffect(() => {
    if (!list.current || typeof IntersectionObserver === "undefined") return;
    const element = list.current;
    const controller = new AbortController();
    const seen = acknowledged.current;
    const queued = pending.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;

    function schedule(delay = 150) {
      if (!busy && !timer && queued.size && !document.hidden) timer = setTimeout(flush, delay);
    }

    async function flush() {
      timer = undefined;
      if (document.hidden || controller.signal.aborted || !queued.size) return;
      const batch = [...queued].slice(0, 40);
      let delay = 150;
      busy = true;
      try {
        await read(batch, controller.signal);
        if (controller.signal.aborted) return;
        for (const id of batch) {
          queued.delete(id);
          seen.add(id);
        }
      } catch {
        delay = 5000;
      } finally {
        busy = false;
        if (!controller.signal.aborted) schedule(delay);
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (document.hidden) return;
      for (const { isIntersecting, target } of entries) {
        const id = target.getAttribute("data-readable-message");
        if (isIntersecting && id && !seen.has(id)) queued.add(id);
      }
      schedule();
    });
    function observeVisible() {
      observer.disconnect();
      if (document.hidden) return;
      for (const row of element.querySelectorAll("[data-readable-message]")) {
        const id = row.getAttribute("data-readable-message");
        if (id && !seen.has(id)) observer.observe(row);
      }
      schedule();
    }

    observeVisible();
    document.addEventListener("visibilitychange", observeVisible);
    return () => {
      controller.abort();
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", observeVisible);
    };
  }, [list, messageVersion, read]);
}
