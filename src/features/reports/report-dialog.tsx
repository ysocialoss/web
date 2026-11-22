import { useId, useState } from "react";
import { Flag, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-manager";
import {
  api,
  errorMessage,
  reportReasons,
  type ReportReason,
  type ReportTarget,
} from "@/lib/api";

export const reasonLabels: Record<ReportReason, { label: string; hint: string }> = {
  spam: { label: "Spam", hint: "Ads, scams, repetitive or misleading links" },
  harassment: { label: "Harassment or bullying", hint: "Targeting, threatening or intimidating someone" },
  hate: { label: "Hate speech", hint: "Attacks on people for who they are" },
  violence: { label: "Violence or threats", hint: "Threats, glorifying or inciting violence" },
  sexual: { label: "Sexual content", hint: "Nudity, sexual content or exploitation" },
  self_harm: { label: "Self-harm or suicide", hint: "Encouraging or depicting self-harm" },
  misinformation: { label: "Misinformation", hint: "False information that can cause harm" },
  impersonation: { label: "Impersonation", hint: "Pretending to be someone else" },
  illegal: { label: "Illegal content", hint: "Content that breaks the law" },
  other: { label: "Something else", hint: "Tell us more below" },
};

export type MessageContext = { id: string; text: string };
export const maxReportContext = 5;

export type ReportSubject =
  | { type: "post"; id: string; kind: "post" | "reply" | "quote" }
  | { type: "user"; id: string; handle: string }
  | {
      type: "message";
      conversationId: string;
      messageId: string;
      peerHandle: string;
      message: MessageContext;
      earlier: MessageContext[];
    };

function subjectTitle(subject: ReportSubject) {
  if (subject.type === "post") return `Report ${subject.kind}`;
  if (subject.type === "user") return `Report @${subject.handle}`;
  return "Report message";
}

export function ReportDialog({
  subject,
  open,
  onOpenChange,
}: {
  subject: ReportSubject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const detailsId = useId();
  const contextId = useId();
  const earlier = subject.type === "message" ? subject.earlier : [];
  const needsDetails = reason === "other" && !details.trim();

  function reset(next: boolean) {
    if (!next) {
      setReason(null);
      setDetails("");
      setIncludeContext(true);
      setError("");
    }
    onOpenChange(next);
  }

  async function submit() {
    if (!reason || needsDetails || sending) return;
    const target: ReportTarget =
      subject.type === "message"
        ? {
            type: "message",
            conversationId: subject.conversationId,
            messageId: subject.messageId,
            messages: [...(includeContext ? earlier : []), subject.message],
          }
        : { type: subject.type, id: subject.id };
    setSending(true);
    setError("");
    try {
      const result = await api.report({ reason, details: details.trim(), target });
      reset(false);
      toast.add({
        title: result.status === "already_reported" ? "You already reported this" : "Report sent",
        description: "Thanks for helping keep ysocial safe. Moderators will review it.",
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subjectTitle(subject)}</DialogTitle>
          <DialogDescription>
            Why are you reporting this? Your report is private: the person you report won't see who sent it.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label="Reason"
          value={reason}
          onValueChange={(value) => setReason(value as ReportReason)}
          className="gap-0"
        >
          {reportReasons.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted has-data-checked:bg-muted"
            >
              <RadioGroupItem value={value} className="mt-0.5" />
              <span className="min-w-0 text-sm leading-tight">
                <span className="block font-medium">{reasonLabels[value].label}</span>
                <span className="block text-xs text-muted-foreground">{reasonLabels[value].hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <div className="space-y-1.5">
          <label htmlFor={detailsId} className="text-sm font-medium">
            Details {reason === "other" ? "" : <span className="font-normal text-muted-foreground">(optional)</span>}
          </label>
          <Textarea
            id={detailsId}
            value={details}
            maxLength={1000}
            rows={3}
            placeholder="Anything moderators should know"
            onChange={(event) => setDetails(event.target.value)}
          />
        </div>
        {subject.type === "message" && (
          <div
            role="note"
            className="space-y-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <p className="flex items-start gap-2 font-medium">
              <LockOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              This message will be decrypted and sent to moderators
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Chats are end-to-end encrypted, so moderators can't read them on their own. Reporting sends a readable
              copy of the reported message from @{subject.peerHandle}
              {earlier.length > 0 && includeContext
                ? ` and the ${earlier.length === 1 ? "message" : `${earlier.length} messages`} before it`
                : ""}{" "}
              to the ysocial moderation team. Nothing else in this chat is shared.
            </p>
            {earlier.length > 0 && (
              <label htmlFor={contextId} className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox
                  id={contextId}
                  checked={includeContext}
                  onCheckedChange={(checked) => setIncludeContext(checked === true)}
                />
                Include the {earlier.length === 1 ? "previous message" : `previous ${earlier.length} messages`} for context
              </label>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)} disabled={sending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={!reason || needsDetails || sending}>
            <Flag aria-hidden="true" />
            {sending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
