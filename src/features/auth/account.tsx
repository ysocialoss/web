import { useState } from "react";
import { useLocation } from "react-router";
import { Check, LoaderCircle, LogIn, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type { AuthState } from "./use-auth";
import { LoadingSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export function Account({ auth }: { auth: AuthState }) {
  const [handle, setHandle] = useState<string | null>(null);
  const { session } = auth;
  const location = useLocation();
  if (session?.authenticated && !session.needsOnboarding && !auth.error)
    return null;
  return (
    <section
      className="mx-auto mb-6 max-w-xl space-y-3"
      aria-label="Account access"
    >
      {!session && !auth.error && (
        <LoadingSkeleton label="Loading account…">
          <div className="flex h-9 w-40 items-center gap-2 rounded-md border px-3">
            <Skeleton className="size-4 shrink-0" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        </LoadingSkeleton>
      )}
      {auth.error && (
        <div className="flex items-center justify-between gap-2">
          <p role="alert" className="text-sm text-destructive">
            {auth.error}
          </p>
          <IconButton label="Retry account" onClick={() => void auth.reload()}>
            <RotateCcw />
          </IconButton>
        </div>
      )}
      {session && !session.authenticated && (
        <Button render={<a href="/auth/login" />} variant="outline">
          <LogIn />
          Sign in with CNS
        </Button>
      )}
      {session?.authenticated && session.needsOnboarding && (
        <form
          className="space-y-3 rounded-xl border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void auth.onboard(handle ?? session.suggestedHandle);
          }}
        >
          <div>
            <h1 className="font-semibold">Make yourself at home</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a handle for your ysocial profile.
            </p>
          </div>
          <label htmlFor="handle" className="text-sm">
            Your handle
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="handle"
              value={handle ?? session.suggestedHandle}
              onChange={(event) => setHandle(event.target.value)}
              pattern="[a-z0-9_]{3,32}"
              minLength={3}
              maxLength={32}
              required
              disabled={auth.busy}
              autoComplete="username"
            />
            <IconButton
              label="Create profile"
              type="submit"
              variant="default"
              disabled={auth.busy}
            >
              {auth.busy ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Check />
              )}
            </IconButton>
          </div>
          <p className="text-xs text-muted-foreground">
            3–32 lowercase letters, numbers, or underscores.
          </p>
        </form>
      )}
      {location.pathname === "/login" &&
        new URLSearchParams(location.search).has("error") && (
          <p role="alert" className="text-sm text-destructive">
            Sign-in failed. Try signing in again.
          </p>
        )}
    </section>
  );
}
