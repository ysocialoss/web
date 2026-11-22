import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/time-ago";
import { History } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Version = { content: string; at: string };

/** The "edited" label on a post; opens every earlier version of its text. */
export function EditHistory({
  postId,
  editedAt,
}: {
  postId: string;
  editedAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // HTTP completes asynchronously; cleanup cancels stale responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    api
      .postEdits(postId, controller.signal)
      .then((result) => setVersions(result.versions))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [open, postId, editedAt]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              aria-label="Edited. Show edit history"
              className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <History className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>
          Edited{" "}
          {timeAgo(editedAt)}
          {" · "}View history
        </TooltipContent>
      </Tooltip>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit history</DialogTitle>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !versions ? (
          <LoadingSkeleton label="Loading edit history…">
            <div className="space-y-4">
              {[0, 1].map((row) => (
                <div key={row} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          </LoadingSkeleton>
        ) : (
          <ol className="space-y-4">
            {versions.map((version, index) => (
              <li
                key={`${version.at}-${index}`}
                className="rounded-lg border bg-muted/40 p-3"
              >
                <p className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <time
                    dateTime={version.at}
                    title={new Date(version.at).toLocaleString()}
                  >
                    {timeAgo(version.at)}
                  </time>
                  {index === 0 && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-medium text-foreground">
                      Current
                    </span>
                  )}
                </p>
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {version.content || (
                    <span className="text-muted-foreground">No caption</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
