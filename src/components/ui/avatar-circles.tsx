import { ProfileHoverLink } from "@/features/profile/profile-hover-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AvatarCircle = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
};

/**
 * Overlapping avatars with a "+N" bubble for the rest, after Magic UI's
 * AvatarCircles. Each avatar links to its profile.
 */
export function AvatarCircles({
  people,
  extra = 0,
  size = "md",
  className,
}: {
  people: AvatarCircle[];
  /** How many more people there are beyond the ones shown. */
  extra?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex rtl:space-x-reverse",
        size === "sm" ? "-space-x-1.5" : "-space-x-2",
        className,
      )}
    >
      {people.map((person) => (
        <ProfileHoverLink
          key={person.id}
          handle={person.handle}
          title={person.displayName}
          aria-label={`${person.displayName}, @${person.handle}`}
          className="rounded-full outline-none transition-transform duration-200 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar
            userId={person.id}
            className={cn(
              size === "sm" ? "size-4" : "size-6",
              "rounded-full ring-2 ring-background after:rounded-full [corner-shape:round]",
            )}
          >
            {person.avatarUrl && (
              <AvatarImage
                src={person.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback
              className={size === "sm" ? "text-[0.45rem]" : "text-[0.6rem]"}
            >
              {person.displayName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </ProfileHoverLink>
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "relative flex items-center justify-center rounded-full bg-foreground font-medium text-background ring-2 ring-background",
            size === "sm" ? "size-4 text-[0.5rem]" : "size-6 text-[0.6rem]",
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
