import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { LoadingSkeleton } from "@/components/loading-skeletons";
import { IconLink } from "@/components/ui/icon-button";
import { Skeleton, SkeletonDelay } from "@/components/ui/skeleton";

export function MessagesLayout({ showThread, sidebar, children }: {
  showThread: boolean;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 min-w-0 [&_[data-slot=skeleton]]:animate-none">
      <aside aria-label="Conversations" className={`w-full shrink-0 flex-col border-border md:flex md:w-72 md:border-r xl:w-80 ${showThread ? "hidden" : "flex"}`}>
        {sidebar}
      </aside>
      {children}
    </div>
  );
}

export function MessagesSkeleton({ showThread }: { showThread: boolean }) {
  return (
    <MessagesLayout showThread={showThread} sidebar={(
      <>
        <header className="space-y-3 border-b border-border px-4 pt-4 pb-3">
          <h1 className="flex h-9 items-center text-base font-semibold pointer-coarse:h-10">Messages</h1>
          <div aria-hidden="true" className="-mx-2 -my-1 flex h-7 items-center gap-1.5">
            <SkeletonDelay>
              <Skeleton className="h-7 w-10 rounded-full" />
              <Skeleton className="h-7 w-[4.75rem] rounded-full" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </SkeletonDelay>
          </div>
        </header>
        <div className="overflow-hidden p-2"><ConversationListSkeleton /></div>
      </>
    )}>
      {showThread && <ThreadSkeleton />}
    </MessagesLayout>
  );
}

export function ConversationListSkeleton() {
  return (
    <LoadingSkeleton label="Loading conversations…">
      <div className="space-y-0.5">
        {["w-24", "w-32", "w-20", "w-28", "w-26"].map((width) => (
          <div key={width} className="flex items-center gap-3 px-2.5 py-2 pr-3">
            <Skeleton className="size-10 shrink-0 rounded-[30%] [corner-shape:squircle]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className={`h-3.5 max-w-full ${width}`} />
              <Skeleton className="h-3 w-16 max-w-full" />
            </div>
            <Skeleton className="h-2.5 w-7 shrink-0 self-start" />
          </div>
        ))}
      </div>
    </LoadingSkeleton>
  );
}

export function EarlierMessagesSkeleton() {
  return (
    <div aria-hidden="true" data-older-placeholder className="space-y-3 px-2 py-1">
      {[["w-16", "w-48"], ["w-24", "w-36"]].map(([name, line]) => (
        <div key={name} className="flex h-10 items-center gap-2.5">
          <Skeleton immediate className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2">
            <Skeleton immediate className={`h-2.5 max-w-full ${name}`} />
            <Skeleton immediate className={`h-3 max-w-full ${line}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <section aria-label="Conversation" className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 md:pt-2">
        <Link to="/messages" aria-label="Back to conversations" className="grid size-10 shrink-0 place-items-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:hidden">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <div aria-hidden="true" className="flex h-10 items-center gap-2.5 px-1">
          <SkeletonDelay>
            <Skeleton className="size-8 shrink-0 rounded-[30%] [corner-shape:squircle]" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </SkeletonDelay>
        </div>
      </header>
      <LoadingSkeleton label="Loading messages…" className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2 px-1 pb-3">
          <Skeleton className="h-9 w-40 max-w-[70%] rounded-2xl" />
          <Skeleton className="h-9 w-52 max-w-[70%] self-end rounded-2xl" />
          <Skeleton className="h-12 w-60 max-w-[70%] rounded-2xl" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </LoadingSkeleton>
    </section>
  );
}

export function ChatDevicesSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&_[data-slot=skeleton]]:animate-none">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 md:pt-2">
        <IconLink label="Back to messages" to="/messages" className="size-10">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </IconLink>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">Chat devices</h1>
          <p className="truncate text-xs text-muted-foreground">Browsers that can read your messages</p>
        </div>
      </header>
      <LoadingSkeleton label="Loading chat devices…" className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="mt-6 h-16 w-full rounded-xl" />
        </div>
      </LoadingSkeleton>
    </div>
  );
}
