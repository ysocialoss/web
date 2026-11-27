import { useEffect, useId, useState } from "react";
import { Link, useParams } from "react-router";
import { Flag, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  api,
  errorMessage,
  illegalDetailsMin,
  legalCategories,
  reportReasons,
  type LegalCategory,
  type ReportReason,
  type ReportStatus,
} from "@/lib/api";
import { reasonLabels } from "@/features/reports/report-dialog";
import { legalCategoryLabels } from "@/features/reports/legal-categories";

export function ReportPage() {
  usePageTitle("Report content");
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState<ReportReason>("illegal");
  const [legalGround, setLegalGround] = useState<LegalCategory | "">("");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reference: string; statusToken: string } | null>(null);
  const ids = { url: useId(), reason: useId(), legal: useId(), details: useId(), name: useId(), email: useId(), faith: useId() };
  const contactOptional = reason === "illegal" && legalGround === "child_sexual_abuse";
  const ready = url.trim() && details.trim().length >= illegalDetailsMin && goodFaith &&
    (contactOptional || (name.trim() && email.trim()));

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await api.publicReport({
        url: url.trim(),
        reason,
        details: details.trim(),
        goodFaith: true,
        ...(reason === "illegal" && legalGround ? { legalGround } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setResult(created);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const statusPath = `/report/status/${result.statusToken}`;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Report received</h1>
        <p className="text-sm leading-relaxed">
          Thank you. Your reference is <strong className="font-mono">{result.reference}</strong>. We review every report and
          decide in a timely, diligent and objective manner.
        </p>
        <p className="text-sm leading-relaxed">
          Save this private link to follow the status of your report. Anyone with the link can see the status, so do not share it:
        </p>
        <p className="break-all rounded-lg border bg-muted px-4 py-3 font-mono text-xs">{`${window.location.origin}${statusPath}`}</p>
        <Button render={<Link to={statusPath} />} nativeButton={false}>Open status page</Button>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Report content</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use this form to report illegal content or content that breaks our <Link to="/legal/terms" className="underline underline-offset-4">rules</Link>, including AI-generated content, which is strictly forbidden,
          also without an account (Art. 16 DSA). If you have an account, the report option in a post's or profile's menu is quicker.
          If someone is in immediate danger, call 110.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={ids.url} className="text-sm font-medium">Link to the post or profile</label>
        <Input id={ids.url} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://ysocial.cc/posts/..." required maxLength={500} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={ids.reason} className="text-sm font-medium">Reason</label>
        <select id={ids.reason} value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          {reportReasons.map((value) => <option key={value} value={value}>{reasonLabels[value].label}</option>)}
        </select>
      </div>
      {reason === "illegal" && (
        <div className="space-y-1.5">
          <label htmlFor={ids.legal} className="text-sm font-medium">Which law does it break? <span className="font-normal text-muted-foreground">(optional)</span></label>
          <select id={ids.legal} value={legalGround} onChange={(event) => setLegalGround(event.target.value as LegalCategory | "")}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm">
            <option value="">Not sure</option>
            {legalCategories.map((value) => <option key={value} value={value}>{legalCategoryLabels[value]}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor={ids.details} className="text-sm font-medium">Explanation</label>
        <Textarea id={ids.details} value={details} rows={4} maxLength={1000} required
          placeholder={`Explain why this content is illegal or breaks the rules, at least ${illegalDetailsMin} characters`}
          onChange={(event) => setDetails(event.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={ids.name} className="text-sm font-medium">Your name {contactOptional && <span className="font-normal text-muted-foreground">(optional)</span>}</label>
          <Input id={ids.name} value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={ids.email} className="text-sm font-medium">Your email {contactOptional && <span className="font-normal text-muted-foreground">(optional)</span>}</label>
          <Input id={ids.email} type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        We only use your contact details to handle this report. The person you report does not see them. See the{" "}
        <Link to="/legal/privacy" className="underline underline-offset-4">privacy policy</Link>.
      </p>
      <label htmlFor={ids.faith} className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed">
        <Checkbox id={ids.faith} checked={goodFaith} onCheckedChange={(checked) => setGoodFaith(checked === true)} className="mt-1" />
        I believe in good faith that the information and allegations in this report are accurate and complete.
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" variant="destructive" disabled={!ready || busy}>
        {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Flag aria-hidden="true" />}
        Send report
      </Button>
    </form>
  );
}

const statusText: Record<ReportStatus["status"], string> = {
  open: "We have received your report and will review it.",
  resolved: "We reviewed the report.",
  dismissed: "We reviewed the report and found no violation.",
};

export function ReportStatusPage() {
  usePageTitle("Report status");
  const { token = "" } = useParams();
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api.reportStatus(token, controller.signal).then(setStatus).catch((reason) => {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    });
    return () => controller.abort();
  }, [token]);
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Report status</h1>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!status && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status && (
        <dl className="space-y-3 text-sm">
          <div><dt className="font-semibold">Reference</dt><dd className="font-mono">{status.reference}</dd></div>
          <div><dt className="font-semibold">Received</dt><dd>{new Date(status.receivedAt).toLocaleString()}</dd></div>
          <div>
            <dt className="font-semibold">Status</dt>
            <dd>
              {statusText[status.status]}{" "}
              {status.status === "resolved" && (status.actionTaken
                ? "We took action against the content or account."
                : "We did not take action.")}
            </dd>
          </div>
          {status.resolvedAt && <div><dt className="font-semibold">Decided</dt><dd>{new Date(status.resolvedAt).toLocaleString()}</dd></div>}
        </dl>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        If you disagree with the outcome, you can contact us through the address in the <Link to="/legal/imprint" className="underline underline-offset-4">imprint</Link>,
        turn to a certified out-of-court dispute settlement body (Art. 21 DSA) or go to court.
      </p>
    </div>
  );
}
