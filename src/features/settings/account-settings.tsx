import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog as SettingsDialog } from "@base-ui/react/dialog";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Ban,
  Camera,
  ChevronRight,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  LogOut,
  Pencil,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectionsPanel } from "@/features/settings/connections-panel";
import { NavigationEditor } from "./navigation-editor";
import { NotificationPreferences } from "./notification-preferences";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast-manager";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeSwitch } from "@/features/auth/account-menu";
import { useSessionHint } from "@/features/auth/session-hint";
import type { AuthState } from "@/features/auth/use-auth";
import { BannerEditor } from "@/features/profile/banner-editor";
import { BannerImage } from "@/features/profile/banner-image";
import { EditProfileDialog, type ProfileEditTab } from "@/features/profile/profile-edit-dialog";
import { peekProfile, profileCacheKey, storeProfile } from "@/features/profile/profile-cache";
import { ProfilePictureDialog, verifyAccount } from "@/features/profile/profile-picture-dialog";
import { PushSettings, muteOptions } from "@/features/notifications/push-settings";
import { supportsPush } from "@/features/notifications/enable-push";
import { useNotifications } from "@/features/notifications/notifications-context";
import { BlockedAccountsDialog } from "@/features/reports/blocked-accounts-dialog";
import { SiteWordmark } from "@/components/layout/site-wordmark";
import { useNow } from "@/hooks/use-now";
import { api, errorMessage, type MuteDuration, type Profile, type Session } from "@/lib/api";
import {
  MAIN_LOGO,
  useBranding,
  variations,
  type BrandingPreference,
  type Variation,
} from "@/lib/branding";
import { cn } from "@/lib/utils";

type SignedInUser = Extract<Session, { needsOnboarding: false }>["user"];

const sections = ["Account", "App connections", "Appearance", "Notifications", "Privacy and safety", "Session"] as const;
type SettingsSection = (typeof sections)[number];
const SelectedSection = createContext<SettingsSection>("Account");

export function AccountSettingsModal({
  auth,
  onClose,
  returnFocus,
}: {
  auth: AuthState;
  onClose: () => void;
  returnFocus: HTMLButtonElement | null;
}) {
  const { session } = auth;
  const hint = useSessionHint(session);

  let body: ReactNode;
  if (session === null) {
    body = auth.error ? (
      <div role="alert" className="space-y-3 text-sm">
        <p className="text-destructive">{auth.error}</p>
        <Button variant="outline" onClick={() => void auth.reload()}>
          Try again
        </Button>
      </div>
    ) : (
      <SettingsSkeleton signedIn={!!hint} />
    );
  } else if (!session.authenticated) {
    body = (
      <Notice
        title="Sign in to manage your account"
        action={
          <Button render={<a href="/auth/login" />} nativeButton={false}>
            Log in with CNS
          </Button>
        }
      />
    );
  } else if (session.needsOnboarding) {
    body = (
      <Notice
        title="Finish your profile first"
        action={
          <Button render={<Link to="/onboarding" />} nativeButton={false}>
            Choose a handle
          </Button>
        }
      />
    );
  } else {
    body = (
      <SignedInSettings
        key={session.user.id}
        auth={auth}
        user={session.user}
        avatarUrl={session.avatarUrl}
        active={!session.pendingApproval && !session.ban}
      />
    );
  }

  return (
    <SettingsDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SettingsDialog.Portal>
        <SettingsDialog.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs" />
        <SettingsDialog.Popup
          finalFocus={() => returnFocus ?? true}
          className="fixed top-1/2 left-1/2 z-50 flex h-[min(46rem,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-background text-foreground shadow-2xl outline-none sm:h-[min(46rem,calc(100dvh-4rem))] sm:w-[calc(100%-4rem)]"
        >
          <header className="flex shrink-0 items-center justify-between border-b px-4 py-2 sm:px-6">
            <SettingsDialog.Title className="text-lg font-semibold">Account settings</SettingsDialog.Title>
            <SettingsDialog.Close
              aria-label="Close account settings"
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-2 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-sm font-medium">Close</span>
              <Kbd aria-hidden="true" className="hidden sm:inline-flex">Esc</Kbd>
            </SettingsDialog.Close>
          </header>
          {session?.authenticated && !session.needsOnboarding ? body : (
            <div className="min-h-0 overflow-auto p-4 sm:p-8">{body}</div>
          )}
        </SettingsDialog.Popup>
      </SettingsDialog.Portal>
    </SettingsDialog.Root>
  );
}

