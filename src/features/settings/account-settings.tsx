import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dialog as SettingsDialog } from "@base-ui/react/dialog";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  Bell,
  Camera,
  ChevronRight,
  CircleAlert,
  Link2,
  LoaderCircle,
  LogOut,
  Palette,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  X,
  type LucideIcon,
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
import { SettingsGroup } from "./settings-group";
import { Input } from "@/components/ui/input";
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
import {
  EditProfileDialog,
  type ProfileEditTab,
} from "@/features/profile/profile-edit-dialog";
import { PaintPicker } from "@/features/profile/paint-picker";
import {
  peekProfile,
  profileCacheKey,
  storeProfile,
} from "@/features/profile/profile-cache";
import {
  ProfilePictureDialog,
  verifyAccount,
} from "@/features/profile/profile-picture-dialog";
import { PushSettings } from "@/features/notifications/push-settings";
import { useNotifications } from "@/features/notifications/notifications-context";
import { BlockedAccountsDialog } from "@/features/reports/blocked-accounts-dialog";
import { SiteWordmark } from "@/components/layout/site-wordmark";
import { api, errorMessage, type Profile, type Session } from "@/lib/api";
import {
  useBranding,
  variations,
  type BrandingPreference,
  type Variation,
} from "@/lib/branding";
import { cn } from "@/lib/utils";

type SignedInUser = Extract<Session, { needsOnboarding: false }>["user"];

const sections = [
  "Account",
  "Appearance",
  "Connections",
  "Notifications",
  "Privacy and safety",
] as const;
type SettingsSection = (typeof sections)[number];
const SelectedSection = createContext<SettingsSection>("Account");

const sectionIcons: Record<SettingsSection, LucideIcon> = {
  Account: User,
  Connections: Link2,
  Appearance: Palette,
  Notifications: Bell,
  "Privacy and safety": ShieldCheck,
};

function CloseButton() {
  return (
    <SettingsDialog.Close
      aria-label="Close account settings"
      className="-mr-1.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="size-4.5" aria-hidden="true" />
    </SettingsDialog.Close>
  );
}

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
  const popup = useRef<HTMLDivElement>(null);

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
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SettingsDialog.Portal>
        <SettingsDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs duration-200 ease-out data-open:animate-in data-open:fade-in-0" />
        <SettingsDialog.Popup
          ref={popup}
          initialFocus={popup}
          finalFocus={() => returnFocus ?? true}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] text-foreground outline-none duration-200 ease-out data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6 motion-reduce:slide-in-from-bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(44rem,calc(100dvh-4rem))] sm:w-[calc(100%-4rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:pt-0 sm:shadow-2xl sm:data-open:slide-in-from-bottom-0 sm:data-open:zoom-in-[0.97] motion-reduce:sm:data-open:zoom-in-100"
        >
          <SettingsDialog.Title className="sr-only">
            Account settings
          </SettingsDialog.Title>
          {session?.authenticated && !session.needsOnboarding ? (
            body
          ) : (
            <>
              <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
                <p aria-hidden="true" className="text-base font-semibold">
                  Settings
                </p>
                <CloseButton />
              </header>
              <div className="min-h-0 overflow-auto p-4 sm:p-6">{body}</div>
            </>
          )}
        </SettingsDialog.Popup>
      </SettingsDialog.Portal>
    </SettingsDialog.Root>
  );
}

function Notice({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground">
      <p className="text-sm font-medium">{title}</p>
      {action}
    </div>
  );
}

function SettingsSkeleton({ signedIn }: { signedIn: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading account settings"
      className="space-y-6"
    >
      <Skeleton className="h-56 w-full rounded-lg" />
      {signedIn && <Skeleton className="h-32 w-full rounded-lg" />}
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: SettingsSection;
  children: ReactNode;
}) {
  const selected = useContext(SelectedSection);
  return (
    <section
      aria-label={title}
      hidden={selected !== title}
      className="space-y-8 duration-200 ease-out animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:slide-in-from-bottom-0"
    >
      {title !== "Connections" && <h2 className="sr-only">{title}</h2>}
      {children}
    </section>
  );
}

