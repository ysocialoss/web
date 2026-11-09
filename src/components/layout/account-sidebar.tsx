import { Bell, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/account/profile-card";
import { TrendingTopics } from "@/components/account/trending-topics";
import type { Page } from "./navigation";

export function AccountSidebar({
  onNavigate: setActivePage,
}: {
  onNavigate: (page: Page) => void;
}) {
  return (
    <aside aria-label="Account" className="min-w-0 p-1 lg:p-3">
      <div className="flex items-center justify-end gap-1 lg:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 lg:size-9"
          aria-label="Notifications"
          onClick={() => setActivePage("Notifications")}
        >
          <Bell />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 lg:size-9"
          aria-label="Profile"
          onClick={() => setActivePage("Profile")}
        >
          <UserRound />
        </Button>
      </div>
      <div className="mt-4 hidden lg:block">
        <ProfileCard />
        <TrendingTopics />
      </div>
    </aside>
  );
}
