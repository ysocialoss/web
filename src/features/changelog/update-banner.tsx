import { useEffect } from "react";
import { X } from "lucide-react";
import { useUpdatePromptShown } from "@/features/updates/app-update";
import { checkChangelogUnseen, markChangelogSeen, openChangelog, useChangelogState } from "./changelog-store";

/** Shown under the header (where the connection banner sits) when there are updates the viewer has not seen. */
export function UpdateBanner({ signedIn }: { signedIn: boolean }) {
  const { unseen } = useChangelogState();
  const updatePromptShown = useUpdatePromptShown();

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    const check = () => checkChangelogUnseen(controller.signal).catch(() => {});
    void check();
    // Releases land while the app is open, so look again when the tab comes back.
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn]);

  // Wait until the reload is done, so the banner points at changes this tab actually has.
  if (!signedIn || !unseen || updatePromptShown) return null;
  return (
    <div data-top-banner="" className="relative z-40 flex shrink-0 items-center justify-center gap-2 border-b border-primary/20 bg-primary/10 px-10 py-2 text-center text-sm">
      <p>
        ysocial has updated!{" "}
        <button type="button" onClick={openChangelog} className="font-medium underline underline-offset-2 hover:text-primary">
          See what's new
        </button>
      </p>
      <button
        type="button"
        onClick={markChangelogSeen}
        aria-label="Dismiss"
        className="absolute right-2 rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
