import { useEffect, useRef, useState } from "react";
import { exportCrop } from "@zriz/core/dom";
import { useZoom, type Cropper as CropperApi } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import "@zriz/react/styles.css";
import { Check, ImagePlus, RotateCcw, FlipHorizontal } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";

function ZoomSlider() {
  const zoom = useZoom();
  return (
    <label className="flex items-center gap-3 text-sm">
      Zoom
      <input
        className="min-w-0 flex-1 accent-primary"
        type="range"
        min={zoom.min}
        max={zoom.max}
        step={0.01}
        value={zoom.value}
        onChange={(event) => zoom.onValueChange(event.target.valueAsNumber)}
        onPointerUp={zoom.onValueCommitted}
        onPointerCancel={zoom.onValueCommitted}
        onKeyUp={zoom.onValueCommitted}
      />
    </label>
  );
}

export function AvatarCropper({
  onSave,
}: {
  onSave: (picture: Blob, signal: AbortSignal) => Promise<void>;
}) {
  const [photo, setPhoto] = useState<{ file: File; id: number } | null>(null);
  const [status, setStatus] = useState<
    "empty" | "loading" | "ready" | "failed"
  >("empty");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const actions = useRef<CropperApi>(null);
  const running = useRef<AbortController | null>(null);

  useEffect(() => () => running.current?.abort(), []);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setDragging(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFileError("Choose a JPEG, PNG or WebP picture.");
      return;
    }
    running.current?.abort();
    running.current = null;
    setSaving(false);
    setSaveError("");
    setFileError("");
    setStatus("loading");
    setPhoto((previous) => ({ file, id: (previous?.id ?? 0) + 1 }));
  }

  async function save() {
    if (!actions.current || running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setSaving(true);
    setSaveError("");
    try {
      const { blob } = await exportCrop(actions.current, {
        type: "image/png",
        maxSize: { width: 512, height: 512 },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      await onSave(blob, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setSaveError(errorMessage(error));
    } finally {
      if (running.current === controller) {
        running.current = null;
        setSaving(false);
      }
    }
  }

  return (
    <div className="grid gap-4">
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a profile picture"
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />
      {!photo && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(
                event.relatedTarget instanceof Node
                  ? event.relatedTarget
                  : null,
              )
            ) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files[0]);
          }}
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring aspect-square ${dragging ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:border-primary/50 hover:bg-muted"}`}
        >
          <ImagePlus
            className="pointer-events-none size-8 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="pointer-events-none text-sm font-medium">
            {dragging
              ? "Drop your picture here"
              : "Drag a picture here or click to browse"}
          </span>
          <span className="pointer-events-none text-xs text-muted-foreground">
            JPEG, PNG or WebP
          </span>
        </button>
      )}
      {fileError && <p role="alert">{fileError}</p>}
      {photo && (
        <Cropper.Root
          key={photo.id}
          src={photo.file}
          actionsRef={actions}
          svg={false}
          aspect={1}
          maxZoom={3}
          disabled={saving}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("failed")}
          className="grid gap-4"
        >
          <Cropper.Viewport
            wheel="zoom"
            className="aspect-square w-full overflow-hidden rounded-xl bg-muted"
          >
            <Cropper.Image />
            <Cropper.Mask />
            <Cropper.Area
              aria-label="Profile picture crop area"
              className="after:outline-transparent focus-visible:after:outline-foreground"
            />
          </Cropper.Viewport>
          <ZoomSlider />
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => input.current?.click()}
            >
              <ImagePlus aria-hidden="true" /> Replace
            </Button>
            <div className="flex items-center gap-1">
              <Cropper.Rotate
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label="Rotate picture left"
              >
                <RotateCcw aria-hidden="true" />
              </Cropper.Rotate>
              <Cropper.Flip
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label="Flip picture horizontally"
              >
                <FlipHorizontal aria-hidden="true" />
              </Cropper.Flip>
              <Cropper.Reset
                render={<Button variant="ghost" className="hidden:hidden" />}
              >
                Reset
              </Cropper.Reset>
            </div>
          </div>
        </Cropper.Root>
      )}
      {status === "loading" && <p role="status">Loading picture…</p>}
      {status === "failed" && (
        <p role="alert">
          This picture could not open. Try a JPEG, PNG or WebP.
        </p>
      )}
      {saveError && <p role="alert">{saveError}</p>}
      {photo && (
        <Button
          disabled={status !== "ready"}
          aria-disabled={saving}
          onClick={() => void save()}
        >
          <Check aria-hidden="true" />
          {saving ? "Saving…" : "Set profile picture"}
        </Button>
      )}
    </div>
  );
}
