import type { AuthState } from "@/features/auth/use-auth";
import { AccountMenu } from "@/features/auth/account-menu";
import { Bell } from "lucide-react";
import { IconLink } from "@/components/ui/icon-button";
import { ProfileCard } from "@/components/account/profile-card";
import { TrendingTopics } from "@/components/account/trending-topics";

export function AccountSidebar({ auth }: { auth: AuthState }) {
  const { session } = auth;
  return (
    <aside
      aria-label="Account"
      className="min-h-0 min-w-0 overflow-hidden p-1 lg:p-3"
    >
      <div className="flex items-center justify-end gap-1 lg:gap-2">
        <IconLink
          to="/notifications"
          label="Notifications"
          className="size-7 lg:size-9"
        >
          <Bell />
        </IconLink>
        <AccountMenu auth={auth} />
      </div>
      <div className="mt-4 hidden lg:block">
        <ProfileCard session={session} loading={!session && !auth.error} />
        <TrendingTopics />
      </div>
    </aside>
  );
}
