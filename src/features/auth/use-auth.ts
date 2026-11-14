import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  errorMessage,
  retryRequest,
  type Session,
} from "@/lib/api";
import { showRetryToast } from "@/lib/retry-toast";
import { toast } from "@/components/ui/toast";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRevision = useRef(0);
  const reload = useCallback(async (signal?: AbortSignal) => {
    const startedAt = sessionRevision.current;
    try {
      const result = await api.session(signal);
      if (signal?.aborted || startedAt !== sessionRevision.current) return;
      sessionRevision.current++;
      setSession(result);
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
  return {
    updateAvatar,
    session,
    error,
    busy,
    reload,
    onboard: (handle: string) => act(() => api.onboard(handle)),
    logout,
  };
}
export type AuthState = ReturnType<typeof useAuth>;
