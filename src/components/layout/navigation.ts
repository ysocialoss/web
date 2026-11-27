import {
  Bookmark,
  Heart,
  House,
  Mail,
  Search,
  UserRound,
  UserRoundGroup,
  Users,
  type LucideIcon,
} from "lucide-react";
import { navigationItemSchema, type NavigationItem } from "@/lib/navigation-items";

type NavigationEntry = {
  label: string;
  icon: LucideIcon;
  to: string;
  auth?: boolean;
  disabled?: boolean;
};

export const navigation: Record<NavigationItem, NavigationEntry> = {
  feed: { label: "Feed", icon: House, to: "/" },
  following: { label: "Following", icon: UserRoundGroup, to: "/following", auth: true },
  search: { label: "Search", icon: Search, to: "/search" },
  messages: { label: "Messages", icon: Mail, to: "/messages" },
  activity: { label: "Activity", icon: Heart, to: "/activity", auth: true },
  communities: {
    label: "Communities",
    icon: Users,
    to: "/communities",
    disabled: true,
  },
  profile: { label: "Profile", icon: UserRound, to: "/profile" },
  saved: { label: "Saved posts", icon: Bookmark, to: "/saved", auth: true },
};

export const defaultNavigation: readonly NavigationItem[] = [
  "feed",
  "following",
  "search",
  "messages",
  "activity",
  "profile",
];

export function hiddenNavigation(visible: readonly NavigationItem[], signedIn: boolean) {
  return navigationItemSchema.options.filter((id) =>
    !visible.includes(id) && (signedIn || !navigation[id].auth),
  );
}
