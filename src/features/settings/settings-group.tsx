import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GroupHeading({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="px-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export function SettingsGroup({
  title,
  description,
  bare = false,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  bare?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      {title && <GroupHeading title={title} description={description} />}
      <div
        className={cn(
          !bare &&
            "divide-y overflow-hidden rounded-lg border bg-card text-card-foreground",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
