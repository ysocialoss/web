import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { toast } from "@/components/ui/toast-manager";
import { errorMessage } from "@/lib/api";
import { writeClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export function ProfileShareButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  async function copy() {
    try {
      await writeClipboard(new URL(`/@${handle}`, window.location.origin).href);
    } catch (error) {
      const id = toast.add({
        type: "error",
        title: "Couldn't copy link",
        description: errorMessage(error),
        timeout: 0,
        actionProps: {
          children: "Retry",
          onClick: () => {
            toast.close(id);
            void copy();
          },
        },
      });
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }
  const icon = "col-start-1 row-start-1 transition-all duration-300 ease-out";
  return (
    <IconButton
      variant="outline"
      label={copied ? "Link copied" : `Copy link to @${handle}`}
      className={cn(copied && "text-primary")}
      onClick={() => void copy()}
    >
      <span className="grid place-items-center" aria-live="polite">
        <Link2
          className={cn(
            icon,
            copied ? "scale-50 -rotate-45 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <Check
          className={cn(
            icon,
            copied
              ? "scale-100 rotate-0 opacity-100"
              : "scale-50 rotate-45 opacity-0",
          )}
        />
      </span>
    </IconButton>
  );
}
