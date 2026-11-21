import { chatNotificationPreview } from "./src/features/dms/notification-preview.ts";

// Push only. App pages and authenticated API responses are never cached here.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload;
    try { payload = event.data?.json(); } catch { return; }
    if (!payload || typeof payload.body !== "string") return;
    const preview = typeof payload.chatRecipient === "string" && typeof payload.id === "string"
      ? await chatNotificationPreview(payload.chatRecipient, payload.id, AbortSignal.timeout(3500))
      : undefined;
    await self.registration.showNotification(preview?.author || "ysocial", {
      body: preview?.text || payload.body,
      icon: typeof payload.icon === "string" ? payload.icon : "/favicon.png",
      badge: "/favicon.png",
      tag: typeof payload.id === "string" ? payload.id : "ysocial",
      data: { url: typeof payload.url === "string" ? payload.url : "/notifications" },
    });
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: "notifications-updated" });
  })());
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (target.origin !== self.location.origin) return;
    const id = event.notification.tag;
    const read = id && id !== "ysocial"
      ? fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: "PUT",
          credentials: "same-origin",
          mode: "same-origin",
        }).then((response) => response.ok, () => false)
      : false;

    try {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = clients.find((item) => new URL(item.url).origin === target.origin);
      if (client) {
        await client.navigate(target.href);
        await client.focus();
      } else await self.clients.openWindow(target.href);
    } finally {
      if (await read) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) client.postMessage({ type: "notifications-updated" });
      }
    }
  })());
});
