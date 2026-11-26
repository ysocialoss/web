import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/use-page-title";
import { api, errorMessage, type ModerationDecision, type ModerationNotices } from "@/lib/api";
import { legalCategoryLabels } from "@/features/reports/legal-categories";
import { reasonLabels } from "@/features/reports/report-dialog";
import { termsClauseTitles } from "./terms-page";

const actionText: Record<string, string> = {
  remove_post: "We removed your post",
  hide_post: "We hid your post",
  remove_media: "We removed media from your post",
  edit_post: "We edited the text of your post",
  clear_profile: "We removed details from your profile",
  edit_profile: "We changed details on your profile",
  ban: "We suspended your account",
  remove_account: "We removed your account",
  remove_message: "We removed a message you sent",
};

function groundText(decision: ModerationDecision) {
  if (decision.groundType === "terms") {
    const clause = termsClauseTitles[decision.groundRef];
    return `Terms of use, section ${decision.groundRef}${clause ? ` (${clause.en})` : ""}`;
  }
  const category = legalCategoryLabels[decision.groundRef as keyof typeof legalCategoryLabels];
  return `Illegal content: ${category ?? decision.groundRef}`;
}

function DecisionCard({ decision, onAppealed }: { decision: ModerationDecision; onAppealed: () => void }) {
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textId = useId();
  const date = new Date(decision.createdAt).toLocaleString();
  async function appeal() {
    setBusy(true);
    setError("");
    try {
      await api.appealDecision(decision.id, text.trim());
      setWriting(false);
      onAppealed();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-3 rounded-lg border p-4 text-sm" aria-labelledby={`decision-${decision.id}`}>
      <header className="space-y-0.5">
        <h2 id={`decision-${decision.id}`} className="font-semibold">{actionText[decision.action] ?? "We took a moderation action"}</h2>
        <p className="text-xs text-muted-foreground"><time dateTime={decision.createdAt}>{date}</time>{decision.reversedAt && " · reversed"}</p>
      </header>
      {decision.excerpt && <blockquote className="wrap-anywhere whitespace-pre-wrap border-l-2 pl-3 text-muted-foreground">{decision.excerpt}</blockquote>}
      <dl className="space-y-2">
        <div><dt className="font-medium">Why</dt><dd>{groundText(decision)}</dd></div>
        <div><dt className="font-medium">Facts</dt><dd className="wrap-anywhere whitespace-pre-wrap">{decision.facts}</dd></div>
        <div>
          <dt className="font-medium">How it was decided</dt>
          <dd>
            {decision.automatedDetection ? "Detected automatically" : decision.fromReport ? "After a report" : "Found by our moderation team"}
            {", "}
            {decision.automatedDecision ? "decided automatically." : "decided by a person."}
          </dd>
        </div>
      </dl>
      {decision.appeal ? (
        <div className="space-y-1 rounded-md bg-muted p-3">
          <p className="font-medium">
            Your appeal: {decision.appeal.status === "open" ? "under review" : decision.appeal.status === "reversed" ? "accepted, the decision was reversed" : "rejected, the decision stands"}
          </p>
          {decision.appeal.staffNote && <p className="wrap-anywhere whitespace-pre-wrap text-muted-foreground">{decision.appeal.staffNote}</p>}
        </div>
      ) : decision.canAppeal && !decision.reversedAt ? (
        writing ? (
          <div className="space-y-2">
            <label htmlFor={textId} className="font-medium">Why should we reconsider?</label>
            <Textarea id={textId} rows={4} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} />
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || text.trim().length < 10} onClick={() => void appeal()}>
                {busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}Send appeal
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setWriting(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setWriting(true)}>Appeal</Button>
            <span className="text-xs text-muted-foreground">until {new Date(decision.appealDeadline).toLocaleDateString()}</span>
          </p>
        )
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        You can also turn to a certified out-of-court dispute settlement body (Art. 21 DSA) or go to court.
      </p>
    </article>
  );
}

export function ModerationPage() {
  usePageTitle("Moderation notices");
  const [notices, setNotices] = useState<ModerationNotices | null>(null);
  const [error, setError] = useState("");
  const load = useCallback((signal?: AbortSignal) => {
    api.moderationNotices(signal).then((next) => {
      setNotices(next);
      if (next.unseen) void api.markNoticesSeen().catch(() => undefined);
    }).catch((reason) => {
      if (!signal?.aborted) setError(errorMessage(reason));
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Moderation notices</h1>
        <p className="text-sm text-muted-foreground">
          Decisions about your content or account and the outcome of reports you sent. See the <Link to="/legal/terms" className="underline underline-offset-4">Terms of use</Link>.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!notices && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
      {notices && notices.decisions.length === 0 && notices.reportUpdates.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-4" />Nothing here. All good.</p>
      )}
      {notices && notices.decisions.length > 0 && (
        <section className="space-y-3" aria-label="Decisions about you">
          {notices.decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} onAppealed={() => load()} />)}
        </section>
      )}
      {notices && notices.reportUpdates.length > 0 && (
        <section className="space-y-2" aria-labelledby="report-updates">
          <h2 id="report-updates" className="font-semibold">Your reports</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {notices.reportUpdates.map((update) => (
              <li key={update.id} className="space-y-0.5 px-4 py-3">
                <p className="font-medium">
                  {update.targetType === "user" ? `Profile @${update.targetHandle}` : update.targetType === "message" ? "A message" : `A post by @${update.targetHandle}`}
                  {" · "}{reasonLabels[update.reason as keyof typeof reasonLabels]?.label ?? update.reason}
                </p>
                <p className="text-muted-foreground">
                  {update.status === "dismissed" ? "We found no violation." : update.actionTaken ? "We took action. Thank you." : "We reviewed it and took no action."}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
