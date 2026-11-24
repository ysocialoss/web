import { AccountSettingsContext } from "@/features/settings/account-settings-context";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  BrowserRouter,
  Link,
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
} from "react-router";
import { ArrowLeft, SearchX } from "lucide-react";
import { ComingSoonContent } from "@/components/coming-soon-content";
import { NavigationSidebar } from "@/components/layout/navigation-sidebar";
import { AccountSidebar } from "@/components/layout/account-sidebar";
import {
  MobileHeader,
  MobileNavigation,
} from "@/components/layout/mobile-navigation";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconLink } from "@/components/ui/icon-button";
import { Feed } from "@/features/feed/feed";
import { TrendingTopicsStrip } from "@/components/account/trending-topics";
import { Account, ApprovalBanner } from "@/features/auth/account";
import { useAuth, type AuthState } from "@/features/auth/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useSearchShortcut } from "@/features/search/use-search-shortcut";
import { isTopicName, normalizeTopic } from "@/lib/topics";
import type { Session } from "@/lib/api";
import { useFeed } from "@/features/feed/use-feed";
import { PostListSkeleton, ProfileSkeleton } from "@/components/loading-skeletons";
import { ConnectionBanner } from "@/components/connection-banner";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { StagingNotice } from "@/components/staging-notice";
import { cn } from "@/lib/utils";
import { recallScroll, rememberScroll } from "@/lib/scroll-memory";
import { useGoBack } from "@/hooks/use-go-back";
import { NotificationsProvider } from "@/features/notifications/notifications-context";
import { NamePaintsDisabledContext } from "@/features/profile/paint-visibility";
import { DmUnreadProvider } from "@/features/dms/dm-unread";
import { ActivityPage, NotificationsPage } from "@/features/notifications/notifications";
import {
  AccountSettingsModal,
  MessagesPage,
  ProfilePage,
  SearchPage,
  SavedPage,
  SettingsPage,
  Thread,
  TopicPage,
  preloadRoutesWhenIdle,
} from "@/routes";
import { AppUpdatePrompt } from "@/features/updates/app-update";

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delay={250}>
        <Toaster>
          <StagingNotice />
          <AppUpdatePrompt />
          <AppShell />
        </Toaster>
      </TooltipProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const auth = useAuth();
  const viewer = auth.session?.authenticated && !auth.session.needsOnboarding
    ? auth.session.user
    : null;
  const viewerId = viewer?.id ?? null;
  useSearchShortcut();
  const awaitingApproval = auth.session?.authenticated && !auth.session.needsOnboarding
    && auth.session.pendingApproval && !auth.session.ban;
  // State, not a ref: the section is recreated when the signed-in session
  // arrives, and the scroll listeners must follow the live element.
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [wordmarkReady, setWordmarkReady] = useState(false);
  const logoClickCount = useRef(0);
  const navigate = useNavigate();
  const { pathname, key: navigationKey } = useLocation();
  const [settingsRequest, setSettingsRequest] = useState<{
    navigationKey: string;
    trigger: HTMLButtonElement | null;
  } | null>(null);
  if (settingsRequest && settingsRequest.navigationKey !== navigationKey) {
    setSettingsRequest(null);
  }
  const settingsLink = matchPath("/settings/account", pathname) !== null;
  const settingsOpen = settingsLink || settingsRequest?.navigationKey === navigationKey;
  const profileHandle = matchPath("/:profileHandle", pathname)?.params
    .profileHandle;
  const messagesLayout = !!matchPath("/messages/*", pathname) &&
    (auth.session === null ? !auth.error :
      auth.session.authenticated && !auth.session.needsOnboarding && !auth.session.pendingApproval && !auth.session.ban);
  const threadView = messagesLayout && pathname.replace(/\/+$/, "") !== "/messages";
  const hideAccountSidebar =
    /^@[a-z0-9_]{3,32}$/.test(profileHandle ?? "") ||
    matchPath("/profile", pathname) !== null || messagesLayout;
  useEffect(() => {
    preloadRoutesWhenIdle();
  }, []);
  useEffect(() => {
    // Paint the base logo before enabling the tint on a direct Settings visit.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setWordmarkReady(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (pathname !== "/") logoClickCount.current = 0;
  }, [pathname]);

  function handleLogoClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      pathname !== "/" ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;

    logoClickCount.current += 1;
    if (logoClickCount.current === 3) {
      logoClickCount.current = 0;
      event.preventDefault();
      navigate("/asettings");
    } else if (
      logoClickCount.current === 2 &&
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches
    ) {
      event.currentTarget.animate(
        [0, -5, 5, -3, 3, 0].map((offset) => ({
          transform: `translateX(${offset}px)`,
        })),
        { duration: 360 },
      );
    }
  }
  const navigationType = useNavigationType();
  const activeKey = useRef(navigationKey);
  useEffect(() => {
    if (!scroller) return;
    const onScroll = () =>
      rememberScroll(activeKey.current, scroller.scrollTop);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [scroller]);
  useLayoutEffect(() => {
    if (!scroller) return;
    activeKey.current = navigationKey;
    const target =
      navigationType === "POP" ? recallScroll(navigationKey) : undefined;
    if (target === undefined) {
      scroller.scrollTo({
        top: 0,
        behavior:
          pathname === "/" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "smooth"
            : "instant",
      });
      return;
    }
    // Content may still be loading: keep retrying until it is tall enough,
    // and give up as soon as the user scrolls themselves.
    let frame = 0;
    let raf = 0;
    const attempt = () => {
      scroller.scrollTop = target;
      if (Math.abs(scroller.scrollTop - target) < 2 || ++frame > 120) return;
      raf = requestAnimationFrame(attempt);
    };
    const stop = () => cancelAnimationFrame(raf);
    attempt();
    scroller.addEventListener("wheel", stop, { once: true, passive: true });
    scroller.addEventListener("touchstart", stop, {
      once: true,
      passive: true,
    });
    return () => {
      stop();
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchstart", stop);
    };
  }, [scroller, pathname, navigationKey, navigationType]);
  return (
    <NotificationsProvider
      key={viewerId ?? "anonymous"}
      userId={viewerId}
      canWrite={
        !!auth.session?.authenticated && !auth.session.needsOnboarding && !auth.session.pendingApproval && !auth.session.ban
      }
      holdPrompt={auth.showApprovalWelcome}
    >
     <DmUnreadProvider
      userId={viewerId}
      enabled={
        !!auth.session?.authenticated && !auth.session.needsOnboarding && !auth.session.pendingApproval && !auth.session.ban
      }
     >
      <NamePaintsDisabledContext.Provider value={viewer?.namePaintsDisabled ?? false}>
      <AccountSettingsContext.Provider value={(trigger) => setSettingsRequest({ navigationKey, trigger })}>
      <DynamicFavicon />
      {settingsOpen && (
        <Suspense fallback={null}>
          <AccountSettingsModal
            auth={auth}
            returnFocus={settingsRequest?.trigger ?? null}
            onClose={() => {
              setSettingsRequest(null);
              if (settingsLink) void navigate("/", { replace: true });
            }}
          />
        </Suspense>
      )}
      <div
        className="relative flex h-dvh min-h-0 flex-col"
        data-settings-page={
          wordmarkReady && matchPath("/asettings", pathname) ? "" : undefined
        }
      >
        {!threadView && <MobileHeader auth={auth} onLogoClick={handleLogoClick} />}
        {awaitingApproval && <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0 md:hidden" />}
        <ConnectionBanner />
        {awaitingApproval && <ApprovalBanner />}
        <main
          className={cn(
            "grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden md:divide-x md:divide-border",
            hideAccountSidebar
              ? "md:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)]"
              : "md:grid-cols-[4rem_minmax(0,1fr)_4rem] lg:grid-cols-[13rem_minmax(0,1fr)_22rem]",
          )}
        >
          <NavigationSidebar
            showAccount={hideAccountSidebar}
            auth={auth}
            onLogoClick={handleLogoClick}
          />
          <section
            ref={setScroller}
            aria-label="Main content"
            tabIndex={0}
            className={cn(
              messagesLayout
                ? cn(
                    "flex min-h-0 min-w-0 flex-col overflow-hidden",
                    threadView
                      ? "max-md:pt-0 max-md:pb-0"
                      : "max-md:pt-[calc(4rem+env(safe-area-inset-top))] max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))]",
                  )
                : "content-scroll min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] has-[[data-skeleton-scroll-lock]]:overflow-y-hidden sm:px-10 sm:pt-6 md:pb-6 lg:px-12",
              !messagesLayout && (awaitingApproval ? "max-md:pt-3" : "max-md:pt-[calc(4.75rem+env(safe-area-inset-top))]"),
            )}
          >
            <Account auth={auth} />
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomeFeed session={auth.session} />} />
              <Route
                path="/posts/:id"
                element={<PostRoute session={auth.session} />}
              />
              <Route
                path="/topics/:topic"
                element={<TopicRoute session={auth.session} />}
              />
              <Route
                path="/:profileHandle"
                element={
                  <ProfileRoute
                    session={auth.session}
                    onAvatarSaved={auth.updateAvatar}
                    onBannerSaved={auth.updateBanner}
                    onProfileSaved={auth.updateProfile}
                    onPaintSaved={auth.updatePaint}
                  />
                }
              />
              <Route path="/profile" element={<MyProfileRoute auth={auth} />} />
              <Route path="/asettings" element={<SettingsPage auth={auth} />} />
              <Route
                path="/settings/account"
                element={<HomeFeed session={auth.session} />}
              />
              <Route
                path="/onboarding"
                element={<OnboardingRoute session={auth.session} />}
              />
              <Route
                path="/login"
                element={<LoginRoute session={auth.session} />}
              />
              <Route path="/messages/:conversationId?" element={<MessagesPage session={auth.session} sessionError={auth.error} />} />
              <Route path="/messages/devices" element={<MessagesPage session={auth.session} sessionError={auth.error} managingDevices />} />
              <Route
                path="/search"
                element={<SearchPage session={auth.session} />}
              />
              <Route
                path="/saved"
                element={<SavedPage session={auth.session} />}
              />
              <Route path="/report" element={<ComingSoon title="Report" />} />
              <Route
                path="/bug"
                element={<ComingSoon title="Report a bug" />}
              />
              <Route
                path="/legal/privacy"
                element={<ComingSoon title="Privacy" />}
              />
              <Route
                path="/legal/terms"
                element={<ComingSoon title="Terms" />}
              />
              <Route
                path="/legal/imprint"
                element={<ComingSoon title="Imprint" />}
              />
              <Route
                path="/settings/feed"
                element={<ComingSoon title="Feed preferences" />}
              />
              <Route
                path="/communities"
                element={<ComingSoon title="Communities" />}
              />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </section>
          {!hideAccountSidebar && <AccountSidebar auth={auth} />}
        </main>
        {!threadView && <MobileNavigation auth={auth} />}
      </div>
      </AccountSettingsContext.Provider>
      </NamePaintsDisabledContext.Provider>
     </DmUnreadProvider>
    </NotificationsProvider>
  );
}

