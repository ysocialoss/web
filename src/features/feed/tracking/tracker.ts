export type FeedSurface =
  | "for_you"
  | "following"
  | "latest"
  | "thread"
  | "profile"
  | "topic"
  | "search"
  | "saved"
  | "other";

export type FeedEventType =
  | "impression"
  | "dwell"
  | "open"
  | "detail_dwell"
  | "expand"
  | "spoiler"
  | "media_open"
  | "link_open"
  | "profile_open"
  | "voice_play"
  | "share"
  | "topic_open";

export type TrackingContext = {
  surface: FeedSurface;
  position?: number;
  requestId?: string;
};

type QueuedEvent = {
  type: FeedEventType;
  postId?: string;
  surface: FeedSurface;
  position?: number;
  requestId?: string;
  seq: number;
  value?: number;
  detail?: string;
  at: string;
};

type Watched = {
  element: Element;
  postId: string;
  currentContext: () => TrackingContext;
  context: TrackingContext;
  intersecting: boolean;
  visibleSince: number | null;
  impressed: boolean;
  timer: number | undefined;
};

const IMPRESSION_MS = 500;
const DWELL_CAP_MS = 60_000;
const CONTEXT_TTL_MS = 30 * 60_000;
const FLUSH_SIZE = 25;
const FLUSH_INTERVAL_MS = 15_000;
const BATCH_LIMIT = 50;
const QUEUE_LIMIT = 500;

const sessionId = crypto.randomUUID();
let enabled = false;
let seq = 0;
let queue: QueuedEvent[] = [];
let flushTimer: number | undefined;
const lastContext = new Map<string, { context: TrackingContext; at: number }>();
const watched = new Map<Element, Watched>();
let observer: IntersectionObserver | null = null;
let listening = false;

export function setFeedTracking(on: boolean) {
  enabled = on;
  if (on) {
    listen();
    for (const entry of watched.values()) resume(entry);
    return;
  }
  for (const entry of watched.values()) {
    window.clearTimeout(entry.timer);
    entry.visibleSince = null;
  }
  queue = [];
  lastContext.clear();
  window.clearTimeout(flushTimer);
  flushTimer = undefined;
}

export function feedTrackingEnabled() {
  return enabled;
}

export function surfaceForPath(pathname: string): FeedSurface {
  if (pathname === "/") return "latest";
  if (pathname === "/following") return "following";
  if (pathname.startsWith("/posts/")) return "thread";
  if (pathname.startsWith("/@")) return "profile";
  if (pathname.startsWith("/topics/")) return "topic";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/saved")) return "saved";
  return "other";
}

function contextFor(postId: string | undefined) {
  if (postId) {
    const entry = lastContext.get(postId);
    if (entry && Date.now() - entry.at <= CONTEXT_TTL_MS) return entry.context;
  }
  return { surface: surfaceForPath(window.location.pathname) };
}

export function feedContextHeader(postId: string): Record<string, string> | undefined {
  if (!enabled) return undefined;
  const entry = lastContext.get(postId);
  if (!entry || Date.now() - entry.at > CONTEXT_TTL_MS) return undefined;
  const { surface, position, requestId } = entry.context;
  return { "X-Feed-Context": `${surface} ${position ?? "-"} ${requestId ?? "-"}` };
}

export function trackFeedEvent(
  type: FeedEventType,
  postId: string | undefined,
  extra: { value?: number; detail?: string; context?: TrackingContext } = {},
) {
  if (!enabled) return;
  const context = extra.context ?? contextFor(postId);
  push({
    type,
    postId,
    surface: context.surface,
    position: context.position,
    requestId: context.requestId,
    seq: seq++,
    value: extra.value === undefined ? undefined : Math.max(0, Math.min(3_600_000, Math.round(extra.value))),
    detail: extra.detail,
    at: new Date().toISOString(),
  });
}

export function linkDomain(href: string) {
  try {
    const host = new URL(href, window.location.href).hostname.toLowerCase().replace(/\.$/, "");
    return /^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host) ? host : undefined;
  } catch {
    return undefined;
  }
}

