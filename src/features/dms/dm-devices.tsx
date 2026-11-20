import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, KeyRound, Monitor, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { MessagingToggle } from "./messaging-preference";
import { ApiError } from "@/lib/api";
import { useDmUpdates } from "./dm-live";
import { dmApi, dmError, type OwnDevice } from "./dm-api";
import {
  DeviceTrustError, fingerprint, formatCode, matchDevice, pairingCode,
  signApproval, signRevocation, verifyDirectory, type DirectoryDevice, type LocalDevice,
} from "./dm-crypto";
import { clearRevokedDevice, confirmRoot, createLocalDevice, readLocalDevice, rememberRemovals, rootStatus, trustedRoot } from "./dm-storage";

const deviceChange = (event: { type: string }) => event.type === "devices" ? true : undefined;

type VerificationRequest = { device: OwnDevice; code: string };
type State =
  | { kind: "loading" }
  | { kind: "revoked"; device: LocalDevice }
  | { kind: "pending"; device: LocalDevice; root: DirectoryDevice; requestCode: string; label: string }
  | { kind: "recovery"; device: LocalDevice; root: DirectoryDevice }
  | { kind: "confirm"; device: LocalDevice; root: DirectoryDevice; requestCode: string; label: string; expected?: string; localRoot: boolean }
  | { kind: "ready"; device: LocalDevice; root: DirectoryDevice; devices: OwnDevice[]; requests: VerificationRequest[] };

async function deviceState(userId: string, signal: AbortSignal): Promise<State> {
  const [local, roster] = await Promise.all([readLocalDevice(userId), dmApi.devices(signal)]);
  signal.throwIfAborted();
  const device = local ?? await createLocalDevice(userId);
  let { devices } = roster;
  if (!devices.some(({ id }) => id === device.id)) {
    signal.throwIfAborted();
    try {
      await dmApi.register(device, signal);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.message === "dm_device_revoked") return { kind: "revoked", device };
        const root = devices.find((entry) => entry.root);
        if (error.message === "dm_device_limit" && root) return { kind: "recovery", device, root };
      }
      throw error;
    }
    ({ devices } = await dmApi.devices(signal));
  }
  const current = devices.find(({ id }) => id === device.id);
  if (!current) throw new DeviceTrustError("This browser’s registration could not be found.");
  if (!matchDevice(device, current)) throw new DeviceTrustError("This browser’s chat keys do not match its registration.");
  const root = devices.find((entry) => entry.root);
  if (!root) throw new DeviceTrustError("The account’s chat key is missing.");
  if (!current.root && !current.approval) {
    const directory = await verifyDirectory(userId, devices);
    if (!directory) throw new DeviceTrustError("The account’s chat key could not be verified.");
    return { kind: "pending", device, root, requestCode: await pairingCode(root, device), label: current.label };
  }
  const directory = await verifyDirectory(userId, devices);
  if (!directory?.verified.has(device.id))
    throw new DeviceTrustError("This browser’s approval could not be verified.");
  const isTrusted = await trustedRoot(userId, directory.root, current.root);
  if (isTrusted) await rememberRemovals(userId, directory);
  if (current.revokedAt) return { kind: "revoked", device };
  if (!isTrusted) {
    const { known, code } = await rootStatus(userId, root);
    return {
      kind: "confirm", device, root, expected: known?.current, localRoot: current.root,
      requestCode: current.root ? code : await pairingCode(root, device), label: current.label,
    };
  }
  const requests = await Promise.all(devices
    .filter((entry) => !entry.root && !entry.approval && !entry.revokedAt)
    .map(async (entry) => ({ device: entry, code: await pairingCode(root, entry) })));
  return { kind: "ready", device, root, devices, requests };
}

