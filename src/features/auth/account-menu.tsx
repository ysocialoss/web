import { useState, type ComponentProps } from "react";
import { Link } from "react-router";
import {
  LogIn,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  UserPen,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";
import { DisplayName } from "@/components/display-name";
import { cn } from "@/lib/utils";
import type { AuthState } from "./use-auth";

const rowClass =
  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 max-md:h-12 max-md:text-base [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

function MenuRow({
  icon: Icon,
  children,
  destructive,
  ...props
}: { icon: LucideIcon; destructive?: boolean } & (
  | ({ to: string } & Omit<ComponentProps<typeof Link>, "to">)
  | ({ to?: undefined } & ComponentProps<"button">)
)) {
  const className = cn(
    rowClass,
    destructive &&
      "text-destructive hover:bg-destructive/10 [&_svg]:text-destructive",
  );
  const content = (
    <>
      <Icon aria-hidden="true" />
      {children}
    </>
  );
  if (props.to !== undefined) {
    const { to, ...rest } = props;
    return (
      <Link to={to} className={className} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} {...props}>
      {content}
    </button>
  );
}

const themeOptions = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="px-1">
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-10 max-md:text-sm",
              theme === value &&
                "bg-background text-foreground shadow-sm ring-1 ring-foreground/10",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AccountAvatar({
  src,
  initials,
  className,
}: {
  src: string | null;
  initials: string | null;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className="text-xs">
        {initials || <UserRound className="size-4" />}
      </AvatarFallback>
    </Avatar>
  );
}

export function AccountMenu({ auth }: { auth: AuthState }) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { session } = auth;
  const user =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const avatarUrl = session?.authenticated ? session.avatarUrl : null;
  const initials = user
    ? (user.displayName.trim() || user.handle).slice(0, 2)
    : null;
  const close = () => setOpen(false);
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-[30%] [corner-shape:squircle] md:size-9"
              aria-label="Account menu"
              title="Account menu"
              disabled={auth.busy || (!session && !auth.error)}
            >
              {!session && !auth.error ? (
                <Skeleton
                  className="size-full rounded-[30%] [corner-shape:squircle]"
                  aria-hidden="true"
                />
              ) : (
                <AccountAvatar
                  src={avatarUrl}
                  initials={initials}
                  className="size-full"
                />
              )}
            </Button>
          }
        />
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 gap-1 p-2"
          aria-label="Account"
        >
          <PopoverTitle className="sr-only">Account</PopoverTitle>
          {user ? (
            <Link
              to={`/@${user.handle}`}
              onClick={close}
              className="flex items-center gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <AccountAvatar
                src={avatarUrl}
                initials={initials}
                className="size-11 rounded-[30%] [corner-shape:squircle]"
              />
              <span className="min-w-0">
                <DisplayName
                  user={user}
                  className="block truncate text-sm font-semibold"
                />
                <span className="block truncate text-xs text-muted-foreground">
                  @{user.handle}
                </span>
              </span>
            </Link>
          ) : (
            <SignedOutCard
              needsOnboarding={!!session?.authenticated}
              onNavigate={close}
            />
          )}
          {auth.error && (
            <MenuRow
              icon={RotateCcw}
              onClick={() => {
                close();
                void auth.reload();
              }}
            >
              Retry account
            </MenuRow>
          )}
          <ThemeSwitch />
          {session?.authenticated && (
            <>
                  <MenuRow
                icon={LogOut}
                destructive
                disabled={auth.busy}
                onClick={() => {
                  close();
                  setConfirmLogout(true);
                }}
              >
                Sign out
              </MenuRow>
            </>
          )}
        </PopoverContent>
      </Popover>
      <ConfirmationDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sign out of ysocial?"
        description="You can keep browsing public posts and sign in again whenever you're ready."
        confirmLabel="Sign out"
        onConfirm={auth.logout}
        error={auth.error}
      />
    </>
  );
}

function SignedOutCard({
  needsOnboarding,
  onNavigate,
}: {
  needsOnboarding: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-3 p-2">
      <div>
        <p className="text-sm font-semibold">
          {needsOnboarding ? "Almost there" : "Welcome to ysocial"}
        </p>
        <p className="text-xs text-muted-foreground">
          {needsOnboarding
            ? "Choose a handle to finish setting up your profile."
            : "Sign in with your CNS account to post, reply and follow people."}
        </p>
      </div>
      {needsOnboarding ? (
        <Button
          className="h-9 w-full max-md:h-11"
          render={<Link to="/onboarding" onClick={onNavigate} />}
          nativeButton={false}
        >
          <UserPen />
          Finish your profile
        </Button>
      ) : (
        <Button
          className="h-9 w-full max-md:h-11"
          render={<a href="/auth/login" />}
          nativeButton={false}
        >
          <LogIn />
          Log in with CNS
        </Button>
      )}
    </div>
  );
}
