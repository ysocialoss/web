import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { RefreshCw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const checkEvery = 5 * 60_000;

export function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function reloadApp() {
  window.location.reload();
}

async function latestBuild(signal: AbortSignal) {
  const response = await fetch("/version.json", { cache: "no-store", signal });
  if (!response.ok) return null;
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" && "build" in body && typeof body.build === "string" ? body.build : null;
}

function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (available) return;
    let controller: AbortController | undefined;
    const check = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      controller?.abort();
      controller = new AbortController();
      void latestBuild(controller.signal).then(
        (build) => {
          if (build && build !== __APP_BUILD__) setAvailable(true);
        },
        () => undefined,
      );
    };
    const first = window.setTimeout(check, 3000);
    const timer = window.setInterval(check, checkEvery);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    window.addEventListener("pageshow", check);
    return () => {
      controller?.abort();
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.removeEventListener("pageshow", check);
    };
  }, [available]);
  return available;
}

export function AppUpdatePrompt() {
  const available = useUpdateAvailable();
  const [dismissed, setDismissed] = useState(false);
  const shown = available && !dismissed;
  return (
    <div
      role="status"
      aria-live="polite"
      inert={!shown}
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        "top-[calc(4.5rem+env(safe-area-inset-top))] md:top-4",
        shown ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
      )}
    >
      {available && (
        <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-50/95 py-2.5 pr-2 pl-3.5 text-amber-950 shadow-lg backdrop-blur-xl dark:border-amber-400/30 dark:bg-amber-950/90 dark:text-amber-50">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="min-w-0 flex-1 text-sm leading-tight">
            <span className="font-semibold">Update available.</span>{" "}
            <span className="text-amber-900/80 dark:text-amber-100/80">Reload to get it.</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={reloadApp}
            className="border-amber-500/50 bg-transparent text-amber-950 hover:bg-amber-500/15 dark:border-amber-400/40 dark:bg-transparent dark:text-amber-50 dark:hover:bg-amber-400/15"
          >
            <RefreshCw aria-hidden="true" />
            Reload
          </Button>
          <IconButton
            size="icon-sm"
            variant="ghost"
            label="Dismiss update"
            onClick={() => setDismissed(true)}
            className="text-amber-900/70 hover:bg-amber-500/15 hover:text-amber-950 dark:text-amber-100/70 dark:hover:text-amber-50"
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