export function DmDeviceGate({
  userId, managingDevices, loading, children,
}: {
  userId: string;
  managingDevices: boolean;
  loading: ReactNode;
  children: (device: LocalDevice, pendingCount: number) => ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [resetting, setResetting] = useState(false);
  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      const next = await deviceState(userId, signal);
      if (!signal.aborted) {
        setState((previous) => previous.kind === "ready" && next.kind === "ready" && previous.device.id === next.device.id
          ? { ...next, device: previous.device }
          : next);
        setRefreshError("");
      }
    } catch (error) {
      if (!signal.aborted) {
        if (error instanceof DeviceTrustError) setState({ kind: "loading" });
        setRefreshError(dmError(error));
      }
    }
  }, [userId]);
  const refreshNow = useDmUpdates(userId, refresh, deviceChange);

  async function act(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
      refreshNow();
    } catch (error) {
      setError(dmError(error));
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "ready") {
    return managingDevices
      ? <DeviceSettings state={state} refresh={refreshNow} />
      : children(state.device, state.requests.length);
  }
  if (state.kind === "loading" && !refreshError) return loading;

  const waiting = state.kind === "pending" || state.kind === "confirm";
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))] sm:px-6">
        <div className="space-y-3 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            {state.kind === "revoked" || state.kind === "recovery" ? <ShieldAlert aria-hidden="true" className="size-6" /> : <KeyRound aria-hidden="true" className="size-6" />}
          </span>
          <h1 className="text-xl font-semibold">
            {state.kind === "loading" ? "Messages" : state.kind === "revoked" ? "This browser was removed"
              : state.kind === "recovery" ? "Device limit reached" : state.kind === "confirm" && state.localRoot ? "Confirm your chat identity" : "Verify this browser"}
          </h1>
        </div>
        {(error || refreshError) && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error || refreshError}</p>}
        {refreshError && <Button variant="outline" className="self-center" onClick={() => refreshNow()}>Retry</Button>}
        {state.kind === "revoked" && (
          <>
            <p className="text-center text-sm text-muted-foreground">Setting it up again requires approval from one of your other devices and starts a new message history here.</p>
            <Button className="self-center" disabled={busy} onClick={() => void act(() => clearRevokedDevice(state.device))}>Set up again</Button>
          </>
        )}
        {waiting && (
          <>
            <p className="text-center text-sm text-muted-foreground">
              {state.kind === "confirm" && state.localRoot
                ? "This browser holds the new chat identity. Confirm its security code to continue."
                : `On a verified browser, open Messages → Chat devices and compare the code for ${state.label}.`}
            </p>
            <CodeBlock code={formatCode(state.requestCode)} />
            {state.kind === "pending" && <p role="status" className="text-center text-sm text-muted-foreground">If the codes match, approve this browser on your verified device.</p>}
            {state.kind === "confirm" && (
              <Button type="button" className="self-center" disabled={busy || !!refreshError} onClick={() => {
                void act(() => confirmRoot(userId, state.root, state.expected));
              }}>
                Confirm code matches
              </Button>
            )}
          </>
        )}
        {state.kind === "recovery" && <p className="text-center text-sm text-muted-foreground">This account already has the maximum number of verified devices. Remove one from a device that is still verified.</p>}
        {(state.kind === "pending" || state.kind === "recovery") && (
          <div className="rounded-xl border border-border p-3 text-sm">
            <button type="button" onClick={() => setResetting(!resetting)} aria-expanded={resetting} className="w-full rounded-md text-left font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Lost access to your verified browsers?
            </button>
            {resetting && (
              <div className="mt-3 space-y-3">
                <p className="text-muted-foreground">Reset only if you’ve lost access to every verified browser. This retires all previous chat devices and starts a new message history here. Your contacts will need to verify your new security code.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setResetting(false)}>Cancel</Button>
                  <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void act(async () => {
                    const previous = await rootStatus(userId, state.root);
                    await dmApi.reset(state.device, state.root.id);
                    await confirmRoot(userId, state.device, previous.known?.current);
                    setResetting(false);
                  })}>Reset chat identity</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 py-2 pr-1.5 pl-3.5">
      <code className="min-w-0 flex-1 py-1 font-mono text-sm leading-relaxed tracking-wide wrap-anywhere">{code}</code>
      <IconButton
        label={copied ? "Copied" : "Copy code"}
        size="icon-sm"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => {});
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </IconButton>
    </div>
  );
}

