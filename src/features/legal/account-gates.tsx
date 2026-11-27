import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api";
import type { AuthState } from "@/features/auth/use-auth";

export const collectedFeedData = [
  { en: "Which posts appeared on your screen and roughly how long they stayed visible", de: "Welche Beiträge auf deinem Bildschirm erschienen und wie lange sie ungefähr sichtbar waren" },
  { en: "Opening a post, expanding text, revealing text spoilers, opening media and playing voice notes", de: "Öffnen von Beiträgen, Aufklappen von Text, Aufdecken von Text-Spoilern, Öffnen von Medien und Abspielen von Sprachnachrichten" },
  { en: "The website domain of links you open and the topics you open", de: "Die Domain geöffneter Links und geöffnete Themen" },
  { en: "Likes, reposts, saves, replies, quotes, poll votes, follows, blocks and reports", de: "Likes, Reposts, Lesezeichen, Antworten, Zitate, Umfrage-Stimmen, Follows, Blockierungen und Meldungen" },
  { en: "Where in the app it happened (for example the Feed, Following or a profile) and the position in the list", de: "Wo in der App es passierte (zum Beispiel im Feed, bei Gefolgt oder auf einem Profil) und die Position in der Liste" },
  { en: "Feedback you give with Interested, Not interested, Snooze and topic choices", de: "Rückmeldungen über Interessiert, Nicht interessiert, Stummschalten und Themenwahl" },
  { en: "Which posts the Feed picked for you, in which order, and the signals it used to rank them", de: "Welche Beiträge der Feed für dich ausgewählt hat, in welcher Reihenfolge und welche Signale er für die Sortierung genutzt hat" },
  { en: "Whether you use a phone or a desktop, derived from your browser's request headers", de: "Ob du ein Smartphone oder einen Computer nutzt, abgeleitet aus den Anfrage-Headern deines Browsers" },
  { en: "A random session number that is forgotten when you close the tab", de: "Eine zufällige Sitzungsnummer, die beim Schließen des Tabs vergessen wird" },
];

export function FeedChoiceDialog({ onDone, onDismiss }: {
  onDone: (personalize: boolean) => void;
  onDismiss?: () => void;
}) {
  const [busy, setBusy] = useState<"on" | "off" | null>(null);
  const [error, setError] = useState("");
  const fromNav = onDismiss !== undefined;
  async function choose(personalize: boolean) {
    setBusy(personalize ? "on" : "off");
    setError("");
    try {
      if (fromNav && !personalize) void api.feedChoiceDeclined().catch(() => {});
      else await api.setFeedPreferences(personalize, fromNav ? "nav" : undefined);
      onDone(personalize);
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(null);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (fromNav && busy === null) {
          void api.feedChoiceDeclined().catch(() => {});
          onDismiss();
        } else details.cancel();
      }}
    >
      <DialogContent showCloseButton={fromNav} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl font-semibold">{fromNav ? "Turn on your Feed?" : "Personalize your feed?"}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {fromNav && "The Feed ranks posts for you, so it needs feed personalization. Following stays available either way. "}
            ysocial is learning to suggest posts you will like. If you turn this on, we record how you use the
            feed on ysocial, only to make your feed better. Nothing from other websites or apps is used, and nothing
            is used for advertising, sold or passed to third parties.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="font-medium">What is recorded</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            {collectedFeedData.map((item) => <li key={item.en}>{item.en}</li>)}
          </ul>
          <p className="text-muted-foreground">
            Viewing data is deleted after 180 days, interactions after 12 months. You can change your choice or clear
            everything at any time in Settings, Privacy and safety. Turning this on also uses your earlier likes,
            reposts, saves, replies, quotes and follows as starting signals.
          </p>
          <p className="text-muted-foreground">
            Legal basis: your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time. Details are in the{" "}
            <Link to="/legal/privacy" target="_blank" className="underline underline-offset-4">privacy policy</Link> and on{" "}
            <Link to="/legal/feed" target="_blank" className="underline underline-offset-4">how the feed works</Link>.
          </p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => void choose(false)}>
            {busy === "off" && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {fromNav ? "Not now" : "Keep off"}
          </Button>
          <Button disabled={busy !== null} onClick={() => void choose(true)}>
            {busy === "on" && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Turn on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TermsUpdateDialog({ version, onDone, onLogout }: { version: string; onDone: () => void; onLogout: () => void }) {
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    setBusy(true);
    setError("");
    try {
      await api.acceptTerms(version);
      onDone();
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(_open, details) => details.cancel()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-xl font-semibold">Our terms have been updated</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Please read the <Link to="/legal/terms" target="_blank" className="underline underline-offset-4">Terms of use</Link>{" "}
            and confirm to keep using ysocial. You can also delete your account in Settings instead.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="flex cursor-pointer items-start gap-3.5 rounded-lg border px-4 py-3">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={age} disabled={busy}
              onChange={(event) => setAge(event.target.checked)} />
            I am at least 16 years old.
          </label>
          <label className="flex cursor-pointer items-start gap-3.5 rounded-lg border px-4 py-3">
            <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={terms} disabled={busy}
              onChange={(event) => setTerms(event.target.checked)} />
            I accept the updated Terms of use.
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={busy} onClick={onLogout}>Log out</Button>
          <Button disabled={busy || !age || !terms} onClick={() => void accept()}>
            {busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModerationNoticeBanner({ userId }: { userId: string }) {
  const [unseen, setUnseen] = useState(0);
  const { pathname } = useLocation();
  const onModerationPage = pathname === "/moderation" || pathname.startsWith("/moderation/");
  useEffect(() => {
    if (onModerationPage) return;
    const controller = new AbortController();
    api.moderationNotices(controller.signal)
      .then((notices) => setUnseen(notices.unseen))
      .catch(() => undefined);
    return () => controller.abort();
  }, [userId, onModerationPage]);
  if (!unseen || onModerationPage) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted p-4 text-sm" role="status">
      <span className="flex items-center gap-2 font-medium">
        <ShieldAlert aria-hidden="true" className="size-4" />
        You have {unseen === 1 ? "a new notice" : `${unseen} new notices`} from the moderation team
      </span>
      <Button size="sm" variant="outline" render={<Link to="/moderation" />} nativeButton={false}>View</Button>
    </div>
  );
}

export function AccountGates({ auth }: { auth: AuthState }) {
  const session = auth.session;
  if (!session?.authenticated || session.needsOnboarding) return null;
  if (session.termsCurrent === false)
    return <TermsUpdateDialog version={session.termsVersion} onDone={() => void auth.reload()} onLogout={auth.logout} />;
  if (session.feedChoiceNeeded && !session.ban && !auth.showApprovalWelcome)
    return <FeedChoiceDialog onDone={() => void auth.reload()} />;
  return null;
}
