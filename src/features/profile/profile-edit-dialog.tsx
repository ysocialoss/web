import type { ComponentProps, ReactNode } from "react";
import { Link2, UserRound } from "lucide-react";
import { GithubSettings } from "@/features/settings/github-settings";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type ProfileEditTab = "profile" | "connections";

export function ProfileEditDialogContent({
  children,
  saving,
  tab,
  onTabChange,
  onGithubChange,
}: {
  children: ReactNode;
  saving: boolean;
  tab?: ProfileEditTab;
  onTabChange?: (tab: ProfileEditTab) => void;
  onGithubChange?: ComponentProps<typeof GithubSettings>["onGithubChange"];
}) {
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
        value={tab}
        onValueChange={(value) => {
          if (value === "profile" || value === "connections") onTabChange?.(value);
        }}
      >
        <TabsList aria-label="Edit profile sections" className="w-full">
          <TabsTrigger value="profile" disabled={saving}>
            <UserRound aria-hidden="true" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="connections" disabled={saving}>
            <Link2 aria-hidden="true" />
            Connections
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile" keepMounted className="inert:hidden">
          {children}
        </TabsContent>
        <TabsContent value="connections" className="inert:hidden">
          <GithubSettings returnTo="profile" onGithubChange={onGithubChange} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
