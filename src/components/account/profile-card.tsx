import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Camera, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  retryRequest,
  type Session,
} from "@/lib/api";
import { ProfileCardSkeleton } from "@/components/loading-skeletons";
import { BannerImage } from "@/features/profile/banner-image";
import { BannerEditor } from "@/features/profile/banner-editor";
import { AvatarCropper } from "@/features/profile/avatar-cropper";
import { RecentAvatars } from "@/features/profile/recent-avatars";
import { ProfileForm } from "@/features/profile/profile-form";
import { ProfileEditDialogContent } from "@/features/profile/profile-edit-dialog";
import { updateAuthor } from "@/features/feed/optimistic-actions";
import type { AuthState } from "@/features/auth/use-auth";

type ProfileFields = Awaited<ReturnType<typeof api.updateProfile>>;

// Same account checks the profile page runs before changing anything, so a
// retry never lands on a different account than the one that started it.
async function verifyAccount(userId: string, signal?: AbortSignal) {
  const current = await api.session(signal);
  if (
    !current.authenticated ||
    current.needsOnboarding ||
    current.user.id !== userId
  )
    throw new ApiError(403, "retry_account_changed");
}

export function ProfileCard({
  session,
  auth,
  loading = false,
}: {
  session: Session | null;
  /** When given, the signed-in user can edit banner, picture and profile here. */
  auth?: AuthState;
  loading?: boolean;
}) {
  const [pictureOpen, setPictureOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ProfileFields | null>(null);
  const [loadError, setLoadError] = useState("");
  const user =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const handle = user?.handle;
  useEffect(() => {
    if (!editOpen || !handle) return;
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadError("");
    api
      .profile(handle, controller.signal)
      .then((result) => setFields(result.profile))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      });
    return () => controller.abort();
  }, [editOpen, handle]);
  if (loading) return <ProfileCardSkeleton />;
  const avatarUrl = session?.authenticated ? session.avatarUrl : null;
  const initials = user
    ? (user.displayName.trim() || user.handle).slice(0, 2)
    : null;
  const editable =
    !!user && !!auth && session?.authenticated && !session.needsOnboarding && !session.pendingApproval && !session.ban;
  return (
    <section aria-labelledby="profile-heading">
      <div className="relative aspect-[3/1] rounded-xl bg-linear-to-br from-muted to-muted/40">
        {user?.bannerUrl && (
          <BannerImage
            src={user.bannerUrl}
            crop={user.bannerCrop}
            alt={`${user.displayName}'s banner`}
          />
        )}
        {editable && (
          <BannerEditor
            bannerUrl={user.bannerUrl}
            verifyAccount={(signal) => verifyAccount(user.id, signal)}
            onSaved={(bannerUrl, bannerCrop) =>
              auth.updateBanner(user.id, bannerUrl, bannerCrop)
            }
          />
        )}
        {editable ? (
          <Dialog open={pictureOpen} onOpenChange={setPictureOpen}>
            <DialogTrigger
              aria-label="Change profile picture"
              className="group absolute -bottom-5 right-2 z-10 size-14 cursor-pointer rounded-[30%] ring-4 ring-background outline-none [corner-shape:squircle] focus-visible:ring-ring"
            >
              <Avatar className="size-full">
                {avatarUrl && (
                  <AvatarImage
                    src={avatarUrl}
                    alt={`${user.displayName}'s avatar`}
                    referrerPolicy="no-referrer"
                  />
                )}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/60 text-white opacity-0 transition-opacity [corner-shape:inherit] group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="size-5" aria-hidden="true" />
                </span>
              </Avatar>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Change profile picture</DialogTitle>
                <DialogDescription className="sr-only">
                  Choose a picture, then drag and zoom to adjust the crop.
                </DialogDescription>
              </DialogHeader>
              <AvatarCropper
                emptyFooter={
                  <RecentAvatars
                    onSelect={async (id, signal) => {
                      await verifyAccount(user.id, signal);
                      const result = await api.selectRecentAvatar(id, signal);
                      updateAuthor(user.id, { avatarUrl: result.avatarUrl });
                      auth.updateAvatar(user.id, result.avatarUrl);
                      setPictureOpen(false);
                    }}
                  />
                }
                onSave={async (picture, signal) => {
                  const result = await retryRequest(
                    () => api.uploadAvatar(picture, signal),
                    {
                      context: "upload avatar",
                      signal,
                      beforeRetry: () => verifyAccount(user.id, signal),
                    },
                  );
                  updateAuthor(user.id, { avatarUrl: result.avatarUrl });
                  auth.updateAvatar(user.id, result.avatarUrl);
                  setPictureOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Avatar className="absolute -bottom-5 right-2 size-14 ring-4 ring-background">
            {avatarUrl && (
              <AvatarImage
                src={avatarUrl}
                alt="Your avatar"
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="text-lg">
              {initials || <UserRound className="size-7" />}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="mt-7">
        {user ? (
          editable ? (
            <Dialog
              open={editOpen}
              onOpenChange={(open) => {
                if (!saving) setEditOpen(open);
              }}
            >
              <DialogTrigger
                aria-label="Edit profile"
                className="block max-w-full cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  id="profile-heading"
                  className="block truncate text-sm font-semibold hover:underline"
                >
                  {user.displayName}
                </span>
                <span className="block truncate text-xs text-muted-foreground hover:underline">
                  @{user.handle}
                </span>
              </DialogTrigger>
              <ProfileEditDialogContent saving={saving}>
                {loadError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {loadError}
                  </p>
                ) : fields ? (
                  <ProfileForm
                    appearance="dialog"
                    userId={user.id}
                    profile={fields}
                    onSavingChange={setSaving}
                    onCancel={() => setEditOpen(false)}
                    onSaved={(updated) => {
                      setFields(updated);
                      auth.updateProfile(user.id, updated);
                      setEditOpen(false);
                    }}
                  />
                ) : (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading your profile…
                  </p>
                )}
              </ProfileEditDialogContent>
            </Dialog>
          ) : (
            <>
              <h2 id="profile-heading" className="text-sm font-semibold">
                {user.displayName}
              </h2>
              <Link
                className="text-xs text-muted-foreground"
                to={`/@${user.handle}`}
              >
                @{user.handle}
              </Link>
            </>
          )
        ) : (
          <>
            <h2 id="profile-heading" className="text-sm font-semibold">
              Welcome to ysocial
            </h2>
            <a className="text-sm underline" href="/auth/login">
              Sign in with CNS
            </a>
          </>
        )}
      </div>
    </section>
  );
}