function DeviceSettings({ state, refresh }: {
  state: Extract<State, { kind: "ready" }>;
  refresh: () => void;
}) {
  const [approved, setApproved] = useState<{ label: string; code: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [removing, setRemoving] = useState<OwnDevice>();
  const { device, root, devices, requests } = state;
  const { id, userId, signingKey, encryptionKey } = root;
  useEffect(() => {
    let active = true;
    void fingerprint({ id, userId, signingKey, encryptionKey }).then((code) => {
      if (active) setSecurityCode(code);
    });
    return () => { active = false; };
  }, [id, userId, signingKey, encryptionKey]);

  async function act(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
      refresh();
    } catch (error) {
      setError(dmError(error));
    } finally {
      setBusy(false);
    }
  }

  async function approve({ device: target, code }: VerificationRequest) {
    const signature = await signApproval(device, target);
    await dmApi.deviceAction(target.id, "approve", device.id, signature);
    setApproved({ label: target.label, code });
  }

  const verified = devices.filter((entry) => (entry.root || entry.approval) && !entry.revokedAt);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 md:pt-2">
        <IconLink label="Back to messages" to="/messages" className="size-10">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </IconLink>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">Chat devices</h1>
          <p className="truncate text-xs text-muted-foreground">Browsers that can read your messages</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          <p className="text-sm text-muted-foreground">A new device receives messages sent after verification. If you lose access to every verified device, you can’t add another one.</p>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
          {approved && (
            <div role="status" className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm">Confirm the matching code on <span className="font-medium">{approved.label}</span> to finish verification.</p>
              <CodeBlock code={formatCode(approved.code)} />
            </div>
          )}
          {requests.length > 0 && (
            <section aria-labelledby="requests-heading" className="space-y-2">
              <h2 id="requests-heading" className="text-sm font-semibold">Verification requests</h2>
              {requests.map((request) => (
                <div key={request.device.id} className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Monitor aria-hidden="true" className="size-4.5" /></span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{request.device.label}</p>
                  </div>
                  <CodeBlock code={formatCode(request.code)} />
                  <p className="text-xs text-muted-foreground">Approve only if this code matches the one on the new browser.</p>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void act(() => approve(request))}>Approve device</Button>
                </div>
              ))}
            </section>
          )}
          <section aria-labelledby="devices-heading" className="space-y-2">
            <h2 id="devices-heading" className="text-sm font-semibold">Verified devices</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {verified.map((entry) => {
                const current = entry.id === device.id;
                return (
                  <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Monitor aria-hidden="true" className="size-4.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate text-sm font-medium">{entry.label}</span>
                        {current && <Badge variant="secondary">This browser</Badge>}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck aria-hidden="true" className="size-3" /> Verified{entry.root ? " · identity" : ""}
                      </span>
                    </span>
                    {!current && (
                      <span className="flex shrink-0 items-center gap-0.5">
                        {entry.approval && (
                          <IconButton label="Show verification code" size="icon-sm" disabled={busy} onClick={() => void act(async () => {
                            setApproved({ label: entry.label, code: await pairingCode(root, entry) });
                          })}>
                            <KeyRound aria-hidden="true" />
                          </IconButton>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRemoving(entry)}>Remove</Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-labelledby="code-heading" className="space-y-2">
            <h2 id="code-heading" className="text-sm font-semibold">Your security code</h2>
            <p className="text-sm text-muted-foreground">Share this with a contact outside this app so they can check your identity.</p>
            <CodeBlock code={formatCode(securityCode)} />
          </section>
          <MessagingToggle device={device} />
        </div>
      </div>
      <ConfirmationDialog
        open={!!removing}
        onOpenChange={(open) => { if (!open) setRemoving(undefined); }}
        title={`Remove ${removing?.label ?? "this device"}?`}
        description="It will stop receiving new messages and has to be verified again to come back."
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          const target = removing;
          if (!target) return false;
          setError("");
          try {
            await dmApi.deviceAction(target.id, "revoke", device.id, await signRevocation(device, target.id));
            refresh();
            return true;
          } catch (reason) {
            setError(dmError(reason));
            return false;
          }
        }}
      />
    </div>
  );
}