function Row({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

const linkRowClass =
  "flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function LinkRowBody({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </>
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
    return params.has("connection") || params.has("domainconnect") || params.has("github")
      ? "Connections"
      : "Account";
  });
  const available: readonly SettingsSection[] = active
    ? sections
    : sections.filter((section) => section === "Appearance");
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
  const initials = name.slice(0, 2);

  function edit(tab: ProfileEditTab) {
    setEditTab(tab);
    setEditOpen(true);
  }

  return (
    <SelectedSection.Provider value={current}>
      <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] sm:grid-cols-[15rem_minmax(0,1fr)] sm:grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="hidden h-14 items-center border-r border-b bg-muted/40 px-5 sm:flex">
          <p aria-hidden="true" className="text-base font-semibold">
            Settings
          </p>
        </div>
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4 sm:px-8">
          <p aria-hidden="true" className="truncate text-base font-semibold">
            <span className="sm:hidden">Settings</span>
            <span className="max-sm:hidden">{current}</span>
          </p>
          <CloseButton />
        </header>
        <nav
          aria-label="Settings sections"
          className="flex gap-1 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] sm:flex-col sm:gap-0.5 sm:overflow-y-auto sm:border-r sm:border-b-0 sm:bg-muted/40 sm:p-3"
        >
          {available.map((section) => {
            const Icon = sectionIcons[section];
            return (
              <button
                key={section}
                type="button"
                aria-current={current === section ? "true" : undefined}
                onClick={() => {
                  setSelected(section);
                  if (content.current) content.current.scrollTop = 0;
                }}
                className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=true]:bg-foreground/8 aria-[current=true]:text-foreground sm:px-2.5 sm:py-2"
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {section}
              </button>
            );
          })}
        </nav>
        <div
          ref={content}
          className="min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain sm:col-start-2 sm:row-span-2 sm:row-start-2"
        >
          <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-7 sm:pb-10">
            {active && (
              <>
                <Section title="Account">
                  <div className="overflow-hidden rounded-lg border bg-card text-card-foreground">
                    <div className="relative aspect-3/1 bg-linear-to-br from-muted to-muted/40">
                      {user.bannerUrl && (
                        <BannerImage
                          src={user.bannerUrl}
                          crop={user.bannerCrop}
                          alt=""
                        />
                      )}
                      <BannerEditor
                        bannerUrl={user.bannerUrl}
                        verifyAccount={(signal) =>
                          verifyAccount(user.id, signal)
                        }
                        onSaved={(url, crop) => {
                          auth.updateBanner(user.id, url, crop);
                          own.update((current) => ({
                            ...current,
                            profile: {
                              ...current.profile,
                              bannerUrl: url,
                              bannerCrop: crop,
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="px-4 pb-4 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label="Change profile picture"
                                aria-haspopup="dialog"
                                onClick={() => setPictureOpen(true)}
                                className="group relative -mt-10 size-20 shrink-0 cursor-pointer rounded-[30%] ring-4 ring-card outline-none [corner-shape:squircle] focus-visible:ring-ring"
                              />
                            }
                          >
                            <Avatar hat className="size-full">
                              {avatarUrl && (
                                <AvatarImage
                                  src={avatarUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <AvatarFallback className="text-xl">
                                {initials}
                              </AvatarFallback>
                              <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/60 text-white opacity-0 transition-opacity [corner-shape:inherit] group-hover:opacity-100 group-focus-visible:opacity-100">
                                <Camera className="size-6" aria-hidden="true" />
                              </span>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            Change profile picture
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          aria-haspopup="dialog"
                          disabled={!profile}
                          onClick={() => edit("profile")}
                        >
                          {profile || own.error ? (
                            <Pencil aria-hidden="true" />
                          ) : (
                            <LoaderCircle
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          )}
                          Edit profile
                        </Button>
                      </div>
                      <div className="mt-3 min-w-0">
                        <p className="text-lg leading-tight font-semibold wrap-anywhere">
                          {name}
                        </p>
                        <p className="mt-0.5 text-sm wrap-anywhere text-muted-foreground">
                          @{user.handle}
                          {user.pronouns && (
                            <>
                              {" · "}
                              <bdi>{user.pronouns}</bdi>
                            </>
                          )}
                        </p>
                        {profile ? (
                          <p
                            className={cn(
                              "mt-3 text-sm wrap-anywhere whitespace-pre-wrap",
                              !profile.profile.bio && "text-muted-foreground",
                            )}
                          >
                            {profile.profile.bio || "No bio yet."}
                          </p>
                        ) : (
                          !own.error && <Skeleton className="mt-3 h-4 w-2/3" />
                        )}
                      </div>
                      {own.error && (
                        <div
                          role="alert"
                          className="mt-3 flex items-center gap-2 text-sm text-destructive"
                        >
                          <CircleAlert
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">{own.error}</span>
                          <Button size="sm" variant="ghost" onClick={own.retry}>
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <SettingsGroup title="Danger zone">
                    <Row
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
                  </SettingsGroup>
                </Section>

                <Section title="Connections">
                  {current === "Connections" && (
                    <ConnectionsPanel
                      returnTo="settings"
                      onChange={own.retry}
                      onGithubChange={(github) =>
                        own.update((current) => ({
                          ...current,
                          profile: { ...current.profile, github },
                        }))
                      }
                    />
                  )}
                </Section>
              </>
            )}

            <Section title="Appearance">
              <SettingsGroup title="Theme" bare className="-mx-1">
                <ThemeSwitch />
              </SettingsGroup>
              <BrandingPicker />
              {active && (
                <SettingsGroup title="Navigation">
                  <NavigationEditor
                    userId={user.id}
                    items={user.navigation}
                    onSaved={auth.updateNavigationItems}
                  />
                </SettingsGroup>
              )}
            </Section>

            {active && (
              <>
                <Section title="Notifications">
                  <SettingsGroup
                    title="Push notifications"
                    description="Alerts on this device, even when ysocial is closed."
                  >
                    <div className="px-4 py-3">
                      <PushSettings />
                    </div>
                    <HidePreviewsRow userId={user.id} />
                  </SettingsGroup>
                  <NotificationPreferences userId={user.id} />
                </Section>

                <Section title="Privacy and safety">
                  <SettingsGroup>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setBlockedOpen(true)}
                      className={linkRowClass}
                    >
                      <LinkRowBody
                        title="Blocked accounts"
                        description="See and unblock people you blocked."
                      />
                    </button>
                    <Link to="/messages/devices" className={linkRowClass}>
                      <LinkRowBody
                        title="Chat devices"
                        description="Manage the devices that can read your messages."
                      />
                    </Link>
                  </SettingsGroup>
                </Section>
              </>
            )}

            {active && profile && (
              <EditProfileDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                tab={editTab}
                onTabChange={setEditTab}
                userId={user.id}
                profile={profile.profile}
                paint={
                  <PaintPicker
                    user={profile.profile}
                    onSaved={(paint) => {
                      own.update((current) => ({
                        ...current,
                        profile: { ...current.profile, paint },
                      }));
                      auth.updatePaint(user.id, paint);
                    }}
                  />
                }
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
            <BlockedAccountsDialog
              open={blockedOpen}
              onOpenChange={setBlockedOpen}
            />
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
        <div className="hidden items-center gap-2.5 border-t border-r bg-muted/40 p-3 sm:flex">
          <Avatar className="size-8">
            {avatarUrl && (
              <AvatarImage
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              @{user.handle}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Sign out"
                  aria-haspopup="dialog"
                  disabled={auth.busy}
                  onClick={() => setConfirmLogout(true)}
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              }
            >
              <LogOut className="size-4" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </SelectedSection.Provider>
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
      if (
        !current.authenticated ||
        current.needsOnboarding ||
        current.user.id !== userId
      )
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
    <div className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id="hide-previews-label" className="text-sm font-medium">
            Hide message content
          </p>
          <p
            id="hide-previews-description"
            className="mt-0.5 text-sm text-muted-foreground"
          >
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
  const { preference, automatic, setPreference } = useBranding();
  const options: {
    value: BrandingPreference;
    label: string;
    detail: string;
    variation: Variation | null;
  }[] = [
    {
      value: "auto",
      label: "Automatic",
      detail: automatic
        ? `Today: ${automatic.name}`
        : "Switches on special days",
      variation: automatic,
    },
    {
      value: "default",
      label: "Main logo",
      detail: "Always the regular one",
      variation: null,
    },
    ...variations.map((variation) => ({
      value: variation.id,
      label: variation.name,
      detail: variation.occasion,
      variation,
    })),
  ];
  return (
    <SettingsGroup
      bare
      title={<span id="branding-label">Logo and wordmark</span>}
      description="Saved on this device only."
    >
      <div
        role="radiogroup"
        aria-labelledby="branding-label"
        className="grid grid-cols-2 gap-2 md:grid-cols-3"
      >
        {options.map(({ value, label, detail, variation }) => {
          const selected = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference(value)}
              className={cn(
                "flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left outline-none transition-[border-color,box-shadow] hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50",
                selected &&
                  "border-primary ring-1 ring-primary hover:border-primary",
              )}
            >
              <span className="flex h-16 w-full items-center justify-center bg-muted/60 pt-2">
                <SiteWordmark rem={5.5} variation={variation} />
              </span>
              <span className="block w-full min-w-0 px-3 py-2.5">
                <span className="block truncate text-sm font-medium">
                  {label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </SettingsGroup>
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
            <ShieldAlert
              className="size-5 text-destructive"
              aria-hidden="true"
            />
            Delete your account?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, posts, replies, likes,
            follows, pictures and chat devices. It can&apos;t be undone, and
            your handle becomes available to others.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void remove();
          }}
        >
          <label
            htmlFor="confirm-delete-handle"
            className="text-sm font-medium"
          >
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
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => change(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || busy}
            >
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