function Notice({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <p className="text-sm font-medium">{title}</p>
      {action}
    </div>
  );
}

function SettingsSkeleton({ signedIn }: { signedIn: boolean }) {
  return (
    <div role="status" aria-label="Loading account settings" className="space-y-6">
      <Skeleton className="h-56 w-full rounded-xl" />
      {signedIn && <Skeleton className="h-32 w-full rounded-xl" />}
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

function Section({
  title,
  description,
  children,
  bare = false,
}: {
  title: SettingsSection;
  description?: string;
  children: ReactNode;
  bare?: boolean;
}) {
  const selected = useContext(SelectedSection);
  return (
    <section aria-label={title} hidden={selected !== title} className="space-y-2">
      <div className="px-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {bare ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground">
          {children}
        </div>
      )}
    </section>
  );
}

function Row({
  icon,
  title,
  description,
  action,
  destructive = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4.5",
            destructive && "bg-destructive/10 text-destructive",
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", destructive && "text-destructive")}>
          {title}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function useOwnProfile(user: SignedInUser) {
  const key = profileCacheKey(user.handle, user.id);
  const [loaded, setLoaded] = useState<Profile | null>(() => peekProfile(key));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.profile(user.handle, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        storeProfile(key, result);
        setLoaded(result);
        setError("");
      },
      (reason: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      },
    );
    return () => controller.abort();
  }, [key, user.handle, attempt]);
  const profile = loaded?.profile.id === user.id ? loaded : null;
  return {
    profile,
    error,
    retry: () => setAttempt((current) => current + 1),
    update(change: (profile: Profile) => Profile) {
      setLoaded((current) => {
        if (!current) return current;
        const next = change(current);
        storeProfile(key, next);
        return next;
      });
    },
  };
}

