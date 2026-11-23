import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errorMessage, type MuteDuration } from "@/lib/api";

export const muteOptions: { value: Exclude<MuteDuration, "off">; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "8h", label: "8 hours" },
  { value: "24h", label: "24 hours" },
  { value: "1w", label: "1 week" },
  { value: "forever", label: "Forever" },
];
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";

import { enablePush, registerPushWorker, supportsPush as supported } from "./enable-push";
type PushState =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "blocked"
  | "enabled"
  | "muted"
  | "disabled";

export function PushSettings() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [muteOpen, setMuteOpen] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [now, updateClock] = useState(Date.now);
  useEffect(() => {
    if (state !== "muted" || !mutedUntil) return;
    const timer = setTimeout(
      () => setState("enabled"),
      Math.max(0, new Date(mutedUntil).getTime() - Date.now()),
    );
    const clock = setInterval(() => updateClock(Date.now()), 60_000);
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [state, mutedUntil]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (!supported()) {
        setState("unsupported");
        return;
      }
      try {
        const registration = await registerPushWorker();
        const subscription = await registration.pushManager.getSubscription();
        const config = await api.pushConfig(
          subscription?.endpoint,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setMutedUntil(config.mutedUntil);
        updateClock(Date.now());
        setState(
          !config.publicKey
            ? "unconfigured"
            : Notification.permission === "denied"
              ? "blocked"
              : config.subscribed && !!subscription
                ? config.mutedForever ||
                  (config.mutedUntil &&
                    new Date(config.mutedUntil).getTime() > Date.now())
                  ? "muted"
                  : "enabled"
                : "disabled",
        );
      } catch (reason) {
        if (!controller.signal.aborted) {
          setState("disabled");
          setError(errorMessage(reason));
        }
      }
    }
    void load();
    const reload = () => {
      void load();
    };
    window.addEventListener("push-settings-updated", reload);
    return () => {
      controller.abort();
      window.removeEventListener("push-settings-updated", reload);
    };
  }, []);
  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const result = await enablePush();
      setState(
        result === "granted"
          ? "enabled"
          : result === "denied"
            ? "blocked"
            : result === "unconfigured"
              ? "unconfigured"
              : "disabled",
      );
    } catch (reason) {
      setError(
        reason instanceof DOMException ? reason.message : errorMessage(reason),
      );
    } finally {
      setBusy(false);
    }
  }
  async function mute(duration: MuteDuration) {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState("disabled");
        setMuteOpen(false);
        return;
      }
      const result = await api.mutePush(subscription.endpoint, duration);
      setMutedUntil(result.mutedUntil);
      updateClock(Date.now());
      setState(duration === "off" ? "enabled" : "muted");
      window.dispatchEvent(new Event("push-settings-updated"));
      setMuteOpen(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  const status = {
    loading: "Loading…",
    unsupported: "Unavailable",
    unconfigured: "Unavailable",
    blocked: "Blocked",
    enabled: "Mute",
    muted: "Unmute",
    disabled: "Allow",
  }[state];
  const minutes = mutedUntil
    ? Math.max(1, Math.ceil((new Date(mutedUntil).getTime() - now) / 60_000))
    : 0;
  const durationLabel =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`
      : `${minutes}m`;
  return (
    <div>
      <div className="flex items-center gap-3">
        <BellRing
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <p className="min-w-0 flex-1 text-sm font-medium">
          {state === "blocked"
            ? "Enable notifications in your browser settings."
            : state === "enabled"
              ? "Notifications are on"
              : state === "muted"
                ? mutedUntil
                  ? `Notifications muted for ${durationLabel}`
                  : "Notifications muted forever"
                : state === "unsupported" || state === "unconfigured"
                  ? "Not available in this browser"
                  : "Allow notifications"}
        </p>
        {!["blocked", "unsupported", "unconfigured"].includes(state) && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !["enabled", "disabled", "muted"].includes(state)}
            onClick={() => {
              if (state === "enabled") setMuteOpen(true);
              else if (state === "muted") void mute("off");
              else void toggle();
            }}
          >
            {busy ? "Saving…" : status}
          </Button>
        )}
      </div>
      <Dialog open={muteOpen} onOpenChange={setMuteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mute notifications</DialogTitle>
            <DialogDescription>For how long?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="min-w-0 flex-col md:flex-wrap md:justify-start">
            {muteOptions.map(({ value, label }) => (
              <Button
                key={value}
                variant="outline"
                disabled={busy}
                onClick={() => void mute(value)}
              >
                {label}
              </Button>
            ))}
          </DialogFooter>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
