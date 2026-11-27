import { useId, useState } from "react";
import { Link } from "react-router";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/use-page-title";
import { api, errorMessage } from "@/lib/api";

const minLength = 10;

export function ContactPage() {
  usePageTitle("Contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const ids = { name: useId(), email: useId(), message: useId() };
  const ready = message.trim().length >= minLength;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.sendContact({
        message: message.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(website ? { website } : {}),
      });
      setSent(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Message sent</h1>
        <p className="text-sm leading-relaxed">
          Thank you, we received your message.{" "}
          {email.trim() ? "We will reply to the email address you gave." : "You did not give an email address, so we cannot reply."}
        </p>
        <Button render={<Link to="/" />} nativeButton={false}>Back to ysocial</Button>
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
        <h1 className="text-2xl font-semibold tracking-tight">Contact</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Write to the team behind ysocial in German or English. To report content, use the{" "}
          <Link to="/report" className="underline underline-offset-4">report form</Link> instead.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={ids.name} className="text-sm font-medium">Your name <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input id={ids.name} value={name} maxLength={100} autoComplete="name" onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={ids.email} className="text-sm font-medium">Your email <span className="font-normal text-muted-foreground">(optional, needed for a reply)</span></label>
          <Input id={ids.email} type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={ids.message} className="text-sm font-medium">Message</label>
        <Textarea id={ids.message} value={message} rows={6} maxLength={2000} required
          placeholder={`What can we help with? At least ${minLength} characters`}
          onChange={(event) => setMessage(event.target.value)} />
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        We only use your details to answer your message. Only administrators can read it, and we delete it after a few months.
        See the <Link to="/legal/privacy" className="underline underline-offset-4">privacy policy</Link>.
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!ready || busy}>
        {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
        Send message
      </Button>
    </form>
  );
}
