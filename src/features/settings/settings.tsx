import { useEffect, useState } from "react";

import { Link } from "react-router";
import { ThemeSelector } from "./theme-selector";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  api,
  ApiError,
  errorMessage,
  type Profile,
  type Session,
} from "@/lib/api";
import type { AuthState } from "@/features/auth/use-auth";
import { AvatarCropper } from "@/features/profile/avatar-cropper";
import { RecentAvatars } from "@/features/profile/recent-avatars";
import { BannerEditor } from "@/features/profile/banner-editor";

import { updateAuthor } from "@/features/feed/optimistic-actions";

import { usePageTitle } from "@/hooks/use-page-title";
import { ProfileForm } from "@/features/profile/profile-form";
import { NotificationSettings } from "./notification-settings";

type SettingsUser = Extract<Session, { needsOnboarding: false }>["user"];

export function SettingsPage({ auth }: { auth: AuthState }) {
  usePageTitle("Settings");
  const session = auth.session;
  return (
    <div className="max-w-md space-y-3 text-sm">
      <h1>Settings</h1>
      <ThemeSelector />
      {session === null ? (
        <p role="status">Loading account…</p>
      ) : session.authenticated && !session.needsOnboarding ? (
        !session.pendingApproval && !session.ban && <div key={session.user.id} className="space-y-4">
          <ProfileSettings
            key={session.user.id}
            user={session.user}
            auth={auth}
          />
          <NotificationSettings userId={session.user.id} />
        </div>
      ) : session.authenticated ? (
        <Link to="/onboarding">Finish profile</Link>
      ) : (
        <a href="/auth/login">Sign in</a>
      )}
      {session?.authenticated && (
        <Button variant="outline" disabled={auth.busy} onClick={auth.logout}>
          Sign out
        </Button>
      )}
      {auth.error && <p role="alert">{auth.error}</p>}
    </div>
  );
}

function ProfileSettings({
  user,
  auth,
}: {
  user: SettingsUser;
  auth: AuthState;
}) {
  const [profile, setProfile] = useState<Profile["profile"] | null>(null);
  const [error, setError] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .profile(user.handle, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProfile(result.profile);
        setError("");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [user.handle, loadAttempt]);

  async function verifyAccount(signal?: AbortSignal) {
    const current = await api.session(signal);
    if (
      !current.authenticated ||
      current.needsOnboarding ||
      current.user.id !== user.id
    )
      throw new ApiError(403, "retry_account_changed");
  }
  return (
    <div className="space-y-3">
      <div className="relative h-9 w-36 rounded-xl bg-muted [&_span]:opacity-100">
        <BannerEditor
          bannerUrl={user.bannerUrl}
          verifyAccount={verifyAccount}
          onSaved={(url, crop) => auth.updateBanner(user.id, url, crop)}
        />
      </div>
      <div>
        <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            Change profile picture
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Profile picture</DialogTitle>
              <DialogDescription>
                Choose a picture, then adjust the crop.
              </DialogDescription>
            </DialogHeader>
            <AvatarCropper
              emptyFooter={
                <RecentAvatars
                  onSelect={async (id, signal) => {
                    await verifyAccount(signal);
                    const result = await api.selectRecentAvatar(id, signal);
                    updateAuthor(user.id, { avatarUrl: result.avatarUrl });
                    auth.updateAvatar(user.id, result.avatarUrl);
                    setAvatarOpen(false);
                  }}
                />
              }
              onSave={async (picture, signal) => {
                await verifyAccount(signal);
                const result = await api.uploadAvatar(picture, signal);
                updateAuthor(user.id, { avatarUrl: result.avatarUrl });
                auth.updateAvatar(user.id, result.avatarUrl);
                setAvatarOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      {error && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          <p>{error}</p>
          {!profile && (
            <Button
              variant="outline"
              onClick={() => setLoadAttempt((current) => current + 1)}
            >
              Retry profile
            </Button>
          )}
        </div>
      )}
      {!profile ? (
        !error && (
          <p role="status" className="text-sm text-muted-foreground">
            Loading profile settings…
          </p>
        )
      ) : (
        <ProfileForm
          key={profile.id}
          userId={user.id}
          profile={profile}
          onSaved={(updated) => {
            setProfile((current) =>
              current ? { ...current, ...updated } : current,
            );
            auth.updateProfile(user.id, updated);
          }}
        />
      )}
    </div>
  );
}
