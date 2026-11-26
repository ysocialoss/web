import { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import { DisplayName } from "@/components/display-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BannerImage } from "@/features/profile/banner-image";
import { api, type Session } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BADGE_DAY, BannerFrame, ChristmasBadgeArt, FRAME_DAY, FRAME_SPACE, ProfileSnow } from "./cosmetics";

export type Viewer = Extract<Session, { authenticated: true; needsOnboarding: false }>["user"];

type OtherBadges = { badges: { id: string; icon: string; tooltip: string }[]; isOg: boolean };

function PreviewBanner({ viewer, className }: { viewer: Viewer; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-linear-to-br from-sky-200/70 via-emerald-100/60 to-rose-100/60 dark:from-sky-900/50 dark:via-emerald-900/35 dark:to-rose-900/35",
        className,
      )}
    >
      {viewer.bannerUrl && <BannerImage src={viewer.bannerUrl} crop={viewer.bannerCrop} alt="" />}
    </div>
  );
}

function BadgePreview({ viewer }: { viewer: Viewer }) {
  const [others, setOthers] = useState<OtherBadges | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api
      .profile(viewer.handle, controller.signal)
      .then((result) => setOthers({ badges: result.profile.badges, isOg: result.profile.isOg }))
      .catch(() => {});
    return () => controller.abort();
  }, [viewer.handle]);
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 sm:h-64">
      <PreviewBanner viewer={viewer} className="absolute inset-x-0 top-0 h-[28%] opacity-75" />
      <div aria-hidden="true" className="absolute inset-x-0 top-[28%] h-12 bg-linear-to-b from-card/0 to-card" />
      <div className="absolute inset-0 [mask-image:linear-gradient(to_right,transparent,black_24%,black_76%,transparent)]">
        <div className="absolute top-[60%] left-1/2 w-[560px] origin-center -translate-x-1/2 -translate-y-1/2 scale-[2.3] sm:scale-[3]">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="min-w-0 truncate text-base font-semibold">
                <DisplayName user={viewer} />
              </span>
              {others?.isOg && <Gem className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
              {others?.badges.map((badge) => (
                <span
                  key={badge.id}
                  aria-hidden="true"
                  className="block size-4 shrink-0 bg-current mask-contain mask-center mask-no-repeat"
                  style={{ maskImage: `url("/api/profiles/badge-icons/${badge.icon}")` }}
                />
              ))}
            </div>
            <div className="relative grid size-9 shrink-0 place-items-center">
              <span
                aria-hidden="true"
                className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgb(246_205_110/0.5),transparent_66%)]"
              />
              <ChristmasBadgeArt className="relative size-8" />
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FramePreview({ viewer }: { viewer: Viewer }) {
  return (
    <div className="w-full" style={{ paddingInline: FRAME_SPACE.side, paddingTop: FRAME_SPACE.top }}>
      <div className="relative aspect-3/1 w-full rounded-xl">
        <PreviewBanner viewer={viewer} className="absolute inset-0 rounded-xl" />
        <BannerFrame />
      </div>
    </div>
  );
}

function SnowPreview({ viewer }: { viewer: Viewer }) {
  const name = viewer.displayName.trim() || viewer.handle;
  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-card text-left ring-1 ring-foreground/10">
      <PreviewBanner viewer={viewer} className="aspect-3/1" />
      <div className="relative flex items-end gap-3 px-4 pb-4">
        <Avatar userId={viewer.id} className="-mt-8 size-16 shrink-0 ring-4 ring-card">
          {viewer.avatarUrl && <AvatarImage src={viewer.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="text-lg">{name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 pt-2">
          <p className="truncate text-lg font-semibold">
            <DisplayName user={viewer} />
          </p>
          <p className="truncate text-sm text-muted-foreground">@{viewer.handle}</p>
        </div>
      </div>
      <ProfileSnow className="[mask-image:linear-gradient(to_bottom,black_70%,transparent)]" />
    </div>
  );
}

export function RewardPreview({ day, viewer }: { day: number; viewer: Viewer }) {
  if (day === BADGE_DAY) return <BadgePreview viewer={viewer} />;
  if (day === FRAME_DAY) return <FramePreview viewer={viewer} />;
  return <SnowPreview viewer={viewer} />;
}
