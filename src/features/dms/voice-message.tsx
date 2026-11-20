import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { dmApi } from "./dm-api";
import { decryptFile } from "./dm-files";
import type { MessageVoice } from "./message-payload";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function VoiceMessage({ voice, conversationId }: { voice: MessageVoice; conversationId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string>();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const wanted = useRef(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function load() {
    setState("loading");
    try {
      const data = await dmApi.download(conversationId, voice.id, AbortSignal.timeout(30_000));
      const blob = await decryptFile(data as Uint8Array<ArrayBuffer>, voice.key, voice.iv, voice.mime);
      setUrl(URL.createObjectURL(blob));
      setState("ready");
    } catch {
      setState("failed");
    }
  }

  useEffect(() => {
    if (state === "ready" && wanted.current) {
      wanted.current = false;
      void audio.current?.play().catch(() => {});
    }
  }, [state, url]);

  function toggle() {
    if (state === "idle" || state === "failed") {
      wanted.current = true;
      void load();
    } else if (audio.current) {
      if (audio.current.paused) void audio.current.play().catch(() => {});
      else audio.current.pause();
    }
  }

  const bars = voice.wave?.length ? voice.wave : Array.from({ length: 36 }, (_, index) => 0.35 + 0.3 * Math.abs(Math.sin(index * 1.7)));
  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-card-foreground">
      <button
        type="button"
        onClick={toggle}
        aria-label={state === "failed" ? "Retry voice message" : playing ? "Pause voice message" : "Play voice message"}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
      >
        {state === "loading" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          : state === "failed" ? <Mic aria-hidden="true" className="size-4" />
          : playing ? <Pause aria-hidden="true" className="size-4 fill-current" /> : <Play aria-hidden="true" className="size-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(voice.seconds)}
          aria-valuenow={Math.round(progress * voice.seconds)}
          tabIndex={state === "ready" ? 0 : -1}
          onClick={(event) => {
            if (!audio.current || state !== "ready") return;
            const rect = event.currentTarget.getBoundingClientRect();
            audio.current.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * voice.seconds;
          }}
          className="flex h-8 cursor-pointer items-center gap-[2px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {bars.map((level, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cn("w-[3px] min-w-px flex-1 rounded-full transition-colors", index / bars.length < progress ? "bg-primary" : "bg-muted-foreground/35")}
              style={{ height: `${Math.max(12, Math.min(100, level * 100))}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {state === "failed" ? "Couldn’t load. Tap to retry." : clock(playing || progress > 0 ? progress * voice.seconds : voice.seconds)}
        </p>
      </div>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onTimeUpdate={(event) => setProgress(Math.min(1, event.currentTarget.currentTime / (voice.seconds || event.currentTarget.duration || 1)))}
        />
      )}
    </div>
  );
}
