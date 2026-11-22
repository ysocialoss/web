import { Heart, House, Mail, Search, Users } from "lucide-react";

export const navigation = [
  { label: "Feed", icon: House, to: "/" },
  { label: "Search", icon: Search, to: "/search" },
  { label: "Messages", icon: Mail, to: "/messages" },
  { label: "Activity", icon: Heart, to: "/activity", auth: true },
  { label: "Communities", icon: Users, to: "/communities", disabled: true },
];
