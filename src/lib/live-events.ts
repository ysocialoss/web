import { z } from "zod/mini";

const livePostSchema = z.object({
  id: z.string(),
  parentId: z.nullable(z.string()),
  authorId: z.string(),
  topics: z.array(z.string()),
  reposted: z._default(z.boolean(), false),
});
const liveChangeSchema = z.object({ ids: z.array(z.string()) });
export type LivePost = z.infer<typeof livePostSchema>;

type Listener = {
  onPost?: (post: LivePost) => void;
  onChange?: (ids: string[]) => void;
  onAccountChange?: () => void;
  onResync: () => void;
};

const STREAM_URL = "/api/live";
const MAX_BACKOFF_MS = 30_000;
const listeners = new Set<Listener>();
let source: EventSource | undefined;
let retryTimer: number | undefined;
let failures = 0;
let gap = false;

function close() {
  source?.close();
  source = undefined;
  window.clearTimeout(retryTimer);
  retryTimer = undefined;
}

function resync() {
  for (const listener of listeners) listener.onResync();
}

function connect() {
  const next = new EventSource(STREAM_URL);
  source = next;
  next.addEventListener("open", () => {
    failures = 0;
    if (!gap) return;
    gap = false;
    resync();
  });
  next.addEventListener("post", (event) => {
    try {
      const post = livePostSchema.parse(JSON.parse(event.data));
      for (const listener of listeners) listener.onPost?.(post);
    } catch {
      resync();
    }
  });
  next.addEventListener("change", (event) => {
    try {
      const { ids } = liveChangeSchema.parse(JSON.parse(event.data));
      for (const listener of listeners) listener.onChange?.(ids);
    } catch {
      resync();
    }
  });
  next.addEventListener("resync", resync);
  next.addEventListener("account", () => {
    for (const listener of listeners) listener.onAccountChange?.();
  });
  next.addEventListener("error", () => {
    gap = true;
    if (next.readyState !== EventSource.CLOSED) return;
    close();
    const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures++);
    retryTimer = window.setTimeout(
      () => {
        retryTimer = undefined;
        sync();
      },
      wait + Math.random() * 1000,
    );
  });
}

function sync() {
  const wanted =
    listeners.size > 0 &&
    !document.hidden &&
    navigator.onLine &&
    typeof EventSource !== "undefined";
  const running = source !== undefined || retryTimer !== undefined;
  if (!wanted) {
    if (running) {
      close();
      gap = true;
    }
    return;
  }
  if (!running) connect();
}

export function subscribeToLive(listener: Listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
  }
  sync();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("online", sync);
    window.removeEventListener("offline", sync);
    close();
    gap = false;
    failures = 0;
  };
}
