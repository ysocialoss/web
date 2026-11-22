import type { ComponentType } from "react";
import { AppleMusicMark, DiscordMark, SpotifyMark, SteamMark, TwitchMark } from "@/components/ui/brand-marks";

export type ConnectionProviderId = "discord" | "twitch" | "steam" | "spotify" | "apple_music";

export type ConnectionProviderInfo = {
  id: ConnectionProviderId;
  name: string;
  description: string;
  Mark: ComponentType<{ className?: string }>;
  color: string;
  kind: "sign-in" | "link";
  placeholder?: string;
};

export const connectionProviders: ConnectionProviderInfo[] = [
  {
    id: "discord",
    name: "Discord",
    description: "Add your Discord username to your public profile so friends can find you there.",
    Mark: DiscordMark,
    color: "text-[#5865F2]",
    kind: "sign-in",
  },
  {
    id: "twitch",
    name: "Twitch",
    description: "Link your Twitch channel to your public profile so people can find your streams.",
    Mark: TwitchMark,
    color: "text-[#9146FF]",
    kind: "sign-in",
  },
  {
    id: "steam",
    name: "Steam",
    description: "Show your Steam profile on your public profile. You sign in on Steam; we never see your password.",
    Mark: SteamMark,
    color: "text-black dark:text-white",
    kind: "sign-in",
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Paste the link to your Spotify profile to show it on your public profile.",
    Mark: SpotifyMark,
    color: "text-[#1DB954]",
    kind: "link",
    placeholder: "https://open.spotify.com/user/…",
  },
  {
    id: "apple_music",
    name: "Apple Music",
    description: "Paste the link to your Apple Music profile to show it on your public profile.",
    Mark: AppleMusicMark,
    color: "",
    kind: "link",
    placeholder: "https://music.apple.com/profile/…",
  },
];

export const providerById = (id: string) => connectionProviders.find((provider) => provider.id === id);
