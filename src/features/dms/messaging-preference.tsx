import { useCallback, useEffect, useState } from "react";
import { MessageSquareOff, Power } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { dmApi, dmError } from "./dm-api";
import type { LocalDevice } from "./dm-crypto";

export function useMessagingPreference(device: LocalDevice) {
  const [enabled, setEnabled] = useState<boolean>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    dmApi.preferences(controller.signal).then(({ enabled }) => { if (!controller.signal.aborted) setEnabled(enabled); })
      .catch(() => {});
    return () => controller.abort();
  }, [device.id]);
  const change = useCallback(async (next: boolean) => {
    setError("");
    try {
      await dmApi.setMessaging(device, next);
      setEnabled(next);
      return true;
    } catch (reason) {
      setError(dmError(reason));
      return false;
    }
  }, [device]);
  return { enabled, change, error };
}

export function MessagingOff({ onEnable, error }: { onEnable: () => Promise<boolean>; error: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground"><MessageSquareOff aria-hidden="true" className="size-6" /></span>
      <div className="max-w-sm space-y-1">
        <h1 className="text-xl font-semibold">Messages are turned off</h1>
        <p className="text-sm text-muted-foreground">Nobody can message you and you can’t message anyone. Your conversations and devices are kept as they were.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button disabled={busy} onClick={() => { setBusy(true); void onEnable().finally(() => setBusy(false)); }}>Turn Messages back on</Button>
        <Button variant="ghost" render={<Link to="/messages/devices" />} nativeButton={false}>Chat devices</Button>
      </div>
    </div>
  );
}

export function MessagingToggle({ device }: { device: LocalDevice }) {
  const { enabled, change, error } = useMessagingPreference(device);
  const [confirming, setConfirming] = useState(false);
  if (enabled === undefined) return null;
  return (
    <section aria-labelledby="messaging-heading" className="space-y-2">
      <h2 id="messaging-heading" className="text-sm font-semibold">Messaging</h2>
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{enabled ? "Messages are on" : "Messages are off"}</p>
          <p className="text-sm text-muted-foreground">
            {enabled ? "Turn them off to stop receiving messages and requests from anyone." : "Turn them back on to send and receive messages again."}
          </p>
        </div>
        {enabled ? (
          <Button variant="outline" className="shrink-0 text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
            <Power aria-hidden="true" /> Turn off
          </Button>
        ) : (
          <Button className="shrink-0" onClick={() => void change(true)}>Turn on</Button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <ConfirmationDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Turn off Messages?"
        description="Nobody will be able to message you or send you requests, and you won’t be able to write to anyone, including people you already talk to. Pending requests stay where they are. Your conversations, devices and security codes are kept, and you can turn Messages back on here at any time."
        confirmLabel="Turn off Messages"
        destructive
        onConfirm={() => change(false)}
        error={error || undefined}
      />
    </section>
  );
}
