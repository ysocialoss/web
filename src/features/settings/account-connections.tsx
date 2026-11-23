import { useState, type ReactNode } from "react";
import { ChevronRight, Globe, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink } from "@/components/ui/external-link";
import { GithubMark } from "@/components/ui/github-mark";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { api } from "@/lib/api";
import {
  connectionProviders,
  type ConnectionProviderInfo,
  type ConnectionProviderId,
} from "./connection-providers";
import { useDomainConnections } from "./domains-panel";
import { useGithubConnection } from "./github-settings";

type Listing = Awaited<ReturnType<typeof api.linkedAccounts>>["providers"];

function ProviderTile({
  label,
  unavailable,
  onClick,
  children,
}: {
  label: string;
  unavailable?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-disabled={unavailable ? true : undefined}
            onClick={() => {
              if (!unavailable) onClick();
            }}
            className="grid size-11 cursor-pointer place-items-center rounded-xl border border-border/70 bg-card text-foreground shadow-xs outline-none transition-[background-color,border-color,scale] duration-150 focus-visible:ring-2 focus-visible:ring-ring not-aria-disabled:hover:border-foreground/20 not-aria-disabled:hover:bg-foreground/8 not-aria-disabled:active:border-foreground/30 not-aria-disabled:active:bg-foreground/15 motion-safe:not-aria-disabled:active:scale-[0.96] motion-reduce:transition-none aria-disabled:cursor-default aria-disabled:opacity-50"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {unavailable ? `${label} · ${unavailable}` : label}
      </TooltipContent>
    </Tooltip>
  );
}