function SignedInSettings({
  auth,
  user,
  avatarUrl,
  active,
}: {
  auth: AuthState;
  user: SignedInUser;
  avatarUrl: string | null;
  active: boolean;
}) {
  const own = useOwnProfile(user);
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<SettingsSection>(() => {
    if (!active) return "Appearance";
    return params.has("connection") || params.has("domainconnect") ? "App connections" : "Account";
  });
  const available: readonly SettingsSection[] = active ? sections : sections.filter((section) => section === "Appearance" || section === "Session");
  const current = available.includes(selected) ? selected : "Appearance";
  const content = useRef<HTMLDivElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<ProfileEditTab>("profile");
  const [pictureOpen, setPictureOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { profile } = own;
  const name = user.displayName.trim() || user.handle;

  function edit(tab: ProfileEditTab) {
    setEditTab(tab);
    setEditOpen(true);
  }

  return (
    <SelectedSection.Provider value={current}>
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)] sm:grid-rows-1">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-auto border-b bg-muted/45 p-2 sm:flex-col sm:border-r sm:border-b-0 sm:p-4"
        >
          {available.map((section) => (
            <button
              key={section}
              type="button"
              aria-current={current === section ? "true" : undefined}
              onClick={() => {
                setSelected(section);
                if (content.current) content.current.scrollTop = 0;
              }}
              className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground"
            >
              {section}
            </button>
          ))}
        </nav>
        <div ref={content} className="min-w-0 overflow-y-auto overscroll-contain p-4 sm:p-8">
          {active && (
            <>
              <Section title="Account">
                <div className="relative aspect-3/1 bg-linear-to-br from-muted to-muted/40">
                  {user.bannerUrl && (
                    <BannerImage src={user.bannerUrl} crop={user.bannerCrop} alt="" />
                  )}
                  <BannerEditor
                    bannerUrl={user.bannerUrl}
                    verifyAccount={(signal) => verifyAccount(user.id, signal)}
                    onSaved={(url, crop) => {
                      auth.updateBanner(user.id, url, crop);
                      own.update((current) => ({
                        ...current,
                        profile: { ...current.profile, bannerUrl: url, bannerCrop: crop },
                      }));
                    }}
                  />
                </div>
                <div className="px-4 pb-4">
                  <div className="flex items-end justify-between gap-3">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Change profile picture"
                            aria-haspopup="dialog"
                            onClick={() => setPictureOpen(true)}
                            className="group relative -mt-8 size-16 cursor-pointer rounded-[30%] ring-4 ring-card outline-none [corner-shape:squircle] focus-visible:ring-ring"
                          />
                        }
                      >
                        <Avatar hat className="size-full">
                          {avatarUrl && (
                            <AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                          )}
                          <AvatarFallback className="text-lg">{name.slice(0, 2)}</AvatarFallback>
                          <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/60 text-white opacity-0 transition-opacity [corner-shape:inherit] group-hover:opacity-100 group-focus-visible:opacity-100">
                            <Camera className="size-6" aria-hidden="true" />
                          </span>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>Change profile picture</TooltipContent>
                    </Tooltip>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-haspopup="dialog"
                      disabled={!profile}
                      onClick={() => edit("profile")}
                    >
                      {profile || own.error ? (
                        <Pencil aria-hidden="true" />
                      ) : (
                        <LoaderCircle className="animate-spin" aria-hidden="true" />
                      )}
                      Edit profile
                    </Button>
                  </div>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label="Edit profile"
                    disabled={!profile}
                    onClick={() => edit("profile")}
                    className="-mx-2 mt-2 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="block wrap-anywhere text-base font-semibold">{name}</span>
                    <span className="block wrap-anywhere text-sm text-muted-foreground">
                      @{user.handle}
                    </span>
                    {user.pronouns && (
                      <span className="block wrap-anywhere text-sm text-muted-foreground">
                        <bdi>{user.pronouns}</bdi>
                      </span>
                    )}
                    {profile ? (
                      <span
                        className={cn(
                          "mt-1.5 block text-sm wrap-anywhere whitespace-pre-wrap",
                          !profile.profile.bio && "text-muted-foreground",
                        )}
                      >
                        {profile.profile.bio || "Add a short bio"}
                      </span>
                    ) : (
                      !own.error && <Skeleton className="mt-2 h-4 w-2/3" />
                    )}
                  </button>
                  {own.error && (
                    <div role="alert" className="mt-2 flex items-center gap-2 text-sm text-destructive">
                      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">{own.error}</span>
                      <Button size="sm" variant="ghost" onClick={own.retry}>
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              </Section>

              <Section
                title="App connections"
                description="Link other accounts to show on your public profile."
                bare
              >
                <ConnectionsPanel
                  returnTo="settings"
                  onGithubChange={(github) =>
                    own.update((current) => ({
                      ...current,
                      profile: { ...current.profile, github },
                    }))
                  }
                />
              </Section>
            </>
          )}

          <Section title="Appearance">
            <div className="space-y-2 px-4 py-3">
              <p className="text-sm font-medium">Theme</p>
              <div className="-mx-1">
                <ThemeSwitch />
              </div>
            </div>
            <BrandingPicker />
            {active && (
              <NavigationEditor
                userId={user.id}
                items={user.navigation}
                onSaved={auth.updateNavigationItems}
              />
            )}
          </Section>

          {active && (
            <>
              <Section title="Notifications">
                <NotificationPreferences userId={user.id} />
                <div className="px-4 py-3">
                  <PushSettings />
                </div>
                <MuteRow />
                <HidePreviewsRow userId={user.id} />
              </Section>

              <Section title="Privacy and safety">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setBlockedOpen(true)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <Ban className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Blocked accounts</span>
                    <span className="block text-sm text-muted-foreground">
                      See and unblock people you blocked.
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
                <Link
                  to="/messages/devices"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <KeyRound className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Chat devices</span>
                    <span className="block text-sm text-muted-foreground">
                      Manage the devices that can read your messages.
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </Section>
            </>
          )}

          <Section title="Session">
            <Row
              icon={<LogOut />}
              title="Sign out"
              description={`Signed in as @${user.handle}.`}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={auth.busy}
                  onClick={() => setConfirmLogout(true)}
                >
                  Sign out
                </Button>
              }
            />
            {active && (
              <Row
                destructive
                icon={<Trash2 />}
                title="Delete account"
                description="Permanently delete your profile, posts and media. This can't be undone."
                action={
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-haspopup="dialog"
                    onClick={() => setDeleting(true)}
                  >
                    Delete
                  </Button>
                }
              />
            )}
          </Section>

          {active && profile && (
            <EditProfileDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              tab={editTab}
              onTabChange={setEditTab}
              userId={user.id}
              profile={profile.profile}
              onGithubChange={(github) =>
                own.update((current) => ({
                  ...current,
                  profile: { ...current.profile, github },
                }))
              }
              onSaved={(updated) => {
                own.update((current) => ({
                  ...current,
                  profile: { ...current.profile, ...updated },
                }));
                auth.updateProfile(user.id, updated);
              }}
            />
          )}
          <ProfilePictureDialog
            open={pictureOpen}
            onOpenChange={setPictureOpen}
            userId={user.id}
            onChanged={(url) => {
              auth.updateAvatar(user.id, url);
              own.update((current) => ({
                ...current,
                profile: { ...current.profile, avatarUrl: url },
              }));
            }}
          />
          <BlockedAccountsDialog open={blockedOpen} onOpenChange={setBlockedOpen} />
          <ConfirmationDialog
            open={confirmLogout}
            onOpenChange={setConfirmLogout}
            title="Sign out of ysocial?"
            description="You can keep browsing public posts and sign in again whenever you're ready."
            confirmLabel="Sign out"
            onConfirm={auth.logout}
            error={auth.error}
          />
          <DeleteAccountDialog
            open={deleting}
            onOpenChange={setDeleting}
            handle={user.handle}
            onDeleted={() => auth.logout()}
          />
        </div>
      </div>
    </SelectedSection.Provider>
  );
}

