import { VoiceTake } from "./voice-player";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import {
  api,
  ApiError,
  errorMessage,
  retryRequest,
  waitForRetry,
  type VoiceDraft,
} from "@/lib/api";
import { microphoneErrorMessage } from "@/lib/microphone";

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; seconds: number; recording: MediaRecorder }
  | { kind: "uploading"; seconds: number; recording: MediaRecorder; blob: Blob }
  | {
      kind: "ready";
      url: string;
      duration: number;
      recording: MediaRecorder;
      blob: Blob;
      waveform?: number[];
    };

// Browsers without a microphone permission query can remember a successful
// request for this page, including when the composer resets after publishing.
let microphoneAllowed = false;

function cancelQueuedVoice(id: string) {
  const signal = AbortSignal.timeout(30 * 60_000);
  void retryRequest(() => api.cancelVoiceJob(id, signal), {
    context: "cancel voice job",
    signal,
    maxDelayMs: 3000,
  }).catch(() => {});
}

function discardVoice(token: string) {
  const signal = AbortSignal.timeout(30 * 60_000);
  // The server's 30-minute expiry remains the fallback if the browser closes or is offline.
  void retryRequest(() => api.discardVoice(token, signal), {
    context: "discard voice message",
    maxDelayMs: 3000,
    signal,
  }).catch(() => {});
}

