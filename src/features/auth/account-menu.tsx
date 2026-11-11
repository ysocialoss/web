import { useState } from "react";
import { Link } from "react-router";
import {
  LogIn,
  LogOut,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthState } from "./use-auth";
import { Skeleton } from "@/components/ui/skeleton";

export function AccountMenu({ auth }: { auth: AuthState }) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { session } = auth;
  const user =
    session?.authenticated && !session.needsOnboarding ? session.user : null;
  const avatarUrl = session?.authenticated ? session.avatarUrl : null;
  const initials = user
    ? (user.displayName.trim() || user.handle).slice(0, 2)
    : null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-[30%] [corner-shape:squircle] lg:size-9"
              aria-label="Account menu"
              title="Account menu"
              disabled={auth.busy || (!session && !auth.error)}
            />
          }
        >
          {!session && !auth.error ? (
            <Skeleton
              className="size-full rounded-[30%] [corner-shape:squircle]"
              aria-hidden="true"
            />
          ) : (
            <Avatar className="size-full">
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback className="text-xs">
                {initials || <UserRound className="size-4" />}
              </AvatarFallback>
            </Avatar>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {user ? (
                <div className="py-1">
                  <p className="truncate font-medium text-foreground">
                    {user.displayName}
                  </p>
                  <p className="truncate text-xs">@{user.handle}</p>
                </div>
              ) : (
                "Your account"
              )}
            </DropdownMenuLabel>
            {user && (
              <DropdownMenuItem render={<Link to={`/@${user.handle}`} />}>
                <UserRound />
                View profile
              </DropdownMenuItem>
            )}
            {session?.authenticated && session.needsOnboarding && (
              <DropdownMenuItem render={<Link to="/onboarding" />}>
                <UserRound />
                Finish your profile
              </DropdownMenuItem>
            )}
            {!session?.authenticated && (
              <DropdownMenuItem render={<a href="/auth/login" />}>
                <LogIn />
                Login
              </DropdownMenuItem>
            )}
            <DropdownMenuItem render={<Link to="/settings/feed" />}>
              <SlidersHorizontal />
              Preferences
            </DropdownMenuItem>
            {auth.error && (
              <DropdownMenuItem onClick={() => void auth.reload()}>
                <RotateCcw />
                Retry account
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {session?.authenticated && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={auth.busy}
                onClick={() => setConfirmLogout(true)}
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