function ConnectionCard({
  name,
  provider,
  mark,
  href,
  onRemove,
  visibility,
  children,
}: {
  name: string;
  provider: string;
  mark: ReactNode;
  href?: string;
  onRemove: () => void;
  visibility?: { checked: boolean; save: (checked: boolean) => Promise<void> };
  children?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);

  async function changeVisibility(checked: boolean) {
    if (!visibility || saving) return;
    setSaving(true);
    try {
      await visibility.save(checked);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      aria-label={name}
      className="rounded-xl border border-border/80 bg-card text-card-foreground"
    >
      <div className="flex items-center gap-3 p-4">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"
          aria-hidden="true"
        >
          {mark}
        </span>
        <div className="min-w-0 flex-1">
          {href ? (
            <ExternalLink
              href={href}
              className="block truncate rounded-sm text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {name}
            </ExternalLink>
          ) : (
            <p className="truncate text-sm font-semibold">{name}</p>
          )}
          <p className="text-xs text-muted-foreground">{provider}</p>
        </div>
        <IconButton
          label={`Disconnect ${name}`}
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={saving}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {children}
      {visibility && (
        <label className="flex min-h-11 items-center justify-between gap-3 border-t border-border/70 px-4 py-2 text-sm font-medium">
          Display on profile
          <Switch
            aria-label={`Display ${name} on profile`}
            checked={visibility.checked}
            disabled={saving}
            onCheckedChange={(checked) => void changeVisibility(checked)}
          />
        </label>
      )}
    </article>
  );
}

function ProfileLinkDialog({
  provider,
  busy,
  onClose,
  onLink,
}: {
  provider: ConnectionProviderInfo;
  busy: boolean;
  onClose: () => void;
  onLink: (provider: ConnectionProviderId, url: string) => Promise<boolean>;
}) {
  const [url, setUrl] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {provider.name}</DialogTitle>
          <DialogDescription>{provider.description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!busy && url.trim() && (await onLink(provider.id, url)))
              onClose();
          }}
        >
          <Input
            type="url"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            aria-label={`${provider.name} profile link`}
            placeholder={provider.placeholder}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <DialogFooter>
            <Button type="submit" disabled={busy || !url.trim()}>
              {busy && (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              )}
              Add connection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountConnections({
  listing,
  busy,
  loadingFailed,
  onConnect,
  onLink,
  onDisconnect,
  onVisibilityChange,
  onGithubChange,
  onChange,
}: {
  listing: Listing | null;
  busy: ConnectionProviderId | null;
  loadingFailed: boolean;
  onConnect: (provider: ConnectionProviderId) => Promise<void>;
  onLink: (provider: ConnectionProviderId, url: string) => Promise<boolean>;
  onDisconnect: (provider: ConnectionProviderId) => void;
  onVisibilityChange: (
    provider: ConnectionProviderId,
    checked: boolean,
  ) => Promise<void>;
  onGithubChange?: Parameters<typeof useGithubConnection>[0]["onGithubChange"];
  onChange?: () => void;
}) {
  const [linkProvider, setLinkProvider] =
    useState<ConnectionProviderInfo | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const github = useGithubConnection({ returnTo: "settings", onGithubChange });
  const domains = useDomainConnections({
    onChange,
    onAdded: () => setAddingDomain(false),
  });
  const cards = connectionProviders.flatMap(({ id, name, Mark, color }) => {
    const connection = listing?.find(
      (item) => item.provider === id,
    )?.connection;
    if (!connection) return [];
    return (
      <ConnectionCard
        key={id}
        name={connection.username}
        provider={name}
        href={connection.profileUrl}
        mark={<Mark className={`size-5 ${color}`} />}
        onRemove={() => onDisconnect(id)}
        visibility={{
          checked: connection.displayOnProfile,
          save: (checked) => onVisibilityChange(id, checked),
        }}
      />
    );
  });
  const githubAccount = github.github;
  if (githubAccount) {
    cards.push(
      <ConnectionCard
        key="github"
        name={`@${githubAccount.login}`}
        provider="GitHub"
        href={`https://github.com/${githubAccount.login}`}
        mark={<GithubMark className="size-5" />}
        onRemove={github.confirmDisconnect}
        visibility={{
          checked: githubAccount.displayOnProfile,
          save: github.setVisibility,
        }}
      >
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          ysocialoss contributions ·{" "}
          {githubAccount.contributionCount?.toLocaleString() ?? "Pending"}
        </p>
      </ConnectionCard>,
    );
  }
  const pendingDomains: ReactNode[] = [];
  for (const domain of domains.domains ?? []) {
    const card = (
      <ConnectionCard
        key={domain.id}
        name={domain.domain}
        provider={domain.verified ? "Domain" : "Domain · Pending verification"}
        mark={<Globe className="size-5" />}
        onRemove={() => domains.setRemoving(domain)}
        visibility={
          domain.verified
            ? {
                checked: domain.displayOnProfile,
                save: (checked) => domains.setVisibility(domain.id, checked),
              }
            : undefined
        }
      >
        {!domain.verified && (
          <Button
            size="sm"
            variant="ghost"
            className="mx-3 mb-3"
            onClick={() => domains.setOpenId(domain.id)}
          >
            Finish verification <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </ConnectionCard>
    );
    if (domain.verified) cards.push(card);
    else pendingDomains.push(card);
  }
  const loading =
    (!listing && !loadingFailed) ||
    (!github.settings && !github.error) ||
    (!domains.domains && !domains.loadFailed);

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Link accounts and domains to ysocial. Choose which connections appear
          on your public profile.
        </p>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Add a new connection</h3>
        <div className="flex flex-wrap gap-2">
          {connectionProviders.map(({ Mark, color, ...provider }) => {
            const entry = listing?.find(
              (item) => item.provider === provider.id,
            );
            return (
              <ProviderTile
                key={provider.id}
                label={`Connect ${provider.name}`}
                unavailable={
                  entry?.connection
                    ? "Already connected"
                    : entry?.configured && !busy
                      ? undefined
                      : busy === provider.id
                        ? "Opening connection"
                        : "Unavailable"
                }
                onClick={() => {
                  if (provider.kind === "link")
                    setLinkProvider({ ...provider, Mark, color });
                  else void onConnect(provider.id);
                }}
              >
                {busy === provider.id && !linkProvider ? (
                  <LoaderCircle
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Mark className={`size-6 ${color}`} />
                )}
              </ProviderTile>
            );
          })}
          <ProviderTile
            label="Connect GitHub"
            unavailable={
              githubAccount
                ? "Already connected"
                : github.settings?.configured && !github.action
                  ? undefined
                  : "Unavailable"
            }
            onClick={() => void github.connect()}
          >
            {github.action === "connect" ? (
              <LoaderCircle
                className="size-5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <GithubMark className="size-6" />
            )}
          </ProviderTile>
          <ProviderTile
            label="Add domain"
            unavailable={
              !domains.domains
                ? "Unavailable"
                : domains.domains.length >= domains.max
                  ? "Domain limit reached"
                  : undefined
            }
            onClick={() => setAddingDomain(true)}
          >
            <Globe className="size-6" aria-hidden="true" />
          </ProviderTile>
        </div>
        {github.callback && !github.callback.error && (
          <p role="status" className="text-sm text-muted-foreground">
            {github.callback.text}
          </p>
        )}
        {!github.settings && github.error && (
          <Button variant="outline" size="sm" onClick={github.retry}>
            Retry GitHub
          </Button>
        )}
        {domains.loadFailed && (
          <Button variant="outline" size="sm" onClick={domains.retry}>
            Retry domains
          </Button>
        )}
      </div>
      <div className="space-y-3 border-t pt-5">
        <h3 className="text-sm font-semibold" aria-live="polite">
          {loading
            ? "Your connections"
            : `${cards.length} ${cards.length === 1 ? "connection" : "connections"}`}
        </h3>
        {cards}
        {loading && <Skeleton className="h-24 rounded-xl" />}
        {!loading && !cards.length && !pendingDomains.length && (
          <p className="text-sm text-muted-foreground">
            Choose a provider above to add your first connection.
          </p>
        )}
        {pendingDomains}
      </div>
      {linkProvider && (
        <ProfileLinkDialog
          key={linkProvider.id}
          provider={linkProvider}
          busy={busy === linkProvider.id}
          onClose={() => setLinkProvider(null)}
          onLink={onLink}
        />
      )}
      {addingDomain && (
        <Dialog open onOpenChange={(open) => !open && setAddingDomain(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add domain</DialogTitle>
              <DialogDescription>
                Verify a domain you own by adding a DNS record.
              </DialogDescription>
            </DialogHeader>
            {domains.form}
          </DialogContent>
        </Dialog>
      )}
      {github.dialogs}
      {domains.dialogs}
    </div>
  );
}
