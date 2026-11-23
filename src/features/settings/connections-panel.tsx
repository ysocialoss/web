import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { ExternalLink } from "@/components/ui/external-link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, errorMessage } from "@/lib/api";
import { GithubSettings } from "./github-settings";
import { DomainsPanel } from "./domains-panel";
import { SettingsGroup } from "./settings-group";
import {
  connectionProviders,
  type ConnectionProviderId,
} from "./connection-providers";
import type { ComponentProps } from "react";

type Listing = Awaited<ReturnType<typeof api.linkedAccounts>>["providers"];

const resultText: Record<string, { text: string; error: boolean }> = {
  cancelled: { text: "Connection cancelled.", error: false },
  account_taken: {
    text: "That account is already linked to another ysocial account.",
    error: true,
  },
  invalid_state: {
    text: "The connection request expired. Try connecting again.",
    error: true,
  },
  no_channel: {
    text: "That Google account has no YouTube channel.",
    error: true,
  },
  not_configured: {
    text: "This connection is not available right now.",
    error: true,
  },
  unavailable: {
    text: "The service didn't answer. Try again in a moment.",
    error: true,
  },
  already_connected: {
    text: "This account is already connected.",
    error: false,
  },
};

export function ConnectionsPanel({
  returnTo,
  onGithubChange,
  onChange,
}: {
  returnTo: "profile" | "settings";
  onGithubChange?: ComponentProps<typeof GithubSettings>["onGithubChange"];
  onChange?: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<ConnectionProviderId | null>(null);
  const [confirm, setConfirm] = useState<ConnectionProviderId | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [acknowledged, setAcknowledged] = useState("");
  const [callbackDismissed, setCallbackDismissed] = useState(false);
  const [links, setLinks] = useState<
    Partial<Record<ConnectionProviderId, string>>
  >({});
  const callbackProvider = params.get("connection");
  const callback =
    callbackProvider && params.get("result") !== "connected"
      ? (resultText[params.get("result") ?? ""] ?? {
          text: "Could not connect. Try again.",
          error: true,
        })
      : null;

  useEffect(() => {
    const controller = new AbortController();
    api.linkedAccounts(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setListing(result.providers);
        setError("");
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      },
    );
    return () => controller.abort();
  }, [attempt]);

  function fail(reason: unknown) {
    setAcknowledged("");
    setError(errorMessage(reason));
  }

  function clearCallback() {
    if (!params.has("connection")) return;
    const next = new URLSearchParams(params);
    next.delete("connection");
    next.delete("result");
    setParams(next, { replace: true });
  }

  async function connect(provider: ConnectionProviderId) {
    clearCallback();
    setError("");
    setBusy(provider);
    try {
      const { url } = await api.connectProvider(provider, returnTo);
      window.location.assign(url);
    } catch (reason) {
      fail(reason);
      setBusy(null);
    }
  }

  async function link(provider: ConnectionProviderId) {
    clearCallback();
    setError("");
    setBusy(provider);
    try {
      const { connection } = await api.linkProvider(
        provider,
        links[provider] ?? "",
      );
      setListing(
        (current) =>
          current?.map((entry) =>
            entry.provider === provider ? { ...entry, connection } : entry,
          ) ?? current,
      );
      setLinks((current) => ({ ...current, [provider]: "" }));
      onChange?.();
    } catch (reason) {
      fail(reason);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: ConnectionProviderId) {
    setError("");
    try {
      await api.disconnectProvider(provider);
      setListing(
        (current) =>
          current?.map((entry) =>
            entry.provider === provider
              ? { ...entry, connection: null }
              : entry,
          ) ?? current,
      );
      onChange?.();
      return true;
    } catch (reason) {
      fail(reason);
      return false;
    }
  }

  const confirming = connectionProviders.find(
    (provider) => provider.id === confirm,
  );

  return (
    <div className="space-y-8">
      <SettingsGroup
        title="Linked accounts"
        description="Show your other accounts on your public profile."
      >
      <GithubSettings returnTo="profile" onGithubChange={onGithubChange} />
      {connectionProviders.map(
        ({ id, name, description, Mark, color, kind, placeholder }) => {
          const entry = listing?.find((item) => item.provider === id);
          const connection = entry?.connection ?? null;
          const unavailable = !!entry && !entry.configured && !connection;
          const button = !entry ? (
            <Skeleton className="col-span-2 h-8 w-full @sm:col-span-1 @sm:col-start-3 @sm:row-start-1 @sm:w-28" />
          ) : connection ? (
            <Button
              variant="ghost"
              size="sm"
              className="col-start-2 -mt-1 justify-self-start @xs:col-start-3 @xs:row-start-1 @xs:mt-0 @xs:self-center"
              disabled={busy !== null}
              onClick={() => setConfirm(id)}
            >
              Disconnect
            </Button>
          ) : kind === "link" ? (
            <form
              className="col-span-2 flex gap-2 @sm:col-span-1 @sm:col-start-3 @sm:row-start-1 @sm:w-72"
              onSubmit={(event) => {
                event.preventDefault();
                if ((links[id] ?? "").trim()) void link(id);
              }}
            >
              <Input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                aria-label={`${name} profile link`}
                placeholder={placeholder}
                maxLength={300}
                value={links[id] ?? ""}
                disabled={!entry || busy !== null}
                onChange={(event) =>
                  setLinks((current) => ({
                    ...current,
                    [id]: event.target.value,
                  }))
                }
              />
              <Button
                type="submit"
                variant="outline"
                disabled={!entry || busy !== null || !(links[id] ?? "").trim()}
              >
                {busy === id ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Add
              </Button>
            </form>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="col-span-2 w-full @sm:col-span-1 @sm:col-start-3 @sm:row-start-1 @sm:w-fit"
              disabled={!entry || unavailable || busy !== null}
              onClick={() => void connect(id)}
            >
              {busy === id ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUpRight aria-hidden="true" />
              )}
              {busy === id ? `Opening ${name}…` : `Connect ${name}`}
            </Button>
          );
          return (
            <section key={id} aria-label={name} className="@container">
              <div className="text-card-foreground">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-3.5">
                  <div className="grid size-10 place-items-center rounded-md bg-muted">
                    <Mark className={`size-5 ${color}`} />
                  </div>
                  <div className="min-w-0 self-center">
                    <h2 className="text-sm font-semibold">{name}</h2>
                    {connection ? (
                      <ExternalLink
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        href={connection.profileUrl}
                      >
                        <span className="min-w-0 truncate">
                          {connection.username}
                        </span>
                        <ArrowUpRight
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      </ExternalLink>
                    ) : !listing && !error ? (
                      <Skeleton className="mt-1.5 h-3.5 w-40" />
                    ) : (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                  {unavailable ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            tabIndex={0}
                            className="col-span-2 cursor-not-allowed rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring @sm:col-span-1 @sm:col-start-3 @sm:row-start-1"
                          />
                        }
                      >
                        <span className="pointer-events-none block">
                          {button}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        This connection isn't set up yet
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    button
                  )}
                </div>
                {connection && (
                  <p className="px-4 pb-3 text-sm text-muted-foreground">
                    Shown on your public profile.
                  </p>
                )}
              </div>
            </section>
          );
        },
      )}
      </SettingsGroup>
      <SettingsGroup
        title="Domains"
        description="Prove you own a domain with a DNS record and its icon appears on your public profile."
      >
        <DomainsPanel returnTo={returnTo} onChange={onChange} />
      </SettingsGroup>
      {error && !listing && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAttempt((current) => current + 1)}
          >
            Try again
          </Button>
        </div>
      )}
      <ErrorDialog
        message={
          error && error !== acknowledged
            ? error
            : callback?.error && !callbackDismissed
              ? callback.text
              : ""
        }
        onClose={() => {
          setAcknowledged(error);
          setCallbackDismissed(true);
        }}
      />
      <ConfirmationDialog
        open={confirming !== undefined}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={`Disconnect ${confirming?.name ?? ""}?`}
        description="The link is removed from your public profile. You can connect it again any time."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => (confirm ? disconnect(confirm) : false)}
      />
    </div>
  );
}