function push(event: QueuedEvent) {
  queue.push(event);
  if (queue.length > QUEUE_LIMIT) queue = queue.slice(-QUEUE_LIMIT);
  if (queue.length >= FLUSH_SIZE) {
    flush();
    return;
  }
  flushTimer ??= window.setTimeout(flush, FLUSH_INTERVAL_MS);
}

function flush() {
  window.clearTimeout(flushTimer);
  flushTimer = undefined;
  if (!enabled || !queue.length) return;
  const pending = queue;
  queue = [];
  for (let start = 0; start < pending.length; start += BATCH_LIMIT)
    void send(pending.slice(start, start + BATCH_LIMIT), true);
}

async function send(events: QueuedEvent[], retry: boolean) {
  try {
    const response = await fetch("/api/feed/events", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, events }),
    });
    if (response.status === 401 || response.status === 403) setFeedTracking(false);
  } catch {
    if (retry && enabled) window.setTimeout(() => void send(events, false), 5_000);
  }
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      for (const entry of watched.values()) pause(entry);
      flush();
    } else {
      for (const entry of watched.values()) resume(entry);
    }
  });
  window.addEventListener("pagehide", () => {
    for (const entry of watched.values()) pause(entry);
    flush();
  });
}

function visible(entry: IntersectionObserverEntry) {
  if (!entry.isIntersecting) return false;
  const viewport = entry.rootBounds?.height ?? window.innerHeight;
  return entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= viewport * 0.5;
}

function resume(entry: Watched) {
  if (!enabled || !entry.intersecting || entry.visibleSince !== null) return;
  if (document.visibilityState !== "visible") return;
  entry.visibleSince = performance.now();
  if (entry.impressed) return;
  entry.timer = window.setTimeout(() => {
    if (entry.visibleSince === null || entry.impressed) return;
    entry.impressed = true;
    entry.context = entry.currentContext();
    lastContext.set(entry.postId, { context: entry.context, at: Date.now() });
    const height = entry.element.getBoundingClientRect().height;
    trackFeedEvent("impression", entry.postId, {
      context: entry.context,
      value: Math.min(1000, (height / Math.max(1, window.innerHeight)) * 100),
    });
  }, IMPRESSION_MS);
}

function pause(entry: Watched) {
  window.clearTimeout(entry.timer);
  if (entry.visibleSince === null) return;
  const duration = performance.now() - entry.visibleSince;
  entry.visibleSince = null;
  if (entry.impressed && duration >= IMPRESSION_MS)
    trackFeedEvent("dwell", entry.postId, { context: entry.context, value: Math.min(DWELL_CAP_MS, duration) });
}

function ensureObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const change of entries) {
        const entry = watched.get(change.target);
        if (!entry) continue;
        entry.intersecting = visible(change);
        if (entry.intersecting) resume(entry);
        else pause(entry);
      }
    },
    { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] },
  );
  return observer;
}

export function observePost(element: Element, postId: string, context: () => TrackingContext) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const entry: Watched = {
    element,
    postId,
    currentContext: context,
    context: context(),
    intersecting: false,
    visibleSince: null,
    impressed: false,
    timer: undefined,
  };
  watched.set(element, entry);
  const target = ensureObserver();
  target.observe(element);
  return () => {
    pause(entry);
    watched.delete(element);
    target.unobserve(element);
  };
}

export function startDetailDwell(postId: string) {
  const context = contextFor(postId);
  let total = 0;
  let done = false;
  let since: number | null = document.visibilityState === "visible" ? performance.now() : null;
  const onVisibility = () => {
    if (document.visibilityState === "visible") since ??= performance.now();
    else if (since !== null) {
      total += performance.now() - since;
      since = null;
    }
  };
  const finish = () => {
    if (done) return;
    done = true;
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    if (since !== null) total += performance.now() - since;
    if (total >= IMPRESSION_MS)
      trackFeedEvent("detail_dwell", postId, { context, value: Math.min(30 * 60_000, total) });
  };
  const onPageHide = () => {
    finish();
    flush();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  return finish;
}