function MuteRow() {
  const now = useNow();
  const [state, setState] = useState<{
    endpoint?: string;
    mutedUntil: string | null;
    forever: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (!supportsPush()) {
        setState({ mutedUntil: null, forever: false });
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        const config = await api.pushConfig(subscription?.endpoint, controller.signal);
        if (!controller.signal.aborted)
          setState({
            endpoint: config.subscribed ? subscription?.endpoint : undefined,
            mutedUntil: config.mutedUntil,
            forever: config.mutedForever,
          });
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      }
    }
    void load();
    const reload = () => void load();
    window.addEventListener("push-settings-updated", reload);
    return () => {
      controller.abort();
      window.removeEventListener("push-settings-updated", reload);
    };
  }, []);
  async function mute(duration: MuteDuration) {
    if (!state?.endpoint) return;
    setBusy(true);
    setError("");
    try {
      await api.mutePush(state.endpoint, duration);
      window.dispatchEvent(new Event("push-settings-updated"));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  const muted =
    !!state && (state.forever || (!!state.mutedUntil && new Date(state.mutedUntil).getTime() > now));
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Mute notifications</p>
          <p className="text-sm text-muted-foreground">
            {!state?.endpoint
              ? "Allow notifications on this device to mute them."
              : muted
                ? state.forever
                  ? "Muted until you turn them back on."
                  : `Muted until ${new Date(state.mutedUntil as string).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.`
                : "Pause push alerts on this device for a while."}
          </p>
        </div>
        {muted && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void mute("off")}>
            Unmute
          </Button>
        )}
      </div>
      <div role="group" aria-label="Mute for" className="flex flex-wrap gap-2">
        {muteOptions.map(({ value, label }) => (
          <Button
            key={value}
            size="sm"
            variant="outline"
            disabled={busy || !state?.endpoint}
            onClick={() => void mute(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function HidePreviewsRow({ userId }: { userId: string }) {
  const { hideContent, refresh } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(checked: boolean) {
    setBusy(true);
    setError("");
    try {
      const current = await api.session();
      if (!current.authenticated || current.needsOnboarding || current.user.id !== userId)
        throw new Error("account changed");
      await api.setNotificationContentHidden(checked);
      void refresh();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id="hide-previews-label" className="text-sm font-medium">
            Hide message content in notifications
          </p>
          <p id="hide-previews-description" className="text-sm text-muted-foreground">
            Hide previews in the app and in push alerts on all your devices.
          </p>
        </div>
        <Switch
          aria-labelledby="hide-previews-label"
          aria-describedby="hide-previews-description"
          checked={hideContent}
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
  );
}

function BrandingPicker() {
  const { preference, active, automatic, setPreference } = useBranding();
  const options: {
    value: BrandingPreference;
    label: string;
    detail: string;
    variation: Variation | null;
  }[] = [
    {
      value: "auto",
      label: "Automatic",
      detail: automatic ? `Today: ${automatic.name}` : "Switches on special days",
      variation: automatic,
    },
    { value: "default", label: "Main logo", detail: "Always the regular one", variation: null },
    ...variations.map((variation) => ({
      value: variation.id,
      label: variation.name,
      detail: variation.occasion,
      variation,
    })),
  ];
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <img src={active?.logo.src ?? MAIN_LOGO.src} alt="" className="size-6 object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="branding-label" className="text-sm font-medium">
            Logo and wordmark
          </p>
          <p className="text-sm text-muted-foreground">
            This is saved on this device.
          </p>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-labelledby="branding-label"
        className="grid grid-cols-2 gap-2 md:grid-cols-3"
      >
        {options.map(({ value, label, detail, variation }) => {
          const selected = preference === value;
          return (
            <Tooltip key={value}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreference(value)}
                    className={cn(
                      "flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected && "border-primary bg-muted ring-1 ring-primary",
                    )}
                  />
                }
              >
                <span className="flex h-12 w-full items-end overflow-visible pt-3">
                  <SiteWordmark rem={5.5} variation={variation} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {value === "auto"
                  ? "Follows the calendar and uses the main logo otherwise"
                  : value === "default"
                    ? "Always use the main logo"
                    : `${label} · ${detail}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  handle,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handle: string;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = typed.trim().replace(/^@/, "").toLowerCase() === handle;

  function change(next: boolean) {
    if (busy) return;
    if (!next) {
      setTyped("");
      setError("");
    }
    onOpenChange(next);
  }

  async function remove() {
    if (!matches || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteAccount(handle);
    } catch (reason) {
      setError(errorMessage(reason));
      setBusy(false);
      return;
    }
    onDeleted();
    toast.add({ title: "Your account was deleted" });
    void navigate("/", { replace: true });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
            Delete your account?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, posts, replies, likes, follows, pictures and
            chat devices. It can&apos;t be undone, and your handle becomes available to others.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void remove();
          }}
        >
          <label htmlFor="confirm-delete-handle" className="text-sm font-medium">
            Type <span className="font-mono">@{handle}</span> to confirm
          </label>
          <Input
            id="confirm-delete-handle"
            value={typed}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => change(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches || busy}>
              {busy ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
              Delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
