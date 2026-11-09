import { House, Mail, Search, SlidersHorizontal, Users } from "lucide-react";

const navigation = [
  { label: "Feed", icon: House },
  { label: "DMs", icon: Mail },
  { label: "Search", icon: Search },
  { label: "Tweak feed", icon: SlidersHorizontal },
  { label: "Communities", icon: Users },
] satisfies {
  label: "Feed" | "DMs" | "Search" | "Tweak feed" | "Communities";
  icon: typeof House;
}[];

export type Page =
  (typeof navigation)[number]["label"] | "Notifications" | "Profile";
export { navigation };
