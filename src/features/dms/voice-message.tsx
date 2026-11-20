import { useEffect, useRef, useState } from "react";
import { Slider } from "@base-ui/react/slider";
import { LoaderCircle, Mic, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { dmApi } from "./dm-api";
import { decryptFile } from "./dm-files";
import type { MessageVoice } from "./message-payload";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

async function seekableVoice(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("audio/webm")) return blob;

  try {
    // MediaRecorder can produce WebM files without duration or seek indexes.
    const decoder = new OfflineAudioContext(1, 1, 48_000);
    const audio = await decoder.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index));
    const frameBytes = channels.length * 2;
    const dataBytes = audio.length * frameBytes;
    const bytes = new Uint8Array(44 + dataBytes);
    const header = new DataView(bytes.buffer);
    const encoder = new TextEncoder();
    bytes.set(encoder.encode("RIFF"), 0);
    bytes.set(encoder.encode("WAVEfmt "), 8);
    bytes.set(encoder.encode("data"), 36);
    header.setUint32(4, bytes.length - 8, true);
    header.setUint32(16, 16, true);
    header.setUint16(20, 1, true); // PCM
    header.setUint16(22, channels.length, true);
    header.setUint32(24, audio.sampleRate, true);
    header.setUint32(28, audio.sampleRate * frameBytes, true);
    header.setUint16(32, frameBytes, true);
    header.setUint16(34, 16, true);
    header.setUint32(40, dataBytes, true);

    let offset = 44;
    for (let frame = 0; frame < audio.length; frame++) {
      for (const channel of channels) {
        const sample = Math.max(-1, Math.min(1, channel[frame]));
        header.setInt16(offset, Math.round(sample * 32767), true);
        offset += 2;
      }
    }
    return new Blob([bytes], { type: "audio/wav" });
  } catch {
    return blob;
  }
}

export function VoiceMessage({ voice, conversationId }: { voice: MessageVoice; conversationId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string>();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState(false);
  const [progress, setProgress] = useState(0);
  const wanted = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const scrubbing = useRef(false);
  const loading = useRef(false);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function load() {
    if (loading.current) return;
    loading.current = true;
    setState("loading");
    try {
      const data = await dmApi.download(conversationId, voice.id, AbortSignal.timeout(30_000));
      const blob = await decryptFile(data as Uint8Array<ArrayBuffer>, voice.key, voice.iv, voice.mime);
      setUrl(URL.createObjectURL(await seekableVoice(blob)));
      setState("ready");
    } catch {
      wanted.current = false;
      setState("failed");
    } finally {
      loading.current = false;
    }
  }

  function playWhenReady() {
    const player = audio.current;
    if (!wanted.current || !player || pendingSeek.current !== null || player.seeking) return;
    wanted.current = false;
    void player.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setPlayError(true);
    });
  }

  function toggle() {
    setPlayError(false);
    if (state === "idle" || state === "failed") {
      wanted.current = true;
      void load();
    } else if (state === "loading") {
      wanted.current = true;
    } else if (audio.current && !audio.current.paused) {
      wanted.current = false;
      audio.current.pause();
    } else {
      wanted.current = true;
      playWhenReady();
    }
  }

  function seek(position: number) {
    setProgress(position);
    const player = audio.current;
    if (player && player.readyState >= HTMLMediaElement.HAVE_METADATA) {
      player.currentTime = position * (Number.isFinite(player.duration) ? player.duration : voice.seconds);
      return;
    }
    pendingSeek.current = position;
    if (state === "idle" || state === "failed") void load();
  }

  const bars = voice.wave?.length ? voice.wave : Array.from({ length: 36 }, (_, index) => 0.35 + 0.3 * Math.abs(Math.sin(index * 1.7)));
  return (
    <div onClick={(event) => event.stopPropagation()} className="flex w-full max-w-xs items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-card-foreground">
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
        <Slider.Root
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onValueChange={(position) => {
            scrubbing.current = true;
            setProgress(position);
          }}
          onValueCommitted={(position) => {
            scrubbing.current = false;
            seek(position);
          }}
          thumbAlignment="center"
        >
          <Slider.Control className="relative flex h-8 cursor-pointer touch-none items-center gap-[2px] rounded-sm select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            {bars.map((level, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn("w-[3px] min-w-px flex-1 rounded-full transition-colors", index / bars.length < progress ? "bg-primary" : "bg-muted-foreground/35")}
                style={{ height: `${Math.max(12, Math.min(100, level * 100))}%` }}
              />
            ))}
            <Slider.Track className="absolute inset-0">
              <Slider.Thumb aria-label="Voice message position" getAriaValueText={(value) => clock(Number(value) * voice.seconds)} className="size-px opacity-0" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <p className="text-xs text-muted-foreground tabular-nums">
          {state === "failed" ? "Couldn’t load. Tap to retry." : clock(playing || progress > 0 ? progress * voice.seconds : voice.seconds)}
        </p>
        {playError && <p role="alert" className="text-xs text-destructive">Couldn’t start playback. Press Play to try again.</p>}
      </div>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="auto"
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onCanPlay={playWhenReady}
          onSeeked={playWhenReady}
          onLoadedMetadata={() => {
            const position = pendingSeek.current;
            if (position === null) return;
            pendingSeek.current = null;
            seek(position);
          }}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onTimeUpdate={({ currentTarget }) => {
            if (scrubbing.current || pendingSeek.current !== null || currentTarget.seeking || currentTarget.ended) return;
            const duration = Number.isFinite(currentTarget.duration) ? currentTarget.duration : voice.seconds;
            if (duration > 0) setProgress(Math.min(1, currentTarget.currentTime / duration));
          }}
        />
      )}
    </div>
  );
}
