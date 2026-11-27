import { useState } from "react";
import { Link, useLocation } from "react-router";
import { BadgeCheck, Clock, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Onboarding } from "./onboarding";
import { AccountGates, ModerationNoticeBanner } from "@/features/legal/account-gates";
import type { AuthState } from "./use-auth";

export function ApprovalBanner() {
  return (
    <Alert className="flex shrink-0 items-center justify-center gap-2 rounded-none border-x-0 border-t-0 py-1.5">
      <AlertTitle className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <Clock className="size-4" aria-hidden="true" />
        Awaiting approval
      </AlertTitle>
      <AlertDescription className="hidden whitespace-nowrap sm:block">
        You can browse while your account is reviewed.
      </AlertDescription>
    </Alert>
  );
}

export function Account({ auth }: { auth: AuthState }) {
  const { session } = auth;
  const location = useLocation();
  const signInError = location.pathname === "/login"
    ? new URLSearchParams(location.search).get("error")
    : null;
  const onLegalPage = ["/legal/", "/contact", "/report"].some((prefix) => location.pathname.startsWith(prefix));
  if (session?.authenticated && session.needsOnboarding && !onLegalPage) {
    return <Onboarding auth={auth} suggestedHandle={session.suggestedHandle} suggestedDisplayName={session.suggestedDisplayName} />;
  }
  const ban = session?.authenticated && !session.needsOnboarding ? session.ban : null;
  const userId = session?.authenticated && !session.needsOnboarding ? session.user.id : null;
  const gates = onLegalPage ? null : <AccountGates auth={auth} />;
  return (
    <section
      className="mx-auto max-w-xl space-y-3 empty:hidden [&:has(>*)]:mb-6"
      aria-label="Account access"
    >
      {gates}
      {userId && <ModerationNoticeBanner userId={userId} />}
      {ban && <BanNotice key={ban.at} ban={ban} />}
      {auth.showApprovalWelcome && (
        <Dialog open onOpenChange={(open) => { if (!open) auth.dismissApprovalWelcome(); }}>
          <DialogContent className="gap-6 sm:max-w-md">
            <DialogHeader className="items-center gap-3 px-3 pt-4 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                <BadgeCheck aria-hidden="true" className="size-7" />
              </span>
              <DialogTitle className="text-2xl font-semibold">Welcome to ysocial</DialogTitle>
              <DialogDescription className="max-w-xs text-balance leading-relaxed">
                <span className="mb-1 block font-medium text-foreground">You just got verified!</span>
                You’re off the waitlist. Share your first post, reply to someone in the feed, or make your profile your own.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={auth.dismissApprovalWelcome}>Continue</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {auth.error && (
        <div className="flex items-center justify-between gap-2">
          <p role="alert" className="text-sm text-destructive">
            {auth.error}
          </p>
          <IconButton label="Retry account" onClick={() => void auth.reload()}>
            <RotateCcw />
          </IconButton>
        </div>
      )}
      {signInError !== null && (
          <p role="alert" className="text-sm text-destructive">
            {signInError === "account_banned" ? "This account is banned."
              : signInError === "account_deleted" ? "This account was removed."
                : "Sign-in failed. Try signing in again."}
          </p>
        )}
    </section>
  );
}

function BanNotice({ ban }: { ban: { at: string; reason: string | null; by: string | null; byProfileHandle: string | null } }) {
  const [open, setOpen] = useState(true);
  const date = new Date(ban.at);
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted p-4 text-sm">
        <span className="font-semibold">Your account is banned</span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>View details</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You've been banned</DialogTitle>
            <DialogDescription>You can still browse ysocial.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-semibold">Reason</dt>
              <dd className="wrap-anywhere whitespace-pre-wrap">{ban.reason || "No reason provided."}</dd>
            </div>
            <div>
              <dt className="font-semibold">When</dt>
              <dd><time dateTime={ban.at}>{formattedDate}</time></dd>
            </div>
            <div>
              <dt className="font-semibold">Banned by</dt>
              <dd>
                {ban.byProfileHandle ? (
                  <Link className="font-medium underline-offset-4 hover:underline focus-visible:underline"
                    to={`/@${ban.byProfileHandle}`} onClick={() => setOpen(false)}>
                    {ban.by}
                  </Link>
                ) : ban.by ?? "Moderation team"}
              </dd>
            </div>
          </dl>
          <Button variant="outline" onClick={() => setOpen(false)}>Continue browsing</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
