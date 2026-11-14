export type ConnectionStatus = "connected" | "service-issue" | "offline";

const retries = new Set<symbol>();
const listeners = new Set<() => void>();

export function getConnectionStatus(): ConnectionStatus {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return "offline";
  return retries.size > 0 ? "service-issue" : "connected";
}

export function subscribeConnectionStatus(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function beginConnectionRetry() {
  const id = Symbol();
  retries.add(id);
  for (const listener of listeners) listener();
  return () => {
    if (retries.delete(id)) for (const listener of listeners) listener();
  };
}
