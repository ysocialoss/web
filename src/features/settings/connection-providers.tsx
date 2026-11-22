import type { ComponentType } from "react";
import { DiscordMark, TwitchMark } from "@/components/ui/brand-marks";

export type ConnectionProviderId = "discord" | "twitch";

export const connectionProviders: {
  id: ConnectionProviderId;
  name: string;
  description: string;
  Mark: ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    id: "discord",
    name: "Discord",
    description: "Add your Discord username to your public profile so friends can find you there.",
    Mark: DiscordMark,
    color: "text-[#5865F2]",
  },
  {
    id: "twitch",
    name: "Twitch",
    description: "Link your Twitch channel to your public profile so people can find your streams.",
    Mark: TwitchMark,
    color: "text-[#9146FF]",
  },
];

export const providerById = (id: string) => connectionProviders.find((provider) => provider.id === id);
