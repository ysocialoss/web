import { api } from "@/lib/api";

export function supportsPush() {
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function registerPushWorker() {
  return navigator.serviceWorker.register("/sw.js", { type: "module" });
}

export async function enablePush() {
  // Keep the permission request in the user gesture, before any network await.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  await registerPushWorker();
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  const config = await api.pushConfig();
  if (!config.publicKey) return "unconfigured";
  const key = Uint8Array.from(
    atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (character) => character.charCodeAt(0),
  );
  if (subscription?.options.applicationServerKey) {
    const existing = new Uint8Array(subscription.options.applicationServerKey);
    if (
      existing.length !== key.length ||
      !existing.every((value, index) => value === key[index])
    ) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  await api.subscribePush(subscription.toJSON());
  window.dispatchEvent(new Event("push-settings-updated"));
  return "granted";
}
