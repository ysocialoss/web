import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  errorMessage,
  retryRequest,
  type Session,
  type BannerCrop,
  type Paint,
} from "@/lib/api";
import { showRetryToast } from "@/lib/retry-toast";
import { toast } from "@/components/ui/toast-manager";
import { subscribeToLive } from "@/lib/live-events";
import { rememberSession } from "./session-hint";

function approvalWelcomeKey(userId: string) {
  return `approval-welcome:${userId}`;
}

function rememberPendingApproval(userId: string) {
  try {
    localStorage.setItem(approvalWelcomeKey(userId), "pending");
  } catch {
    // The live approval transition still works when storage is unavailable.
  }
}

function hasPendingApprovalWelcome(userId: string) {
  try {
    return localStorage.getItem(approvalWelcomeKey(userId)) === "pending";
  } catch {
    return false;
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [welcomeUserId, setWelcomeUserId] = useState<string>();
  const sessionRevision = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal, current?: {
    id: string;
    pendingApproval: boolean;
    bannedAt: string | null;
  }) => {
    const startedAt = sessionRevision.current;
    try {
      const result = await api.session(signal);
      if (signal?.aborted || startedAt !== sessionRevision.current) return;
      if (
        !current ||
        !result.authenticated ||
        result.needsOnboarding ||
        result.pendingApproval !== current.pendingApproval ||
        (result.ban?.at ?? null) !== current.bannedAt ||
        result.user.id !== current.id
      ) {
        if (result.authenticated && !result.needsOnboarding) {
          const id = result.user.id;
          if (result.pendingApproval) rememberPendingApproval(id);
          else if (!result.ban && (
            (current?.id === id && current.pendingApproval) || hasPendingApprovalWelcome(id)
          )) setWelcomeUserId(id);
        }
        sessionRevision.current++;
        setSession(result);
      }
      setError("");
    } catch (error) {
      if (!signal?.aborted && startedAt === sessionRevision.current)
        setError(errorMessage(error));
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    rememberSession(session);
  }, [session]);
  const bannedAt =
    session?.authenticated && !session.needsOnboarding ? session.ban?.at ?? null : null;
  const pendingUserId =
    session?.authenticated && !session.needsOnboarding && session.pendingApproval
      ? session.user.id
      : undefined;
  useEffect(() => {
    if (!pendingUserId) return;
    const controller = new AbortController();
    const check = () => void reload(controller.signal, { id: pendingUserId, pendingApproval: true, bannedAt });
    let source: EventSource;
    let retry: number | undefined;
    function connect() {
      source = new EventSource("/auth/approval/live");
      source.addEventListener("open", check);
      source.addEventListener("approval", check);
      source.addEventListener("account", check);
      source.addEventListener("resync", check);
      source.addEventListener("error", () => {
        if (source.readyState === EventSource.CLOSED) {
          check();
          retry = window.setTimeout(connect, 5000);
        }
      });
    }
    connect();
    return () => {
      source.close();
      window.clearTimeout(retry);
      controller.abort();
    };
  }, [pendingUserId, bannedAt, reload]);
  const activeUserId =
    session?.authenticated && !session.needsOnboarding && !session.pendingApproval
      ? session.user.id
      : undefined;
  useEffect(() => {
    if (!activeUserId) return;
    const controller = new AbortController();
    const check = () => void reload(controller.signal, { id: activeUserId, pendingApproval: false, bannedAt });
    const unsubscribe = subscribeToLive({ onAccountChange: check, onResync: check });
    return () => { unsubscribe(); controller.abort(); };
  }, [activeUserId, bannedAt, reload]);
  async function act(operation: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await operation();
      await reload();
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function logout() {
    const previous = session;
    function send() {
      const startedAt = ++sessionRevision.current;
      setSession({ authenticated: false });
      setError("");
      void retryRequest(() => api.logout(), {
        context: "sign out",
        beforeRetry: async () => {
          if (startedAt !== sessionRevision.current)
            throw new ApiError(403, "retry_account_changed");
        },
      }).catch((error: unknown) => {
        if (startedAt === sessionRevision.current) setSession(previous);
        showRetryToast("Couldn't sign out", error, () => {
          if (startedAt === sessionRevision.current) send();
          else
            toast.add({
              type: "info",
              title: "Your account changed",
              description:
                "Use the account menu to sign out of the current account.",
            });
        });
      });
    }
    send();
    return true;
  }
  function updateAvatar(userId: string, avatarUrl: string) {
    sessionRevision.current++;
    setSession((current) =>
      current?.authenticated &&
      !current.needsOnboarding &&
      current.user.id === userId
        ? { ...current, avatarUrl, user: { ...current.user, avatarUrl } }
        : current,
    );
  }
  function updateBanner(
    userId: string,
    bannerUrl: string | null,
    bannerCrop: BannerCrop | null,
  ) {
    sessionRevision.current++;
    setSession((current) =>
      current?.authenticated &&
      !current.needsOnboarding &&
      current.user.id === userId
        ? { ...current, user: { ...current.user, bannerUrl, bannerCrop } }
        : current,
    );
  }
  function updateProfile(
    userId: string,
    profile: Awaited<ReturnType<typeof api.updateProfile>>,
  ) {
    sessionRevision.current++;
    setSession((current) =>
      current?.authenticated &&
      !current.needsOnboarding &&
      current.user.id === userId
        ? {
            ...current,
            user: {
              ...current.user,
              handle: profile.handle,
              displayName: profile.displayName,
              pronouns: profile.pronouns,
            },
          }
        : current,
    );
  }
  function updatePaint(userId: string, paint: Paint | null) {
    sessionRevision.current++;
    setSession((current) =>
      current?.authenticated &&
      !current.needsOnboarding &&
      current.user.id === userId
        ? { ...current, user: { ...current.user, paint } }
        : current,
    );
  }
  const showApprovalWelcome =
    session?.authenticated === true && !session.needsOnboarding &&
    !session.pendingApproval && !session.ban && session.user.id === welcomeUserId;

  return {
    updateProfile,
    updateBanner,
    updateAvatar,
    updatePaint,
    session,
    error,
    busy,
    reload,
    showApprovalWelcome,
    dismissApprovalWelcome: () => {
      if (!welcomeUserId) return;
      try {
        localStorage.removeItem(approvalWelcomeKey(welcomeUserId));
      } catch {
        // Dismiss the dialog for this visit even when storage is unavailable.
      }
      setWelcomeUserId(undefined);
    },
    onboard: (handle: string, pronouns: string) => act(async () => {
      const result = await api.onboard(handle, pronouns);
      rememberPendingApproval(result.user.id);
    }),
    logout,
  };
}
export type AuthState = ReturnType<typeof useAuth>;
