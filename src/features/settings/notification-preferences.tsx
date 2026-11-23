import { SettingsGroup } from "./settings-group";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { verifyAccount } from "@/features/profile/profile-picture-dialog";
import { api, errorMessage, type NotificationPreferenceKind } from "@/lib/api";

const labels = {
  like: "Likes",
  repost: "Reposts",
  quote: "Quotes",
  friends_repost: "Reposts to friends",
  reply: "Replies",
  mention: "Mentions",
  dm_message: "Messages",
  dm_invite: "Message invites",
  follow: "Follows",
  friend: "New friends",
} satisfies Record<NotificationPreferenceKind, string>;
const groups: { title: string; kinds: NotificationPreferenceKind[] }[] = [
  {
    title: "Post activity",
    kinds: ["like", "reply", "mention", "repost", "friends_repost", "quote"],
  },
  {
    title: "Messages and connections",
    kinds: ["dm_message", "dm_invite", "follow", "friend"],
  },
];

export function NotificationPreferences({ userId }: { userId: string }) {
  const [mutedKinds, setMutedKinds] = useState<
    NotificationPreferenceKind[] | null
  >(null);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.notificationPreferences(controller.signal).then(
      (preferences) => {
        if (!controller.signal.aborted) setMutedKinds(preferences.mutedKinds);
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      },
    );
    return () => controller.abort();
  }, [loadAttempt]);

  return (
    <div>
      <fieldset className="min-w-0">
        <legend className="sr-only">When to notify me</legend>
        {mutedKinds && (
          <div className="space-y-8">
            {groups.map(({ title, kinds }) => (
              <div key={title} role="group" aria-label={title}>
                <SettingsGroup title={title}>
                  {kinds.map((kind) => (
                    <PreferenceRow
                      key={kind}
                      kind={kind}
                      initialEnabled={!mutedKinds.includes(kind)}
                      userId={userId}
                    />
                  ))}
                </SettingsGroup>
              </div>
            ))}
          </div>
        )}
      </fieldset>
      {!mutedKinds && (
        <div className="space-y-2 px-1 text-sm">
          {error ? (
            <>
              <p role="alert" className="text-destructive">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError("");
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Retry
              </Button>
            </>
          ) : (
            <p role="status" className="text-muted-foreground">
              Loading preferences…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreferenceRow({
  kind,
  initialEnabled,
  userId,
}: {
  kind: NotificationPreferenceKind;
  initialEnabled: boolean;
  userId: string;
}) {
  const id = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(checked: boolean) {
    setEnabled(checked);
    setSaving(true);
    setError("");
    try {
      await verifyAccount(userId);
      const preferences = await api.setNotificationPreference(kind, checked);
      setEnabled(!preferences.mutedKinds.includes(kind));
    } catch (reason) {
      setEnabled(enabled);
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
      >
        <span id={`${id}-label`}>{labels[kind]}</span>
        <Switch
          id={id}
          aria-labelledby={`${id}-label`}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-busy={saving}
          checked={enabled}
          readOnly={saving}
          onCheckedChange={(checked) => void save(checked)}
        />
      </label>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="px-4 pb-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
