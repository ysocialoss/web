import { Suspense, useEffect, useRef, useState } from "react";
import { Check, Link2, LoaderCircle, Plus, SendHorizontal } from "lucide-react";
import { Link } from "react-router";
import { DisplayName } from "@/components/display-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast-manager";
import { dmError, type DmUser } from "@/features/dms/dm-api";
import { type LocalDevice } from "@/features/dms/dm-crypto";
import { recentContacts, sendTextTo, type Recent } from "@/features/dms/dm-send";
import { errorMessage } from "@/lib/api";
import { writeClipboard } from "@/lib/clipboard";
import { lazyRoute } from "@/lib/lazy-route";
import { cn } from "@/lib/utils";

// Only needed once someone opens the picker; keep it out of the feed bundle.
const NewMessageDialog = lazyRoute<
  React.ComponentProps<typeof import("@/features/dms/new-message-dialog").NewMessageDialog>
>(() => import("@/features/dms/new-message-dialog").then((m) => ({ default: m.NewMessageDialog })));

const LONG_PRESS_MS = 520;
const name = (user: DmUser) => user.displayName.trim() || user.handle;

type Status = "sending" | "sent";

function Tile({ caption, selected, status, onClick, children }: {
  caption: React.ReactNode;
  selected?: boolean;
  status?: Status;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="w-16 shrink-0">
      <button
        type="button"
        disabled={status === "sending"}
        aria-pressed={selected === undefined ? undefined : selected}
        onClick={onClick}
        className="group/tile flex w-full flex-col items-center gap-1.5 p-1 text-center outline-none disabled:cursor-default"
      >
        <span className="relative rounded-full ring-2 ring-transparent transition-shadow duration-150 group-enabled/tile:group-hover/tile:ring-foreground/25 group-focus-visible/tile:ring-ring">
          {children}
          {selected && !status && (
            <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-white text-black ring-2 ring-popover">
              <Check className="size-3" strokeWidth={3} />
            </span>
          )}
          {status && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-background/75">
              {status === "sending" ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-5 text-primary" />}
            </span>
          )}
        </span>
        <span className="w-full truncate text-xs font-medium">{caption}</span>
      </button>
    </li>
  );
}

const circle = "size-12 rounded-full [corner-shape:round]";

type ShareTarget =
  | { kind: "post"; id: string }
  | { kind: "profile"; handle: string };

