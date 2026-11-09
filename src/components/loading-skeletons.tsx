import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({
  label,
  children,
  className,
  lockScroll = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  lockScroll?: boolean;
}) {
  return (
    <div
      role="status"
      className={className}
      data-skeleton-scroll-lock={lockScroll || undefined}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function ComposerSkeleton() {
  return (
    <LoadingSkeleton
      label="Loading post composer…"
      className="mx-auto w-full max-w-xl"
      lockScroll
    >
      <div className="flex h-14 items-center justify-between gap-3 rounded-[1.75rem] bg-muted px-4 sm:px-5">
        <Skeleton className="h-4 w-40 max-w-[75%] bg-foreground/10" />
        <Skeleton className="size-4 shrink-0 rounded-full bg-foreground/10" />
      </div>
    </LoadingSkeleton>
  );
}

function PostPlaceholder({ short = false }: { short?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-5">
      <Skeleton className="size-9 shrink-0 rounded-[30%] [corner-shape:squircle]" />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
          <Skeleton className="h-3.5 w-24 max-w-[45%]" />
          <Skeleton className="h-3 w-16 max-w-[30%]" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="mt-2 space-y-2 py-1">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className={`h-3.5 ${short ? "w-3/5" : "w-11/12"}`} />
          {!short && <Skeleton className="h-3.5 w-2/3" />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4">
          {[0, 1, 2, 3].map((action) => (
            <div key={action} className="flex h-8 items-center gap-2 px-1.5">
              <Skeleton className="size-3.5 rounded-sm" />
              {action < 3 && <Skeleton className="h-3 w-3" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PostListSkeleton({
  count = 3,
  label = "Loading posts…",
  lockScroll = true,
}: {
  count?: number;
  label?: string;
  lockScroll?: boolean;
}) {
  return (
    <LoadingSkeleton label={label} lockScroll={lockScroll}>
      <div className="divide-y divide-border">
        {Array.from({ length: count }, (_, index) => (
          <PostPlaceholder key={index} short={index % 2 === 1} />
        ))}
      </div>
    </LoadingSkeleton>
  );
}

export function ProfileSkeleton() {
  return (
    <LoadingSkeleton label="Loading profile…" lockScroll>
      <div className="relative mb-12">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="absolute -bottom-8 left-4 size-16 rounded-[30%] ring-4 ring-background [corner-shape:squircle]" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 py-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
      <div className="mt-3 flex gap-4">
        {[0, 1].map((stat) => (
          <div key={stat} className="flex h-5 items-center gap-1.5">
            <Skeleton className="h-3.5 w-6" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2 py-1">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="my-4 flex h-4 items-center gap-2">
        <Skeleton className="size-3.5" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex gap-2 border-b pb-3">
        {[0, 1, 2].map((tab) => (
          <div
            key={tab}
            className="flex h-9 flex-1 items-center justify-center"
          >
            <Skeleton className="size-4" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-border">
        <PostPlaceholder />
        <PostPlaceholder short />
        <PostPlaceholder />
      </div>
    </LoadingSkeleton>
  );
}

export function ProfileCardSkeleton() {
  return (
    <LoadingSkeleton label="Loading account profile…">
      <div className="relative">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="absolute -bottom-5 right-2 size-14 rounded-[30%] ring-4 ring-background [corner-shape:squircle]" />
      </div>
      <div className="mt-7 space-y-2 py-1">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </LoadingSkeleton>
  );
}
