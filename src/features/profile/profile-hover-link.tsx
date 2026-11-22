import type { ComponentProps } from "react";
import { Link } from "react-router";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { preloadRoute } from "@/routes";
import { loadProfileCard } from "./profile-card-cache";
import { UserHoverCard } from "./user-hover-card";

export function ProfileHoverLink({
  handle,
  onClick,
  onPointerEnter,
  onFocus,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { handle: string }) {
  const warm = () => {
    void loadProfileCard(handle).catch(() => {});
    preloadRoute(`/@${handle}`);
  };
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={350}
        closeDelay={180}
        render={
          <Link
            {...props}
            to={`/@${handle}`}
            onClick={(event) => {
              event.stopPropagation();
              onClick?.(event);
            }}
            onPointerEnter={(event) => {
              warm();
              onPointerEnter?.(event);
            }}
            onFocus={(event) => {
              warm();
              onFocus?.(event);
            }}
          />
        }
      />
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl bg-popover/95 p-0 shadow-xl ring-1 ring-foreground/10 backdrop-blur-xl"
      >
        <UserHoverCard handle={handle} />
      </HoverCardContent>
    </HoverCard>
  );
}
