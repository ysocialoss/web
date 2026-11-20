import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
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
  userId, managingDevices, children,
}: {
  userId: string;
  managingDevices: boolean;
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

  return (
    <div className="mx-auto min-h-0 w-full max-w-lg space-y-4 overflow-y-auto px-4 py-6 sm:px-8">
      <KeyRound aria-hidden="true" className="size-6 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Messages</h1>
      {(error || refreshError) && <p role="alert" className="text-sm text-destructive">{error || refreshError}</p>}
      {refreshError && <Button variant="outline" onClick={() => refreshNow()}>Retry</Button>}
      {state.kind === "loading" && !refreshError && <p role="status" className="text-sm text-muted-foreground">Checking this browser…</p>}
      {state.kind === "revoked" && (
        <>
          <p className="text-sm text-muted-foreground">This browser was removed. Setting it up again requires approval and starts a new message history here.</p>
          <Button variant="outline" disabled={busy} onClick={() => void act(() => clearRevokedDevice(state.device))}>
            Set up again
          </Button>
        </>
      )}
      {(state.kind === "pending" || state.kind === "confirm") && (
        <>
          <p className="text-sm text-muted-foreground">
            {state.kind === "confirm" && state.localRoot
              ? "This browser holds the new chat identity. Confirm its security code to continue."
              : `On a verified browser, open Messages → Devices and compare the code for ${state.label}.`}
          </p>
          <p className="font-mono text-lg tracking-wide wrap-anywhere">{formatCode(state.requestCode)}</p>
          {state.kind === "pending" && <p role="status" className="text-sm text-muted-foreground">If the codes match, approve this browser on your verified device.</p>}
          {state.kind === "confirm" && (
            <Button type="button" disabled={busy || !!refreshError} onClick={() => {
              void act(() => confirmRoot(userId, state.root, state.expected));
            }}>
              Confirm code matches
            </Button>
          )}
        </>
      )}
      {state.kind === "recovery" && <p className="text-sm text-muted-foreground">This account has reached its device limit.</p>}
      {(state.kind === "pending" || state.kind === "recovery") && (
        resetting ? (
          <div className="space-y-3 rounded-lg border p-3 text-sm">
            <p>Reset only if you’ve lost access to every verified browser. This retires all previous chat devices and starts a new message history here. Your contacts will need to verify your new security code.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setResetting(false)}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void act(async () => {
                const previous = await rootStatus(userId, state.root);
                await dmApi.reset(state.device, state.root.id);
                await confirmRoot(userId, state.device, previous.known?.current);
                setResetting(false);
              })}>Reset chat identity</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="link" className="px-0" onClick={() => setResetting(true)}>Lost access to your verified browsers?</Button>
        )
      )}
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
  const [removing, setRemoving] = useState<string>();
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
    <div className="mx-auto w-full max-w-2xl space-y-6 overflow-y-auto px-4 py-5 sm:px-8">
      <Link to="/messages" className="text-sm font-medium hover:underline">← Messages</Link>
      <h1 className="text-xl font-semibold">Chat devices</h1>
      <p className="text-sm text-muted-foreground">A new device receives messages sent after verification. If you lose access to every verified device, you can’t add another one.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {approved && (
        <div role="status" className="space-y-1 rounded-lg border p-4">
          <p className="text-sm">Confirm the matching code on {approved.label} to finish verification.</p>
          <p className="font-mono text-lg">{formatCode(approved.code)}</p>
        </div>
      )}
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Verification requests</h2>
          {requests.map((request) => (
            <div key={request.device.id} className="space-y-2 rounded-lg border p-3">
              <p className="text-sm wrap-anywhere">{request.device.label}</p>
              <p className="font-mono text-lg tracking-wide">{formatCode(request.code)}</p>
              <p className="text-sm text-muted-foreground">Approve only if this code matches the one on the new browser.</p>
              <Button type="button" size="sm" disabled={busy} onClick={() => void act(() => approve(request))}>Approve device</Button>
            </div>
          ))}
        </section>
      )}
      <section>
        <h2 className="mb-1 text-sm font-semibold">Verified devices</h2>
        <ul className="divide-y divide-border">
          {verified.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="wrap-anywhere">{entry.label}{entry.id === device.id ? " (this browser)" : ""}</span>
              </span>
              {entry.id !== device.id && (removing === entry.id ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(undefined)}>Cancel</Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => void act(async () => {
                    await dmApi.deviceAction(entry.id, "revoke", device.id, await signRevocation(device, entry.id));
                    setRemoving(undefined);
                  })}>Confirm removal</Button>
                </div>
              ) : <Button size="sm" variant="ghost" onClick={() => setRemoving(entry.id)}>Remove</Button>)}
              {entry.id !== device.id && entry.approval && (
                <Button size="sm" variant="ghost" onClick={() => void act(async () => {
                  const code = await pairingCode(root, entry);
                  setApproved({ label: entry.label, code });
                })}>Show verification code</Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-1">
        <h2 className="text-sm font-semibold">Your security code</h2>
        <p className="text-sm text-muted-foreground">Share this with a contact outside this app so they can check your identity.</p>
        <code className="block font-mono text-sm wrap-anywhere">{formatCode(securityCode)}</code>
      </section>
    </div>
  );
}
