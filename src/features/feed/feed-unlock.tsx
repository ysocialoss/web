import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { Session } from "@/lib/api";
import type { AuthState } from "@/features/auth/use-auth";
import { FeedChoiceDialog } from "@/features/legal/account-gates";

export function feedLocked(session: Session | null) {
  return (
    !!session?.authenticated &&
    !session.needsOnboarding &&
    !session.pendingApproval &&
    !session.ban &&
    !session.feedChoiceNeeded &&
    !session.user.feedPersonalize
  );
}

export function useFeedUnlock(auth?: AuthState) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const locked = feedLocked(auth?.session ?? null);
  const goHome = useRef(false);
  useEffect(() => {
    if (!goHome.current || locked) return;
    goHome.current = false;
    navigate("/");
  }, [locked, navigate]);
  const dialog = open ? (
    <FeedChoiceDialog
      onDismiss={() => setOpen(false)}
      onDone={(personalize) => {
        setOpen(false);
        if (!personalize) return;
        goHome.current = true;
        void auth?.reload();
      }}
    />
  ) : null;
  return { locked, unlock: () => setOpen(true), dialog };
}

export function BetaTag({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`rounded-full border border-current/30 px-1.5 py-px text-[0.6rem] leading-none font-semibold tracking-wide uppercase ${className}`}
    >
      Beta
    </span>
  );
}
