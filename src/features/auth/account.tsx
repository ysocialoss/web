import { useState } from "react";
import { useLocation } from "react-router";
import { Check, LoaderCircle, LogOut, RotateCcw } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AuthState } from "./use-auth";

export function Account({ auth }: { auth: AuthState }) {
  const [handle, setHandle] = useState<string | null>(null);
  const { session } = auth;
  const location = useLocation();
  const signInFailed =
    location.pathname === "/login" &&
    new URLSearchParams(location.search).has("error");
  if (session?.authenticated && session.needsOnboarding) {
    return (
      <Dialog
        open
        onOpenChange={(_open, eventDetails) => eventDetails.cancel()}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void auth.onboard(handle ?? session.suggestedHandle);
            }}
          >
            <DialogHeader>
              <DialogTitle>Make yourself at home</DialogTitle>
              <DialogDescription>
                Choose a handle for your ysocial profile.
              </DialogDescription>
            </DialogHeader>
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
            {auth.error && (
              <p role="alert" className="text-sm text-destructive">
                {auth.error}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={auth.busy}
              onClick={() => auth.logout()}
            >
              <LogOut />
              Log out
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
  if (!auth.error && !signInFailed) return null;
  return (
    <section
      className="mx-auto mb-6 max-w-xl space-y-3"
      aria-label="Account access"
    >
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
      {location.pathname === "/login" &&
        new URLSearchParams(location.search).has("error") && (
          <p role="alert" className="text-sm text-destructive">
            Sign-in failed. Try signing in again.
          </p>
        )}
    </section>
  );
}
