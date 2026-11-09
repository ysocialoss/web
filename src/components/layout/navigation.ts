import { House, Mail, Search, SlidersHorizontal, Users } from "lucide-react";

export const navigation = [
  { label: "Feed", icon: House, to: "/" },
  { label: "DMs", icon: Mail, to: "/messages", disabled: true },
  { label: "Search", icon: Search, to: "/search" },
  { label: "Tweak feed", icon: SlidersHorizontal, to: "/settings/feed" },
  { label: "Communities", icon: Users, to: "/communities", disabled: true },
];