function RouteFallback() {
  const { pathname } = useLocation();
  if (/^\/@/.test(pathname) || pathname === "/profile") return <ProfileSkeleton />;
  if (pathname.startsWith("/messages")) return null;
  if (pathname.startsWith("/settings") || pathname === "/asettings") return null;
  return <PostListSkeleton />;
}

function HomeFeed({ session }: { session: Session | null }) {
  usePageTitle("Feed");
  const feed = useFeed(session);
  const { key: navigationKey } = useLocation();
  return (
    <Feed
      feed={feed}
      refreshKey={navigationKey}
      header={<TrendingTopicsStrip />}
    />
  );
}
function MyProfileRoute({ auth }: { auth: AuthState }) {
  usePageTitle("Profile");
  const { session } = auth;
  return session?.authenticated && !session.needsOnboarding ? (
    <Navigate to={`/@${session.user.handle}`} replace />
  ) : (
    <div className="mx-auto max-w-xl text-sm text-muted-foreground">
      {session === null && !auth.error ? (
        <ProfileSkeleton />
      ) : (
        "Sign in and choose your handle to view your profile."
      )}
    </div>
  );
}
function OnboardingRoute({ session }: { session: Session | null }) {
  usePageTitle("Create your profile");
  return session?.authenticated && !session.needsOnboarding ? (
    <Navigate to={`/@${session.user.handle}`} replace />
  ) : null;
}
function LoginRoute({ session }: { session: Session | null }) {
  usePageTitle("Sign in");
  return session?.authenticated && !session.needsOnboarding ? (
    <Navigate to="/" replace />
  ) : null;
}
function TopicRoute({ session }: { session: Session | null }) {
  const { topic = "" } = useParams();
  const name = normalizeTopic(topic);
  return isTopicName(name) ? (
    <TopicPage key={name} topic={name} session={session} />
  ) : (
    <NotFound />
  );
}
function PostRoute({ session }: { session: Session | null }) {
  const { id = "" } = useParams();
  return <Thread key={id} id={id} session={session} />;
}
function ProfileRoute({
  session,
  onAvatarSaved,
  onBannerSaved,
  onProfileSaved,
  onPaintSaved,
}: {
  session: Session | null;
  onAvatarSaved: (userId: string, avatarUrl: string) => void;
  onBannerSaved: AuthState["updateBanner"];
  onProfileSaved: AuthState["updateProfile"];
  onPaintSaved: AuthState["updatePaint"];
}) {
  const { profileHandle = "" } = useParams();
  if (!/^@[a-z0-9_]{3,32}$/.test(profileHandle)) return <NotFound />;
  const handle = profileHandle.slice(1);
  return (
    <ProfilePage
      key={handle}
      handle={handle}
      session={session}
      onAvatarSaved={onAvatarSaved}
      onBannerSaved={onBannerSaved}
      onProfileSaved={onProfileSaved}
      onPaintSaved={onPaintSaved}
    />
  );
}
function ComingSoon({ title }: { title: string }) {
  usePageTitle(title);
  const goBack = useGoBack();
  return (
    <div className="mx-auto max-w-xl">
      <IconLink to="/" label="Back" onClick={goBack}>
        <ArrowLeft />
      </IconLink>
      <ComingSoonContent title={title} heading="h1" />
    </div>
  );
}
function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
      <SearchX className="size-9 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This address doesn't lead to a page.
      </p>
      <Link to="/" className="text-sm underline underline-offset-4">
        Return to feed
      </Link>
    </div>
  );
}
export default App;
