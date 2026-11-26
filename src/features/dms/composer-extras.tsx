import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, ListChecks, Mic, Paperclip, Plus, SendHorizontal, Trash2, X } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { GifPicker } from "@/features/gifs/gif-picker";
import type { GifSearchItem } from "@/lib/api";
import { microphoneErrorMessage } from "@/lib/microphone";
import type { MessageGif, MessagePoll } from "./message-payload";
import { pollLimits } from "./message-payload";

export type Recorded = { blob: Blob; seconds: number; wave: number[]; mime: string };

export function AttachMenu({ disabled, onVoice, onGif, onPoll, onFile }: {
  disabled: boolean;
  onVoice: () => void;
  onGif: (gif: MessageGif) => void;
  onPoll: (poll: MessagePoll) => void;
  onFile: (file: File) => void;
}) {
  const [gifs, setGifs] = useState(false);
  const [poll, setPoll] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={picker} type="file" hidden aria-hidden="true" tabIndex={-1} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onFile(file);
      }} />
      <ActionMenu
        title="Add to message"
        hideTitle
        large
        trigger={
          <IconButton label="Add to message" size="icon" disabled={disabled} className="shrink-0 rounded-lg">
            <Plus aria-hidden="true" />
          </IconButton>
        }
        items={[
          { kind: "action", icon: Mic, label: "Voice message", onClick: onVoice },
          { kind: "action", icon: ImageIcon, label: "GIF", onClick: () => setGifs(true) },
          { kind: "action", icon: ListChecks, label: "Poll", onClick: () => setPoll(true) },
          { kind: "action", icon: Paperclip, label: "Upload a file", onClick: () => picker.current?.click() },
        ]}
      />
      <Dialog open={gifs} onOpenChange={setGifs}>
        {gifs && <GifPicker infiniteScroll onSelect={(item: GifSearchItem) => {
          setGifs(false);
          onGif({ url: item.url, previewUrl: item.previewUrl, title: item.title.slice(0, 200), width: item.width, height: item.height });
        }} />}
      </Dialog>
      <PollDialog open={poll} onOpenChange={setPoll} onCreate={(created) => { setPoll(false); onPoll(created); }} />
    </>
  );
}

function PollDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (poll: MessagePoll) => void }) {
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState(["", ""]);
  useEffect(() => {
    if (open) return;
    const reset = setTimeout(() => { setTitle(""); setOptions(["", ""]); }, 200);
    return () => clearTimeout(reset);
  }, [open]);
  const cleaned = options.map((option) => option.trim());
  const filled = cleaned.filter(Boolean);
  const unique = new Set(filled.map((option) => option.toLowerCase())).size === filled.length;
  const valid = title.trim().length > 0 && filled.length === cleaned.length && unique && filled.length >= 2;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogHeader>
          <DialogTitle>Create a poll</DialogTitle>
          <DialogDescription>Both of you can vote, and change your vote, until it’s deleted.</DialogDescription>
        </DialogHeader>
        <form className="space-y-2" onSubmit={(event) => {
          event.preventDefault();
          if (valid) onCreate({ title: title.trim(), options: cleaned });
        }}>
          <Input aria-label="Question" placeholder="Ask a question" value={title} maxLength={pollLimits.title} onChange={(event) => setTitle(event.target.value)} />
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input aria-label={`Option ${index + 1}`} placeholder={`Option ${index + 1}`} value={option} maxLength={pollLimits.option}
                onChange={(event) => setOptions(options.map((current, at) => at === index ? event.target.value : current))} />
              {options.length > 2 && (
                <IconButton label={`Remove option ${index + 1}`} type="button" onClick={() => setOptions(options.filter((_, at) => at !== index))}>
                  <X aria-hidden="true" />
                </IconButton>
              )}
            </div>
          ))}
          {!unique && <p role="alert" className="text-xs text-destructive">Each option has to be different.</p>}
          <DialogFooter className="pt-1 sm:justify-between">
            <Button type="button" variant="ghost" size="sm" disabled={options.length >= pollLimits.options} onClick={() => setOptions([...options, ""])}>
              <Plus aria-hidden="true" /> Add option
            </Button>
            <Button type="submit" disabled={!valid}>Send poll</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const maxSeconds = 180;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const preferredTypes = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

export function VoiceRecorderBar({ onCancel, onSend }: { onCancel: () => void; onSend: (recording: Recorded) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const levels = useRef<number[]>([]);
  const started = useRef(0);
  const finish = useRef<"send" | "cancel" | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        const mime = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
        const active = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
        recorder.current = active;
        active.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
        active.onstop = () => {
          stream?.getTracks().forEach((track) => track.stop());
          const action = finish.current;
          if (action !== "send") return;
          const type = active.mimeType || mime || "audio/webm";
          const total = Math.max(1, Math.round((Date.now() - started.current) / 1000));
          const buckets = 40;
          const wave = Array.from({ length: buckets }, (_, bucket) => {
            const from = Math.floor((bucket / buckets) * levels.current.length);
            const to = Math.max(from + 1, Math.floor(((bucket + 1) / buckets) * levels.current.length));
            const slice = levels.current.slice(from, to);
            return slice.length ? Math.max(...slice) : 0;
          });
          const peak = Math.max(0.05, ...wave);
          onSend({ blob: new Blob(chunks.current, { type }), seconds: total, wave: wave.map((value) => Math.round((value / peak) * 100) / 100), mime: type.split(";")[0] });
        };
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        active.start(250);
        started.current = Date.now();
        timer = setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
          const rms = Math.min(1, Math.sqrt(sum / samples.length) * 3);
          levels.current.push(rms);
          setLevel(rms);
          const elapsed = Math.floor((Date.now() - started.current) / 1000);
          setSeconds(elapsed);
          if (elapsed >= maxSeconds && active.state === "recording") {
            finish.current = "send";
            active.stop();
          }
        }, 100);
      } catch (failure) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!cancelled) setError(microphoneErrorMessage(failure));
      }
    })();
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (recorder.current?.state === "recording") {
        finish.current = "cancel";
        recorder.current.stop();
      }
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop(action: "send" | "cancel") {
    finish.current = action;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    if (action === "cancel") onCancel();
  }

  return (
    <div role="group" aria-label="Recording a voice message" className="flex min-h-9 flex-1 items-center gap-2 px-1">
      <IconButton label="Discard recording" onClick={() => stop("cancel")} className="shrink-0 text-muted-foreground hover:text-destructive">
        <Trash2 aria-hidden="true" />
      </IconButton>
      {error ? (
        <p role="alert" className="min-w-0 flex-1 text-xs text-destructive">{error}</p>
      ) : (
        <>
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse" />
          <span className="w-10 shrink-0 text-sm tabular-nums" role="timer" aria-label="Recording length">{clock(seconds)}</span>
          <span aria-hidden="true" className="flex h-6 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
            {Array.from({ length: 32 }, (_, index) => (
              <span key={index} className="w-[3px] shrink-0 rounded-full bg-muted-foreground/50 transition-[height] duration-100"
                style={{ height: `${Math.max(14, Math.min(100, (level * 100) * (0.4 + 0.6 * Math.abs(Math.sin(index * 0.9 + seconds)))))}%` }} />
            ))}
          </span>
        </>
      )}
      <IconButton type="button" size="icon" className="shrink-0 rounded-lg" label="Send voice message" disabled={!!error || seconds < 1} onClick={() => stop("send")}>
        <SendHorizontal aria-hidden="true" />
      </IconButton>
    </div>
  );
}
