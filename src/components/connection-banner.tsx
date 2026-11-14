import { useSyncExternalStore } from "react";
import { CloudOff, WifiOff } from "lucide-react";
import {
  getConnectionStatus,
  subscribeConnectionStatus,
} from "@/lib/connection-status";

export function ConnectionBanner() {
  const status = useSyncExternalStore(
    subscribeConnectionStatus,
    getConnectionStatus,
    () => "connected",
  );
  const Icon = status === "offline" ? WifiOff : CloudOff;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="shrink-0"
    >
      {status !== "connected" && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-500/25 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <p>
            {status === "offline"
              ? "It seems you have no internet connection."
              : "There’s a connection issue with ysocial."}
          </p>
        </div>
      )}
    </div>
  );
}
