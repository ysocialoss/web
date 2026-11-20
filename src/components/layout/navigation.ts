import { House, Mail, Search, Users } from "lucide-react";

export const navigation = [
  { label: "Feed", icon: House, to: "/" },
  { label: "Search", icon: Search, to: "/search" },
  { label: "Messages", icon: Mail, to: "/messages" },
  { label: "Communities", icon: Users, to: "/communities", disabled: true },
];