export function ShareButton({
  target,
  viewerId,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  hiddenTrigger = false,
  onShared,
}: {
  target: ShareTarget;
  viewerId: string | null;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hiddenTrigger?: boolean;
  onShared?: () => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  const [copied, setCopied] = useState(false);
  const [recent, setRecent] = useState<Recent>();
  const [extra, setExtra] = useState<DmUser[]>([]);
  const [selected, setSelected] = useState<DmUser[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  if (picking && !pickerLoaded) setPickerLoaded(true);
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const closing = useRef<number | undefined>(undefined);
  const path = target.kind === "post" ? `/posts/${target.id}` : `/@${target.handle}`;
  const link = new URL(path, window.location.origin).href;

  useEffect(() => () => {
    clearTimeout(press.current);
    window.clearTimeout(timer.current);
    window.clearTimeout(closing.current);
  }, []);

  useEffect(() => {
    if (!open || !viewerId) return;
    const controller = new AbortController();
    recentContacts(viewerId, controller.signal, 6)
      .then((result) => { if (!controller.signal.aborted) setRecent(result); })
      .catch((reason) => { if (!controller.signal.aborted) setRecent({ state: "error", message: dmError(reason) }); });
    return () => controller.abort();
  }, [open, viewerId]);

  async function copy() {
    try {
      await writeClipboard(link);
    } catch (error) {
      const id = toast.add({
        type: "error",
        title: "Couldn't copy link",
        description: errorMessage(error),
        timeout: 8000,
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
    onShared?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  }

  function toggle(user: DmUser) {
    setError("");
    setSelected((current) => current.some(({ id }) => id === user.id) ? current.filter(({ id }) => id !== user.id) : [...current, user]);
  }

  async function sendAll(device: LocalDevice) {
    if (sending || !selected.length) return;
    setSending(true);
    setError("");
    const failed: DmUser[] = [];
    let message = "";
    for (const user of selected) {
      setStatus((current) => ({ ...current, [user.id]: "sending" }));
      try {
        await sendTextTo(device, user.handle, link, AbortSignal.timeout(20_000));
        setStatus((current) => ({ ...current, [user.id]: "sent" }));
      } catch (reason) {
        failed.push(user);
        message = `Couldn’t send to @${user.handle}. ${dmError(reason)}`;
        setStatus((current) => {
          const next = { ...current };
          delete next[user.id];
          return next;
        });
      }
    }
    setSelected(failed);
    setSending(false);
    if (failed.length < selected.length) onShared?.();
    if (failed.length) setError(message);
    else {
      closing.current = window.setTimeout(() => setOpen(false), 900);
    }
  }

  const icon = "col-start-1 row-start-1 transition-all duration-300 ease-out";
  const ready = recent?.state === "ready" ? recent : undefined;
  const people = ready ? [...ready.people, ...extra.filter((user) => !ready.people.some(({ id }) => id === user.id))] : [];
  return (
    <>
      <Popover open={open} onOpenChange={(next) => {
        if (next && held.current) {
          held.current = false;
          return;
        }
        setOpen(next);
        if (!next) {
          window.clearTimeout(closing.current);
          setStatus({});
          setSelected([]);
          setExtra([]);
          setError("");
        }
      }}>
        {hiddenTrigger ? (
          <PopoverTrigger
            nativeButton={false}
            render={<span aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute right-0 bottom-0 size-px" />}
          />
        ) : (
        <PopoverTrigger
          render={
            <IconButton
              variant="ghost"
              size="sm"
              label={copied ? "Link copied" : "Share"}
              disabled={disabled}
              className={cn("gap-1.5 px-2 text-muted-foreground [-webkit-touch-callout:none] select-none", copied && "text-primary")}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                held.current = false;
                clearTimeout(press.current);
                press.current = setTimeout(() => {
                  held.current = true;
                  void copy();
                }, LONG_PRESS_MS);
              }}
              onPointerUp={() => clearTimeout(press.current)}
              onPointerLeave={() => clearTimeout(press.current)}
              onPointerCancel={() => clearTimeout(press.current)}
            />
          }
        >
          <span className="grid place-items-center" aria-live="polite">
            <SendHorizontal className={cn(icon, copied ? "scale-50 -rotate-45 opacity-0" : "scale-100 opacity-100")} />
            <Check className={cn(icon, copied ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-45 opacity-0")} />
          </span>
        </PopoverTrigger>
        )}
        <PopoverContent align="end" className="w-[26rem] max-w-[calc(100vw-1.5rem)] gap-3 p-4">
          <PopoverTitle className="text-sm font-semibold">Share {target.kind}</PopoverTitle>
          <ul className="-mx-1 flex flex-nowrap gap-x-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:thin]">
            <Tile caption={copied ? "Copied" : "Copy link"} onClick={() => void copy()}>
              <span className={cn(circle, "grid place-items-center bg-muted text-foreground", copied && "text-primary")}>
                {copied ? <Check aria-hidden="true" className="size-5" /> : <Link2 aria-hidden="true" className="size-5" />}
              </span>
            </Tile>
            {ready && people.map((person) => (
              <Tile key={person.id} caption={status[person.id] === "sent" ? "Sent" : <DisplayName user={person} name={name(person)} />}
                selected={selected.some(({ id }) => id === person.id)} status={status[person.id]} onClick={() => toggle(person)}>
                <Avatar userId={person.id} className={circle}>
                  {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                  <AvatarFallback className="text-sm">{name(person).slice(0, 2)}</AvatarFallback>
                </Avatar>
              </Tile>
            ))}
            {ready && (
              <Tile caption="More" onClick={() => setPicking(true)}>
                <span className="grid size-12 place-items-center rounded-full border-2 border-dashed border-border text-muted-foreground">
                  <Plus aria-hidden="true" className="size-5" />
                </span>
              </Tile>
            )}
            {viewerId && !recent && [0, 1, 2].map((slot) => (
              <li key={slot} aria-hidden="true" className="w-16 shrink-0 p-1"><span className="block size-12 animate-pulse rounded-full bg-muted motion-reduce:animate-none" /></li>
            ))}
          </ul>
          {!viewerId ? (
            <p className="rounded-lg bg-muted/50 px-3 py-3 text-center text-sm text-muted-foreground">Sign in to send {target.kind === "post" ? "posts" : "profiles"} in Messages.</p>
          ) : recent?.state === "setup" ? (
            <p className="rounded-lg bg-muted/50 px-3 py-3 text-center text-sm text-muted-foreground">
              Messages isn’t set up on this browser yet. <Link to="/messages" className="font-medium text-foreground underline underline-offset-4">Open Messages</Link>
            </p>
          ) : recent?.state === "error" ? (
            <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-3 text-center text-sm text-destructive">{recent.message}</p>
          ) : ready && people.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent conversations yet. Pick someone with the plus.</p>
          ) : null}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {ready && (
            <Button type="button" disabled={!selected.length || sending} onClick={() => void sendAll(ready.device)} className="w-full">
              {sending ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <SendHorizontal aria-hidden="true" />}
              {sending ? "Sending…" : selected.length > 1 ? `Send to ${selected.length} people` : selected.length ? `Send to ${name(selected[0])}` : "Send"}
            </Button>
          )}
        </PopoverContent>
      </Popover>
      {ready && (picking || pickerLoaded) && (
        <Suspense fallback={null}>
        <NewMessageDialog
          open={picking}
          onOpenChange={setPicking}
          device={ready.device}
          selfId={ready.device.userId}
          onOpened={() => {}}
          title="Send to"
          description="Find someone by their name or @handle."
          onPick={(user) => {
            setExtra((current) => current.some(({ id }) => id === user.id) ? current : [...current, user]);
            setSelected((current) => current.some(({ id }) => id === user.id) ? current : [...current, user]);
          }}
        />
        </Suspense>
      )}
    </>
  );
}
