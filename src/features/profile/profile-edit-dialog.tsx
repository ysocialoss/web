import { useContext, useState, type ComponentProps, type ReactNode } from "react";
import { Link2, Paintbrush, UserRound } from "lucide-react";
import { GithubSettings } from "@/features/settings/github-settings";
import { ConnectionsPanel } from "@/features/settings/connections-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { api, Profile } from "@/lib/api";
import { NamePaintsDisabledContext } from "./paint-visibility";
import { ProfileForm } from "./profile-form";

export type ProfileEditTab = "profile" | "paint" | "connections";

export function ProfileEditDialogContent({
  children,
  paint,
  saving,
  tab,
  onTabChange,
  onGithubChange,
}: {
  children: ReactNode;
  /** Content of the Paint tab; the tab is shown only when given. */
  paint?: ReactNode;
  saving: boolean;
  tab?: ProfileEditTab;
  onTabChange?: (tab: ProfileEditTab) => void;
  onGithubChange?: ComponentProps<typeof GithubSettings>["onGithubChange"];
}) {
  const paintsDisabled = useContext(NamePaintsDisabledContext);

  return (
    <DialogContent
      className="max-h-[90dvh] gap-5 overflow-y-auto overscroll-contain px-5 pt-6 pb-5 sm:max-w-lg sm:px-6"
      showCloseButton={!saving}
    >
      <DialogHeader className="pr-10">
        <DialogTitle className="text-lg font-semibold">
          Edit profile
        </DialogTitle>
      </DialogHeader>
      <Tabs
        className="min-w-0 gap-5"
        defaultValue="profile"
        value={paintsDisabled && tab === "paint" ? "profile" : tab}
        onValueChange={(value) => {
          if (value === "profile" || value === "connections" || (value === "paint" && !paintsDisabled))
            onTabChange?.(value);
        }}
      >
        <TabsList aria-label="Edit profile sections" className="w-full">
          <TabsTrigger value="profile" disabled={saving}>
            <UserRound aria-hidden="true" />
            Profile
          </TabsTrigger>
          {paint && (
            <TabsTrigger value="paint" disabled={saving || paintsDisabled}>
              <Paintbrush aria-hidden="true" />
              Paint
            </TabsTrigger>
          )}
          <TabsTrigger value="connections" disabled={saving}>
            <Link2 aria-hidden="true" />
            Connections
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile" keepMounted className="inert:hidden">
          {children}
        </TabsContent>
        {paint && !paintsDisabled && (
          <TabsContent value="paint" className="inert:hidden">
            {paint}
          </TabsContent>
        )}
        <TabsContent value="connections" className="inert:hidden">
          <ConnectionsPanel returnTo="profile" onGithubChange={onGithubChange} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

type ProfileFields = Pick<
  Profile["profile"],
  "handle" | "displayName" | "bio" | "pronouns"
>;

export function EditProfileDialog({
  open,
  onOpenChange,
  tab,
  onTabChange,
  userId,
  profile,
  onSaved,
  onGithubChange,
  paint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: ProfileEditTab;
  onTabChange: (tab: ProfileEditTab) => void;
  userId: string;
  profile: ProfileFields;
  onSaved: (updated: Awaited<ReturnType<typeof api.updateProfile>>) => void;
  onGithubChange?: ComponentProps<typeof GithubSettings>["onGithubChange"];
  paint?: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <ProfileEditDialogContent
        saving={saving}
        tab={tab}
        onTabChange={onTabChange}
        onGithubChange={onGithubChange}
        paint={paint}
      >
        {open && (
          <ProfileForm
            appearance="dialog"
            userId={userId}
            profile={profile}
            onSavingChange={setSaving}
            onCancel={() => onOpenChange(false)}
            onSaved={(updated) => {
              onSaved(updated);
              onOpenChange(false);
            }}
          />
        )}
      </ProfileEditDialogContent>
    </Dialog>
  );
}
