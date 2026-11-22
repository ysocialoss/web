import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PushSettings } from "@/features/notifications/push-settings";
import { supportsPush } from "@/features/notifications/enable-push";
import { useNotifications } from "@/features/notifications/notifications-context";
import { api, ApiError, errorMessage } from "@/lib/api";

type Status = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  endpoint: string | undefined;
  config: Awaited<ReturnType<typeof api.pushConfig>>;
};

export function NotificationSettings({ userId }: { userId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { unreadCount, markRead, refresh, hideContent } = useNotifications();
  const load = useCallback(async (signal?: AbortSignal) => {
    const supported = supportsPush();
    const registration = supported
      ? await navigator.serviceWorker.getRegistration("/")
      : undefined;
    const subscription = await registration?.pushManager.getSubscription();
    const config = await api.pushConfig(subscription?.endpoint, signal);
    if (!signal?.aborted)
      setStatus({
        supported,
        permission:
          "Notification" in window ? Notification.permission : "unsupported",
        endpoint: subscription?.endpoint,
        config,
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const reload = () => {
      void load(controller.signal).catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      });
    };
    reload();
    window.addEventListener("push-settings-updated", reload);
    window.addEventListener("focus", reload);
    return () => {
      controller.abort();
      window.removeEventListener("push-settings-updated", reload);
      window.removeEventListener("focus", reload);
    };
  }, [load]);
  async function act(operation?: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      const session = await api.session();
      if (
        !session.authenticated ||
        session.needsOnboarding ||
        session.user.id !== userId
      )
        throw new ApiError(403, "retry_account_changed");
      await operation?.();
      await load();
      window.dispatchEvent(new Event("push-settings-updated"));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 border-t pt-3"
      aria-label="Notification settings"
    >
      <h2 className="font-semibold">Notifications</h2>
      <PushSettings />
      <div className="flex items-center justify-between gap-4">
        <div>
          <span id="notification-content-label" className="font-medium">Hide message content in notifications</span>
          <p id="notification-content-description" className="text-muted-foreground">Hide previews in the app and in push alerts on all your devices.</p>
        </div>
        <Switch
          aria-labelledby="notification-content-label"
          aria-describedby="notification-content-description"
          checked={hideContent}
          disabled={busy || !status}
          onCheckedChange={(checked) => void act(async () => {
            await api.setNotificationContentHidden(checked);
            void refresh();
          })}
        />
      </div>
      {status ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>Browser support</dt>
          <dd>{status.supported ? "Supported" : "Unsupported"}</dd>
          <dt>Browser permission</dt>
          <dd>{status.permission}</dd>
          <dt>Server push</dt>
          <dd>{status.config.publicKey ? "Configured" : "Not configured"}</dd>
          <dt>This browser subscribed</dt>
          <dd>{status.config.subscribed ? "Yes" : "No"}</dd>
          <dt>Muted until</dt>
          <dd>
            {status.config.mutedForever
              ? "Forever"
              : status.config.mutedUntil
                ? new Date(status.config.mutedUntil).toLocaleString()
                : "Not muted"}
          </dd>
          <dt>Recommendation dismissed</dt>
          <dd>{status.config.promptDismissed ? "Yes, permanently" : "No"}</dd>
          <dt>Unread notifications</dt>
          <dd>{unreadCount}</dd>
        </dl>
      ) : (
        <p role="status">Loading notification settings…</p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["1h", "8h", "forever", "off"] as const).map((duration) => (
          <Button
            key={duration}
            variant="outline"
            disabled={busy || !status?.config.subscribed}
            onClick={() => {
              const endpoint = status?.endpoint;
              if (endpoint) void act(() => api.mutePush(endpoint, duration));
            }}
          >
            {duration === "off"
              ? "Unmute"
              : `Mute ${duration === "forever" ? "Forever" : duration}`}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={busy || !status || status.config.promptDismissed}
          onClick={() =>
            void act(async () => {
              await api.dismissNotificationPrompt();
              try {
                localStorage.setItem(
                  `notification-prompt-dismissed:${userId}`,
                  "true",
                );
              } catch {
                /* Saved on the account. */
              }
            })
          }
        >
          Dismiss recommendation permanently
        </Button>
        <Button
          variant="outline"
          disabled={busy || unreadCount === 0}
          onClick={() => void act(() => markRead())}
        >
          Mark all read
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void act()}>
          Refresh status
        </Button>
        <Link to="/notifications" className="self-center underline">
          Open notifications
        </Link>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
