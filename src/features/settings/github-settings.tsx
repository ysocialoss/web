import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router";
import {
  ArrowUpRight,
  CircleAlert,
  GitPullRequest,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { GithubMark } from "@/components/ui/github-mark";
import { ExternalLink } from "@/components/ui/external-link";
import { api, ApiError, errorMessage } from "@/lib/api";

type GithubSettings = Awaited<ReturnType<typeof api.githubSettings>>;
type GithubAction = "connect" | "disconnect";

function callbackMessage(result: string | null) {
  switch (result) {
    case null:
      return null;
    case "connected":
      return { text: "GitHub account connected.", error: false };
    case "cancelled":
      return { text: "GitHub connection cancelled.", error: false };
    case "github_account_taken":
      return {
        text: "That GitHub account is already linked to another ysocial account.",
        error: true,
      };
    case "github_invalid_state":
      return {
        text: "The connection request expired. Try connecting again.",
        error: true,
      };
    default:
      return { text: "Could not connect to GitHub. Try again.", error: true };
  }
}

export function GithubSettings({
  returnTo,
  onGithubChange,
}: {
  returnTo?: "profile";
  onGithubChange?: (github: GithubSettings["github"]) => void;
}) {
  const headingId = useId();
  const [params, setParams] = useSearchParams();
  const [settings, setSettings] = useState<GithubSettings | null>(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState<GithubAction | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const callback = callbackMessage(params.get("github"));
  const github = settings?.github;

  useEffect(() => {
    const controller = new AbortController();
    api
      .githubSettings(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setSettings(result);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [loadAttempt]);

  async function change(action: GithubAction) {
    setError("");
    setAction(action);
    if (params.has("github")) {
      const next = new URLSearchParams(params);
      next.delete("github");
      setParams(next, { replace: true });
    }
    try {
      if (action === "connect") {
        const { url } = await api.connectGithub(returnTo);
        window.location.assign(url);
        return true;
      }
      await api.disconnectGithub();
      setSettings((current) => current && { ...current, github: null });
      onGithubChange?.(null);
      return true;
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.message === "github_already_connected"
      ) {
        setSettings(null);
        setLoadAttempt((current) => current + 1);
      } else setError(errorMessage(cause));
      return false;
    } finally {
      setAction(null);
    }
  }

  return (
    <section aria-labelledby={headingId} className="@container">
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-4 p-4">
          <div className="grid size-10 place-items-center self-start rounded-lg bg-muted text-foreground">
            <GithubMark className="size-5" />
          </div>
          <div className="min-w-0 self-center">
            <h2 id={headingId} className="text-sm font-semibold">
              GitHub
            </h2>
            {github ? (
              <ExternalLink
                className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                href={`https://github.com/${github.login}`}
              >
                <span className="min-w-0 truncate">@{github.login}</span>
                <ArrowUpRight
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              </ExternalLink>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add a GitHub link to your public profile and show your
                contributions to ysocialoss.
              </p>
            )}
          </div>
          {github ? (
            <Button
              variant="ghost"
              size="sm"
              className="col-start-2 -mt-1 justify-self-start @xs:col-start-3 @xs:row-start-1 @xs:mt-0 @xs:self-center"
              disabled={action !== null}
              onClick={() => {
                setError("");
                setConfirmDisconnect(true);
              }}
            >
              Disconnect
            </Button>
          ) : settings?.configured ? (
            <Button
              className="col-span-2 w-full @sm:col-span-1 @sm:col-start-2 @sm:w-fit"
              disabled={action !== null}
              onClick={() => void change("connect")}
            >
              {action === "connect" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUpRight aria-hidden="true" />
              )}
              {action === "connect" ? "Opening GitHub…" : "Connect GitHub"}
            </Button>
          ) : null}
        </div>
        {github && (
          <div className="flex items-center gap-2 border-t bg-muted/35 px-4 py-2.5">
            <GitPullRequest
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="text-sm">ysocialoss contributions</span>
            <span
              role="status"
              className="ml-auto text-right text-sm font-medium tabular-nums"
            >
              {github.contributionCount?.toLocaleString() ?? "Checking…"}
            </span>
          </div>
        )}
        {!settings &&
          (error ? (
            <div className="border-t px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError("");
                  setLoadAttempt((current) => current + 1);
                }}
              >
                Try again
              </Button>
            </div>
          ) : (
            <p
              role="status"
              className="flex items-center gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground"
            >
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
              Loading GitHub connection…
            </p>
          ))}
        {settings && !settings.configured && !github && (
          <p className="border-t px-4 py-2.5 text-sm text-muted-foreground">
            GitHub connections are currently unavailable.
          </p>
        )}
      </div>
      {callback && (
        <p
          role={callback.error ? "alert" : "status"}
          className={`mt-3 flex items-start gap-2 text-sm ${callback.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {callback.error && (
            <CircleAlert
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          {callback.text}
        </p>
      )}
      {error && !confirmDisconnect && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <ConfirmationDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect GitHub?"
        description="Your GitHub link and Contributor badge will be removed from your public profile."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => change("disconnect")}
        error={error}
      />
    </section>
  );
}
