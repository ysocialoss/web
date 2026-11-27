import { useState } from "react";
import { Link } from "react-router";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadDataExport, errorMessage } from "@/lib/api";
import { SettingsGroup } from "./settings-group";

export function YourDataSettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      await downloadDataExport();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SettingsGroup
      title="Your data"
      description={<>Your rights under the GDPR. See the <Link to="/legal/privacy" className="underline underline-offset-4">privacy policy</Link>.</>}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Download your data</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A ZIP file with your profile, posts, media, connections, settings, activity and moderation history as JSON.
              Message content stays end-to-end encrypted and is not included.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void download()}>
            {busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            Download
          </Button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
      <Link to="/moderation" className="block px-4 py-3.5 hover:bg-muted/50">
        <p className="text-sm font-medium">Moderation notices</p>
        <p className="mt-0.5 text-sm text-muted-foreground">Decisions about your content, your appeals and the outcome of your reports.</p>
      </Link>
    </SettingsGroup>
  );
}
