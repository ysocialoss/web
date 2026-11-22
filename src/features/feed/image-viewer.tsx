import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent, type Ref, type WheelEvent } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw, X } from "lucide-react";
import { toast } from "@/components/ui/toast-manager";
import { cn } from "@/lib/utils";

const minScale = 1;
const maxScale = 6;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type View = { scale: number; x: number; y: number };
type ZoomControls = { zoom: (kind: "in" | "out" | "reset") => void };
const reset: View = { scale: 1, x: 0, y: 0 };

function ZoomableImage({
  src,
  alt,
  onSwipe,
  onZoomChange,
  ref,
}: {
  src: string;
  alt: string;
  onSwipe: (direction: 1 | -1) => void;
  onZoomChange: (zoomed: boolean) => void;
  ref: Ref<ZoomControls>;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(reset);
  const [animate, setAnimate] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; scale: number; startX: number; startY: number; view: View; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  function bounded(next: View): View {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return next;
    const scale = clamp(next.scale, minScale, maxScale);
    const limitX = (box.width * (scale - 1)) / 2;
    const limitY = (box.height * (scale - 1)) / 2;
    return { scale, x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) };
  }

  function zoomAt(scale: number, clientX?: number, clientY?: number) {
    setView((current) => {
      const box = frame.current?.getBoundingClientRect();
      if (!box || clientX === undefined || clientY === undefined) return bounded({ ...current, scale });
      const px = clientX - box.left - box.width / 2;
      const py = clientY - box.top - box.height / 2;
      const ratio = clamp(scale, minScale, maxScale) / current.scale;
      return bounded({ scale, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio });
    });
  }

  useEffect(() => {
    onZoomChange(view.scale > 1.01);
  }, [view.scale, onZoomChange]);

  useImperativeHandle(ref, () => ({
    zoom(kind) {
      setAnimate(true);
      if (kind === "reset") setView(reset);
      else zoomAt(view.scale * (kind === "in" ? 1.6 : 1 / 1.6));
    },
  }));

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    setAnimate(false);
    zoomAt(view.scale * Math.exp(-event.deltaY * 0.0025), event.clientX, event.clientY);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    setAnimate(false);
    gesture.current = {
      distance: points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
      scale: view.scale,
      startX: event.clientX,
      startY: event.clientY,
      view,
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const start = gesture.current;
    if (points.length === 2 && start.distance > 0) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      start.moved = true;
      zoomAt(start.scale * (distance / start.distance), (points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
      return;
    }
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) start.moved = true;
    if (start.view.scale > 1.01) setView(bounded({ ...start.view, x: start.view.x + dx, y: start.view.y + dy }));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0 || !start) return;
    gesture.current = null;
    setAnimate(true);
    const dx = event.clientX - start.startX;
    if (start.view.scale <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(event.clientY - start.startY)) {
      onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (start.moved) return;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (view.scale > 1.01) setView(reset);
      else zoomAt(2.5, event.clientX, event.clientY);
    } else lastTap.current = now;
  }

  return (
    <div
      ref={frame}
      className={cn("relative flex h-full w-full touch-none items-center justify-center overflow-hidden select-none", view.scale > 1.01 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        className={cn("max-h-full max-w-full object-contain will-change-transform", animate && "transition-transform duration-200 ease-out motion-reduce:transition-none")}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
      />
    </div>
  );
}

const control =
  "grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md outline-none transition-colors hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35";

export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: { src: string; alt: string }[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const controls = useRef<ZoomControls>(null);
  const zoom = (kind: "in" | "out" | "reset") => controls.current?.zoom(kind);
  const open = index !== null;
  const current = index ?? 0;
  const many = images.length > 1;
  const [downloading, setDownloading] = useState(false);
  async function download() {
    const image = images[current];
    if (!image || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(image.src, { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "img";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ysocial-image-${image.src.split("/").at(-1)?.slice(0, 8) ?? current + 1}.${extension}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.add({ type: "error", title: "Couldn't download the image" });
    } finally {
      setDownloading(false);
    }
  }
  const go = (direction: 1 | -1) => {
    const next = current + direction;
    if (next >= 0 && next < images.length) onIndexChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "+" || event.key === "=") zoom("in");
      else if (event.key === "-") zoom("out");
      else if (event.key === "0") zoom("reset");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          aria-label={many ? `Image ${current + 1} of ${images.length}` : "Image"}
          className="fixed inset-0 z-50 flex flex-col outline-none transition-[opacity,transform] duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
        >
          <DialogPrimitive.Title className="sr-only">Image viewer</DialogPrimitive.Title>
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-sm text-white/85">
            <span className="tabular-nums" aria-live="polite">{many ? `${current + 1} / ${images.length}` : ""}</span>
            <div className="flex items-center gap-2">
              <button type="button" className={control} aria-label="Download image" disabled={downloading} onClick={() => void download()}>
                <Download className="size-5" aria-hidden="true" />
              </button>
              <button type="button" className={control} aria-label="Zoom out" disabled={!zoomed} onClick={() => zoom("out")}>
                <Minus className="size-5" aria-hidden="true" />
              </button>
              <button type="button" className={control} aria-label="Zoom in" onClick={() => zoom("in")}>
                <Plus className="size-5" aria-hidden="true" />
              </button>
              <button type="button" className={control} aria-label="Reset zoom" disabled={!zoomed} onClick={() => zoom("reset")}>
                <RotateCcw className="size-4.5" aria-hidden="true" />
              </button>
              <DialogPrimitive.Close className={control} aria-label="Close image">
                <X className="size-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {open && images[current] && (
              <ZoomableImage
                key={images[current].src}
                src={images[current].src}
                alt={images[current].alt}
                onSwipe={go}
                onZoomChange={setZoomed}
                ref={controls}
              />
            )}
            {many && !zoomed && (
              <>
                <button type="button" aria-label="Previous image" disabled={current === 0} onClick={() => go(-1)}
                  className={cn(control, "absolute top-1/2 left-3 -translate-y-1/2 max-sm:hidden")}>
                  <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Next image" disabled={current === images.length - 1} onClick={() => go(1)}
                  className={cn(control, "absolute top-1/2 right-3 -translate-y-1/2 max-sm:hidden")}>
                  <ChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {many && (
            <div className="flex shrink-0 justify-center gap-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-hidden="true">
              {images.map((image, dot) => (
                <span key={image.src} className={cn("size-1.5 rounded-full transition-colors", dot === current ? "bg-white" : "bg-white/35")} />
              ))}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