export function VoiceRecorder({
  disabled,
  userId,
  onChange,
  onBusyChange,
  renderToolbar,
}: {
  disabled: boolean;
  userId: string | null;
  onChange: (voice: VoiceDraft | undefined) => void;
  onBusyChange: (busy: boolean) => void;
  renderToolbar: (recordButton: ReactNode) => ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [error, setError] = useState("");
  const [micDialogOpen, setMicDialogOpen] = useState(false);
  const recordTrigger = useRef<HTMLButtonElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const upload = useRef<AbortController | null>(null);
  const preview = useRef<string | null>(null);
  const generation = useRef(0);
  const queuedJob = useRef<string | null>(null);
  const uploadedToken = useRef<string | null>(null);

  function release() {
    clearInterval(timer.current);
    clearTimeout(deadline.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function cancel() {
    generation.current++;
    upload.current?.abort();
    if (queuedJob.current && !uploadedToken.current)
      cancelQueuedVoice(queuedJob.current);
    queuedJob.current = null;
    if (uploadedToken.current) discardVoice(uploadedToken.current);
    uploadedToken.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    release();
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
    setState({ kind: "idle" });
    onChange(undefined);
    onBusyChange(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      upload.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      clearInterval(timer.current);
      clearTimeout(deadline.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      if (preview.current) URL.revokeObjectURL(preview.current);
    },
    [],
  );

  async function requestRecording() {
    if (disabled || !userId || state.kind !== "idle") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice recording requires a supported browser and HTTPS.");
      return;
    }
    setError("");
    const attempt = ++generation.current;
    let allowed = microphoneAllowed;
    try {
      const permission = await navigator.permissions?.query({
        name: "microphone",
      });
      if (permission) allowed = permission.state === "granted";
    } catch {
      // Some browsers support recording but do not expose this permission.
    }
    if (attempt !== generation.current) return;
    if (allowed) void start();
    else setMicDialogOpen(true);
  }

  async function start() {
    if (disabled || !userId || state.kind !== "idle") return;
    setMicDialogOpen(false);
    const attempt = ++generation.current;
    setError("");
    setState({ kind: "starting" });
    onBusyChange(true);
    try {
      const input = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 48000 },
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      if (attempt !== generation.current) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneAllowed = true;
      stream.current = input;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(input, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let size = 0;
      recording.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          size += event.data.size;
        }
        if (size > 8 * 1024 * 1024 && recording.state === "recording")
          recording.stop();
      };
      recording.onerror = () => {
        if (attempt !== generation.current) return;
        cancel();
        setError("Recording failed. Please try again.");
      };
      const began = performance.now();
      recording.onstop = async () => {
        if (attempt !== generation.current) return;
        release();
        const blob = new Blob(chunks, { type: recording.mimeType });
        setState({
          kind: "uploading",
          seconds: Math.floor((performance.now() - began) / 1000),
          recording,
          blob,
        });
        const controller = new AbortController();
        upload.current = controller;
        const jobId = crypto.randomUUID();
        queuedJob.current = jobId;
        try {
          async function verifyUploader() {
            const session = await api.sessionOnce(controller.signal);
            if (
              !session.authenticated ||
              session.needsOnboarding ||
              session.user.id !== userId
            )
              throw new ApiError(403, "retry_account_changed");
          }
          const retryOptions = {
            context: "upload voice message",
            maxDelayMs: 3000,
            signal: controller.signal,
            beforeRetry: verifyUploader,
          };
          let voice = await retryRequest(
            () => api.uploadVoice(blob, jobId),
            retryOptions,
          );
          while ("pending" in voice) {
            await waitForRetry(3000, controller.signal);
            voice = await retryRequest(
              () => api.voiceJob(jobId, controller.signal),
              { ...retryOptions, context: "check voice message" },
            );
          }
          if (attempt !== generation.current) {
            discardVoice(voice.token);
            return;
          }
          queuedJob.current = null;
          uploadedToken.current = voice.token;
          const url = URL.createObjectURL(blob);
          preview.current = url;
          setState({
            kind: "ready",
            url,
            duration: voice.durationMs / 1000,
            waveform: voice.waveform,
            recording,
            blob,
          });
          onChange(voice);
          onBusyChange(false);
        } catch (failure) {
          if (attempt !== generation.current) return;
          queuedJob.current = null;
          setState({ kind: "idle" });
          onBusyChange(false);
          setError(errorMessage(failure));
        }
      };
      recording.start(250);
      setState({ kind: "recording", seconds: 0, recording });
      timer.current = setInterval(
        () =>
          setState({
            kind: "recording",
            recording,
            seconds: Math.floor((performance.now() - began) / 1000),
          }),
        250,
      );
      // Leave room for the final encoded frame at the API's strict 120-second limit.
      deadline.current = setTimeout(() => {
        if (recording.state === "recording") recording.stop();
      }, 119500);
    } catch (failure) {
      if (attempt !== generation.current) return;
      release();
      if (failure instanceof DOMException && failure.name === "NotAllowedError")
        microphoneAllowed = false;
      setState({ kind: "idle" });
      onBusyChange(false);
      setError(microphoneErrorMessage(failure));
    }
  }

  const recordButton = state.kind === "idle" && (
    <IconButton
      ref={recordTrigger}
      label="Record voice message"
      type="button"
      className="rounded-full text-muted-foreground"
      disabled={disabled}
      onClick={() => void requestRecording()}
    >
      <Mic aria-hidden="true" />
    </IconButton>
  );

  return (
    <>
      {state.kind !== "idle" && (
        <section
          aria-label="Voice recorder"
          className="min-w-0 w-full space-y-2 rounded-2xl border border-border bg-background p-3 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <Mic
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Voice message
            </div>
            <IconButton
              label="Remove voice message"
              type="button"
              size="icon-sm"
              onClick={cancel}
              className="-mr-1 rounded-full text-muted-foreground"
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-lg bg-muted px-2 py-1 sm:gap-3">
            {state.kind === "starting" ? (
              <div
                role="status"
                className="flex min-w-0 flex-1 items-center gap-3 px-2 text-sm text-muted-foreground"
              >
                <LoaderCircle
                  className="size-4 shrink-0 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Waiting for microphone…
              </div>
            ) : (
              <VoiceTake
                state={state}
                onStop={() => {
                  if (recorder.current?.state === "recording")
                    recorder.current.stop();
                }}
              />
            )}
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
      {renderToolbar(recordButton)}
      <Dialog open={micDialogOpen} onOpenChange={setMicDialogOpen}>
        <DialogContent showCloseButton={false} finalFocus={recordTrigger}>
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <Mic className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Allow microphone access</DialogTitle>
            <DialogDescription>
              Your browser may ask for permission. Recording starts as soon as
              you allow access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Not now
            </DialogClose>
            <Button type="button" onClick={() => void start()}>
              Allow microphone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
