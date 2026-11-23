import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Copy,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DomainIcon } from "@/features/profile/domain-icon";
import { api, errorMessage, type OwnedDomain } from "@/lib/api";
import { writeClipboard } from "@/lib/clipboard";

const pollMs = 8000;

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1.5 text-xs break-all select-all">
          {value}
        </code>
        <IconButton
          label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          size="icon-sm"
          onClick={() =>
            void writeClipboard(value).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
        >
          {copied ? <Check className="text-primary" /> : <Copy />}
        </IconButton>
      </div>
    </div>
  );
}

function PendingDomainDialog({
  domain,
  onClose,
  onVerified,
  onError,
}: {
  domain: OwnedDomain;
  onClose: () => void;
  onVerified: (domain: OwnedDomain) => void;
  onError: (reason: unknown) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let stopped = false;
    const timer = window.setInterval(() => {
      void api.verifyDomain(domain.id).then(
        (result) => {
          if (!stopped && result.domain.verified) onVerified(result.domain);
        },
        () => {},
      );
    }, pollMs);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [domain.id, onVerified]);

  async function verify() {
    setVerifying(true);
    try {
      const result = await api.verifyDomain(domain.id);
      if (result.domain.verified) onVerified(result.domain);
    } catch (reason) {
      onError(reason);
    } finally {
      setVerifying(false);
    }
  }

  async function connectAutomatically() {
    setConnecting(true);
    try {
      const { url } = await api.domainConnect(domain.id);
      window.location.assign(url);
    } catch (reason) {
      onError(reason);
      setConnecting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-all">{domain.domain}</DialogTitle>
          <DialogDescription>
            Add this TXT record where your domain's DNS is managed. We check
            automatically, or press Verify.
          </DialogDescription>
        </DialogHeader>
        {domain.record && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
              <CopyField label="Type" value={domain.record.type} />
              <CopyField label="Name" value={domain.record.name} />
            </div>
            <CopyField label="Value" value={domain.record.value} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Domain Connect is an open standard that lets supported DNS providers
          add the record for you.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={verifying || connecting}
            onClick={() => void connectAutomatically()}
          >
            {connecting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUpRight aria-hidden="true" />
            )}
            Set up with Domain Connect
          </Button>
          <Button
            disabled={verifying || connecting}
            onClick={() => void verify()}
          >
            {verifying && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useDomainConnections({
  onChange,
  onAdded,
}: {
  onAdded?: () => void;
  onChange?: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [domains, setDomains] = useState<OwnedDomain[] | null>(null);
  const [max, setMax] = useState(10);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<OwnedDomain | null>(null);
  const [openId, setOpenId] = useState<string | null>(() =>
    params.get("domainconnect"),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!params.has("domainconnect")) return;
    const next = new URLSearchParams(params);
    next.delete("domainconnect");
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    const controller = new AbortController();
    api.domains(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setDomains(result.domains);
        setMax(result.max);
        setLoadFailed(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoadFailed(true);
        setError(errorMessage(reason));
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const open =
    domains?.find((entry) => entry.id === openId && !entry.verified) ?? null;

  function verified(domain: OwnedDomain) {
    setDomains(
      (current) =>
        current?.map((entry) => (entry.id === domain.id ? domain : entry)) ??
        current,
    );
    setOpenId(null);
    onChange?.();
  }

  async function add() {
    setAdding(true);
    try {
      const { domain } = await api.addDomain(draft);
      setDomains((current) => [...(current ?? []), domain]);
      setDraft("");
      setOpenId(domain.id);
      onAdded?.();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAdding(false);
    }
  }

  async function remove(domain: OwnedDomain) {
    try {
      await api.removeDomain(domain.id);
      setDomains(
        (current) =>
          current?.filter((entry) => entry.id !== domain.id) ?? current,
      );
      onChange?.();
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    }
  }

  async function setVisibility(id: string, displayOnProfile: boolean) {
    try {
      const { domain } = await api.setDomainVisibility(id, displayOnProfile);
      setDomains(
        (current) =>
          current?.map((entry) => (entry.id === id ? domain : entry)) ??
          current,
      );
      onChange?.();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  function retry() {
    setLoadFailed(false);
    setAttempt((current) => current + 1);
  }

  const form = (
    <form
      className="flex gap-2 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim() && !adding) void add();
      }}
    >
      <Input
        inputMode="url"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label="Domain to add"
        placeholder="example.com"
        maxLength={300}
        value={draft}
        disabled={!domains || adding || domains.length >= max}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        disabled={!domains || adding || !draft.trim() || domains.length >= max}
      >
        {adding && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Add domain
      </Button>
    </form>
  );
  const dialogs = (
    <>
      {open && (
        <PendingDomainDialog
          key={open.id}
          domain={open}
          onClose={() => setOpenId(null)}
          onVerified={verified}
          onError={(reason) => setError(errorMessage(reason))}
        />
      )}
      <ErrorDialog
        title="Domains"
        message={error}
        onClose={() => setError("")}
      />
      <ConfirmationDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
        title={`Remove ${removing?.domain ?? "domain"}?`}
        description="It disappears from your public profile. You can add it again any time."
        confirmLabel="Remove"
        destructive
        onConfirm={() => (removing ? remove(removing) : false)}
      />
    </>
  );
  return {
    domains,
    max,
    loadFailed,
    retry,
    form,
    dialogs,
    setOpenId,
    setRemoving,
    setVisibility,
  };
}

export function DomainsPanel({ onChange }: { onChange?: () => void }) {
  const { domains, loadFailed, retry, form, dialogs, setOpenId, setRemoving } =
    useDomainConnections({ onChange });
  return (
    <section aria-label="Domains" className="@container">
      <div className="text-card-foreground">
        {!domains && !loadFailed && <Skeleton className="mx-4 mt-4 h-10" />}
        {loadFailed && !domains && (
          <div className="px-4 pt-4">
            <Button size="sm" variant="ghost" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
        {domains && domains.length > 0 && (
          <ul className="divide-y border-b">
            {domains.map((domain) => {
              const body = (
                <>
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
                    <DomainIcon domain={domain.domain} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {domain.domain}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {domain.verified ? (
                        <>
                          <BadgeCheck
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                          {domain.displayOnProfile
                            ? "Verified · shown on your profile"
                            : "Verified · hidden from your profile"}
                        </>
                      ) : (
                        "Waiting for the DNS record"
                      )}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={domain.id} className="flex items-center gap-1 pr-3">
                  {domain.verified ? (
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
                      {body}
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${domain.domain}: finish verification`}
                      onClick={() => setOpenId(domain.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      {body}
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  )}
                  <IconButton
                    label={`Remove ${domain.domain}`}
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoving(domain)}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
        {form}
      </div>
      {dialogs}
    </section>
  );
}
