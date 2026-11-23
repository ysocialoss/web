import type { ComponentProps } from "react";
import { matchPath } from "react-router";
import { lazyRoute } from "@/lib/lazy-route";

export const ProfilePage = lazyRoute<
  ComponentProps<typeof import("@/features/profile/profile").ProfilePage>
>(() => import("@/features/profile/profile").then((m) => ({ default: m.ProfilePage })));

export const Thread = lazyRoute<
  ComponentProps<typeof import("@/features/feed/thread").Thread>
>(() => import("@/features/feed/thread").then((m) => ({ default: m.Thread })));

export const TopicPage = lazyRoute<
  ComponentProps<typeof import("@/features/topics/topic-page").TopicPage>
>(() => import("@/features/topics/topic-page").then((m) => ({ default: m.TopicPage })));

export const SearchPage = lazyRoute<
  ComponentProps<typeof import("@/features/search/search-page").SearchPage>
>(() => import("@/features/search/search-page").then((m) => ({ default: m.SearchPage })));

export const SavedPage = lazyRoute<
  ComponentProps<typeof import("@/features/feed/saved-page").SavedPage>
>(() => import("@/features/feed/saved-page").then((m) => ({ default: m.SavedPage })));

export const SettingsPage = lazyRoute<
  ComponentProps<typeof import("@/features/settings/settings").SettingsPage>
>(() => import("@/features/settings/settings").then((m) => ({ default: m.SettingsPage })));

export const AccountSettingsModal = lazyRoute<
  ComponentProps<typeof import("@/features/settings/account-settings").AccountSettingsModal>
>(() =>
  import("@/features/settings/account-settings").then((m) => ({
    default: m.AccountSettingsModal,
  })),
);

export const MessagesPage = lazyRoute<
  ComponentProps<typeof import("@/features/dms/messages-page").MessagesPage>
>(() => import("@/features/dms/messages-page").then((m) => ({ default: m.MessagesPage })));

const pages: { pattern: string; page: { preload: () => Promise<unknown> } }[] = [
  { pattern: "/messages/*", page: MessagesPage },
  { pattern: "/search", page: SearchPage },
  { pattern: "/saved", page: SavedPage },
  { pattern: "/posts/:id", page: Thread },
  { pattern: "/topics/:topic", page: TopicPage },
  { pattern: "/settings/account", page: AccountSettingsModal },
  { pattern: "/asettings", page: SettingsPage },
  { pattern: "/profile", page: ProfilePage },
  { pattern: "/:handle", page: ProfilePage },
];

export function preloadRoute(path: string) {
  const pathname = path.split(/[?#]/)[0];
  for (const { pattern, page } of pages) {
    if (matchPath(pattern, pathname)) {
      void page.preload();
      return;
    }
  }
}

let warmed = false;

export function preloadRoutesWhenIdle() {
  if (warmed) return;
  warmed = true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const run = () => {
    for (const { page } of pages) void page.preload();
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle.call(window, run, { timeout: 6000 });
  else window.setTimeout(run, 3000);
}
