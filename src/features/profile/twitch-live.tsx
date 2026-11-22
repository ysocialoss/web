import { useEffect, useSyncExternalStore } from "react";
import { Tv } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const FRESH_MS = 60_000;
const BATCH = 50;
const entries = new Map<string, { at: number; login: string | null }>();
const listeners = new Set<() => void>();
const queue = new Set<string>();
let version = 0;
let timer: number | undefined;

function emit() {
  version++;
  for (const listener of listeners) listener();
}

async function flush() {
  timer = undefined;
  const handles = [...queue];
  queue.clear();
  for (let offset = 0; offset < handles.length; offset += BATCH) {
    const chunk = handles.slice(offset, offset + BATCH);
    try {
      const { live } = await api.twitchLive(chunk);
      const at = Date.now();
      for (const handle of chunk) entries.set(handle, { at, login: live[handle]?.login ?? null });
    } catch {
      for (const handle of chunk) entries.set(handle, { at: Date.now(), login: entries.get(handle)?.login ?? null });
    }
  }
  emit();
}

function request(handle: string) {
  const known = entries.get(handle);
  if (known && Date.now() - known.at < FRESH_MS) return;
  entries.set(handle, { at: Date.now(), login: known?.login ?? null });
  queue.add(handle);
  timer ??= window.setTimeout(() => void flush(), 100);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTwitchLogin(handle: string) {
  useSyncExternalStore(subscribe, () => version);
  const now = useNow();
  useEffect(() => {
    const known = entries.get(handle);
    if (!known || now - known.at >= FRESH_MS) request(handle);
  }, [handle, now]);
  return entries.get(handle)?.login ?? null;
}

export function TwitchLive({ handle, className }: { handle: string; className?: string }) {
  const login = useTwitchLogin(handle);
  if (!login) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={`https://www.twitch.tv/${login}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${login} is live on Twitch, opens in a new tab`}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center self-center rounded-sm text-[#9146FF] outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          />
        }
      >
        <Tv className="size-4 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Live on Twitch</TooltipContent>
    </Tooltip>
  );
}
