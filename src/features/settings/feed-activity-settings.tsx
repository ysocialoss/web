import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { SettingsGroup } from "./settings-group";
import { forgetRankedFeeds } from "@/features/feed/use-feed";

export function FeedActivitySettings({
  userId,
  personalize,
  onChange,
  onCleared,
}: {
  userId: string;
  personalize: boolean;
  onChange: (userId: string, personalize: boolean) => void;
  onCleared?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [clearError, setClearError] = useState("");
  const [cleared, setCleared] = useState(false);

  async function change(checked: boolean) {
    setBusy(true);
    setError("");
    onChange(userId, checked);
    try {
      const current = await api.session();
      if (!current.authenticated || current.needsOnboarding || current.user.id !== userId)
        throw new Error("account changed");
      const saved = await api.setFeedPreferences(checked);
      forgetRankedFeeds();
      onChange(userId, saved.personalize);
    } catch (reason) {
      onChange(userId, !checked);
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setClearError("");
    try {
      await api.clearFeedActivity();
      forgetRankedFeeds();
      setCleared(true);
      onCleared?.();
      return true;
    } catch (reason) {
      setClearError(errorMessage(reason));
      return false;
    }
  }

  return (
    <SettingsGroup
      title="Feed activity"
      description={<>ysocial is learning to suggest posts. It uses what you view and how you interact on ysocial, and nothing else. <a href="/legal/feed" className="underline underline-offset-4">How the feed works</a></>}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p id="feed-personalize-label" className="text-sm font-medium">
              Use my activity to improve my feed
            </p>
            <p id="feed-personalize-description" className="mt-0.5 text-sm text-muted-foreground">
              Records which posts you see, open and react to. Turning this off stops recording and deletes what was recorded.
            </p>
          </div>
          <Switch
            aria-labelledby="feed-personalize-label"
            aria-describedby="feed-personalize-description"
            checked={personalize}
            disabled={busy}
            onCheckedChange={(checked) => void change(checked)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">Clear feed activity</p>
          <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
            {cleared ? "Your feed activity was cleared." : "Delete everything recorded so far, and reset your topics, snoozes, ratings and sliders."}
          </p>
        </div>
        <ConfirmationDialog
          open={confirming}
          onOpenChange={(open) => {
            setConfirming(open);
            if (open) setClearError("");
          }}
          trigger={
            <button
              type="button"
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Clear
            </button>
          }
          title="Clear feed activity?"
          description="This deletes the record of posts you viewed and interacted with, your topic choices, snoozes and post ratings, and sets the sliders back to the middle. Your posts, likes and follows stay as they are."
          confirmLabel="Clear activity"
          destructive
          error={clearError}
          onConfirm={clear}
        />
      </div>
    </SettingsGroup>
  );
}
