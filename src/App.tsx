import { useEffect, useRef } from "react";
import {
  BrowserRouter,
  Link,
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import { ArrowLeft, Construction, SearchX } from "lucide-react";
import { NavigationSidebar } from "@/components/layout/navigation-sidebar";
import { AccountSidebar } from "@/components/layout/account-sidebar";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IconLink } from "@/components/ui/icon-button";
import { Feed } from "@/features/feed/feed";
import { Account } from "@/features/auth/account";
import { useAuth, type AuthState } from "@/features/auth/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { Thread } from "@/features/feed/thread";
import { ProfilePage } from "@/features/profile/profile";
import type { Session } from "@/lib/api";
import { useFeed } from "@/features/feed/use-feed";
import { ProfileSkeleton } from "@/components/loading-skeletons";
import { ConnectionBanner } from "@/components/connection-banner";
import { cn } from "@/lib/utils";

export function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delay={250}>
        <Toaster>
          <AppShell />
        </Toaster>
      </TooltipProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const auth = useAuth();
  const centerScroll = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const profileHandle = matchPath("/:profileHandle", pathname)?.params
    .profileHandle;
  const hideAccountSidebar =
    /^@[a-z0-9_]{3,32}$/.test(profileHandle ?? "") ||
    matchPath("/profile", pathname) !== null;
  useEffect(() => {
    centerScroll.current?.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <ConnectionBanner />
      <main
        className={cn(
          "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden divide-x divide-border",
          hideAccountSidebar
            ? "grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)]"
            : "grid-cols-[4rem_minmax(0,1fr)_4rem] lg:grid-cols-[13rem_minmax(0,1fr)_22rem]",
        )}
      >
        <NavigationSidebar />
        <section
          ref={centerScroll}
          aria-label="Main content"
          tabIndex={0}
          className="content-scroll min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain px-5 py-4 has-[[data-skeleton-scroll-lock]]:overflow-y-hidden sm:px-10 sm:py-6 lg:px-12"
        >
          <Account auth={auth} />
          <Routes>
            <Route path="/" element={<HomeFeed session={auth.session} />} />
            <Route
              path="/posts/:id"
              element={<PostRoute session={auth.session} />}
            />
            <Route
              path="/:profileHandle"
              element={
                <ProfileRoute
                  session={auth.session}
                  onAvatarSaved={auth.updateAvatar}
                  onBannerSaved={auth.updateBanner}
                />
              }
            />
            <Route path="/profile" element={<MyProfileRoute auth={auth} />} />
            <Route
              path="/onboarding"
              element={<OnboardingRoute session={auth.session} />}
            />
            <Route
              path="/login"
              element={<LoginRoute session={auth.session} />}
            />
            <Route path="/messages" element={<ComingSoon title="Messages" />} />
            <Route path="/search" element={<ComingSoon title="Search" />} />
            <Route
              path="/settings/feed"
              element={<ComingSoon title="Feed preferences" />}
            />
            <Route
              path="/communities"
              element={<ComingSoon title="Communities" />}
            />
            <Route
              path="/notifications"
              element={<ComingSoon title="Notifications" />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </section>
        {!hideAccountSidebar && <AccountSidebar auth={auth} />}
      </main>
    </div>
  );
}

function HomeFeed({ session }: { session: Session | null }) {
  usePageTitle("Feed");
  const feed = useFeed(session);
  return <Feed feed={feed} />;
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
  usePageTitle("Choose your handle");
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
function PostRoute({ session }: { session: Session | null }) {
  const { id = "" } = useParams();
  return <Thread key={id} id={id} session={session} />;
}
function ProfileRoute({
  session,
  onAvatarSaved,
  onBannerSaved,
}: {
  session: Session | null;
  onAvatarSaved: (userId: string, avatarUrl: string) => void;
  onBannerSaved: AuthState["updateBanner"];
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
    />
  );
}
function ComingSoon({ title }: { title: string }) {
  usePageTitle(title);
  return (
    <div className="mx-auto max-w-xl">
      <IconLink to="/" label="Back to feed">
        <ArrowLeft />
      </IconLink>
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Construction className="size-9 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          This part of ysocial is on its way.
        </p>
      </div>
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
