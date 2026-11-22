import {
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const storageKey = "ysocial:skip-external-link-warning";
let skipWithoutStorage = false;

function shouldSkipWarning() {
  try {
    return skipWithoutStorage || localStorage.getItem(storageKey) === "true";
  } catch {
    return skipWithoutStorage;
  }
}

function skipFutureWarnings() {
  try {
    localStorage.setItem(storageKey, "true");
  } catch {
    skipWithoutStorage = true;
  }
}

export function ExternalLink({
  href,
  children,
  className,
  label,
}: {
  href: string;
  children: ReactNode;
  className: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(false);
  const checkboxId = useId();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  function warn(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button > 1 || shouldSkipWarning()) return;
    event.preventDefault();
    setRemember(false);
    setOpen(true);
  }
  const link = (
    <a
      ref={linkRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
      onClick={warn}
      onAuxClick={warn}
    >
      {children}
    </a>
  );
  return (
    <>
      {label ? (
        <Tooltip>
          <TooltipTrigger render={link} />
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ) : link}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent initialFocus={cancelRef} finalFocus={linkRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>Open external link?</AlertDialogTitle>
            <AlertDialogDescription>
              This site is outside YSocial and may contain harmful content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="max-h-24 overflow-auto rounded-lg bg-muted p-2 text-sm wrap-anywhere">
            <bdi>{href}</bdi>
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id={checkboxId}
              checked={remember}
              onCheckedChange={setRemember}
            />
            <label htmlFor={checkboxId}>
              Don’t warn me about external links again
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (remember) skipFutureWarnings();
                window.open(href, "_blank", "noopener,noreferrer");
                setOpen(false);
              }}
            >
              Open link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
