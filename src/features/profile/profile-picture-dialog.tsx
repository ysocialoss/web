import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, retryRequest, ApiError } from "@/lib/api";
import { updateAuthor } from "@/features/feed/optimistic-actions";
import { AvatarCropper } from "./avatar-cropper";
import { RecentAvatars } from "./recent-avatars";

export async function verifyAccount(userId: string, signal?: AbortSignal) {
  const current = await api.session(signal);
  if (!current.authenticated || current.needsOnboarding || current.user.id !== userId)
    throw new ApiError(403, "retry_account_changed");
}

export function ProfilePictureDialog({
  open,
  onOpenChange,
  userId,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onChanged: (avatarUrl: string) => void;
}) {
  function done(avatarUrl: string) {
    updateAuthor(userId, { avatarUrl });
    onChanged(avatarUrl);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                await verifyAccount(userId, signal);
                const result = await api.selectRecentAvatar(id, signal);
                done(result.avatarUrl);
              }}
            />
          }
          onSave={async (picture, signal) => {
            const result = await retryRequest(() => api.uploadAvatar(picture, signal), {
              context: "upload avatar",
              signal,
              beforeRetry: () => verifyAccount(userId, signal),
            });
            done(result.avatarUrl);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
