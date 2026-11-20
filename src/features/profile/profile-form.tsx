import { useId, useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";
import { updateAuthor } from "@/features/feed/optimistic-actions";
import { profileChanges } from "./profile-update";
import { Check, LoaderCircle, X } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useHandleAvailability } from "./use-handle-availability";
import { PronounsField } from "./pronouns-field";
import { invalidateProfileCard } from "./profile-card-cache";

type ProfileFields = Awaited<ReturnType<typeof api.updateProfile>>;
const bioLimit = 160;

export function ProfileForm({
  userId,
  profile,
  onSaved,
  onSavingChange,
  onCancel,
  appearance = "default",
}: {
  userId: string;
  profile: ProfileFields;
  onSaved: (profile: ProfileFields) => void | Promise<void>;
  onSavingChange?: (saving: boolean) => void;
  onCancel?: () => void;
  appearance?: "default" | "dialog";
}) {
  const dialog = appearance === "dialog";
  const fieldSpacing = dialog ? "space-y-3 [&>label]:block" : "space-y-2";
  const id = useId();
  const [baseline, setBaseline] = useState(profile);
  const [draft, setDraft] = useState<ProfileFields>({
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    pronouns: profile.pronouns,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const changes = profileChanges(baseline, draft);
  const changed = Object.keys(changes).length > 0;
  const availability = useHandleAvailability(draft.handle, baseline.handle);
  const handleBlocked =
    availability === "taken" ||
    availability === "invalid" ||
    availability === "checking";
  const handleStatus =
    availability === "available"
      ? "Username available"
      : availability === "taken"
        ? "Username is already taken"
        : availability === "invalid"
          ? "Use 3–32 lowercase letters, numbers, or underscores."
          : availability === "checking"
            ? "Checking availability…"
            : "Couldn't check availability. You can still try saving.";

  function change(field: keyof ProfileFields, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || handleBlocked || draft.bio.length > bioLimit) return;
    if (!changed) {
      if (dialog) onCancel?.();
      return;
    }
    setSaving(true);
    onSavingChange?.(true);
    setSaved(false);
    setError("");
    try {
      const session = await api.session();
      if (
        !session.authenticated ||
        session.needsOnboarding ||
        session.user.id !== userId
      )
        throw new ApiError(403, "retry_account_changed");
      const updated = await api.updateProfile(changes);
      invalidateProfileCard(baseline.handle);
      if (updated.handle !== baseline.handle) invalidateProfileCard(updated.handle);
      updateAuthor(userId, {
        handle: updated.handle,
        displayName: updated.displayName,
      });
      setBaseline(updated);
      setDraft(updated);
      setSaved(true);
      await onSaved(updated);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="min-w-0 space-y-4">
      <fieldset
        disabled={saving}
        className={
          dialog ? "grid min-w-0 gap-4 sm:grid-cols-2" : "min-w-0 space-y-4"
        }
      >
        <div className={fieldSpacing}>
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            {dialog ? "Name" : "Display name"}
          </label>
          <Input
            id={`${id}-name`}
            required
            maxLength={80}
            value={draft.displayName}
            onChange={(event) => change("displayName", event.target.value)}
            autoComplete="nickname"
          />
        </div>
        <div className={fieldSpacing}>
          <label htmlFor={`${id}-handle`} className="text-sm font-medium">
            {dialog ? "Username" : "Handle"}
          </label>
          <InputGroup>
            <InputGroupAddon
              className={dialog ? "pl-3" : undefined}
              aria-hidden="true"
            >
              @
            </InputGroupAddon>
            <InputGroupInput
              id={`${id}-handle`}
              required
              minLength={3}
              maxLength={32}
              pattern="[a-z0-9_]{3,32}"
              value={draft.handle}
              onChange={(event) => change("handle", event.target.value)}
              autoComplete="username"
              aria-describedby={`${id}-handle-status`}
              aria-invalid={
                availability === "taken" ||
                availability === "invalid" ||
                undefined
              }
            />
            <InputGroupAddon
              align="inline-end"
              className={dialog ? "pr-3" : undefined}
              aria-hidden="true"
            >
              {availability === "available" ? (
                <Check className="text-primary" />
              ) : availability === "taken" || availability === "invalid" ? (
                <X className="text-destructive" />
              ) : availability === "checking" ? (
                <LoaderCircle className="animate-spin motion-reduce:animate-none" />
              ) : null}
            </InputGroupAddon>
          </InputGroup>
          <p id={`${id}-handle-status`} role="status" className="sr-only">
            {handleStatus}
          </p>
          {(availability === "taken" || availability === "error") && (
            <p className="wrap-anywhere text-xs text-muted-foreground">
              {handleStatus}
            </p>
          )}
        </div>
        <div className="col-span-full">
          <PronounsField
            value={draft.pronouns}
            onChange={(value) => change("pronouns", value)}
          />
        </div>
        <div className={cn("col-span-full", fieldSpacing)}>
          <label htmlFor={`${id}-bio`} className="text-sm font-medium">
            Bio
          </label>
          <Textarea
            id={`${id}-bio`}
            className={cn(
              "min-w-0 resize-none whitespace-pre-wrap wrap-anywhere",
              dialog && "py-1",
            )}
            wrap="soft"
            maxLength={bioLimit}
            aria-invalid={draft.bio.length > bioLimit || undefined}
            rows={dialog ? 3 : 4}
            value={draft.bio}
            onChange={(event) => change("bio", event.target.value)}
            aria-describedby={`${id}-bio-count`}
          />
          <p
            id={`${id}-bio-count`}
            className="text-right text-xs tabular-nums text-muted-foreground"
          >
            {draft.bio.length}/{bioLimit}
          </p>
        </div>
        {error && (
          <p role="alert" className="col-span-full text-sm text-destructive">
            {error}
          </p>
        )}
        <div
          className={`col-span-full flex flex-wrap items-center justify-end gap-3 ${dialog ? "border-t pt-4" : ""}`}
        >
          <p
            role="status"
            className={
              dialog ? "sr-only" : "mr-auto text-sm text-muted-foreground"
            }
          >
            {saved ? "Profile saved" : ""}
          </p>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className={dialog ? "min-w-24" : undefined}
            disabled={
              (!dialog && !changed) ||
              !draft.displayName.trim() ||
              draft.bio.length > bioLimit ||
              handleBlocked
            }
          >
            {saving ? "Saving…" : dialog ? "Done" : "Save profile"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
