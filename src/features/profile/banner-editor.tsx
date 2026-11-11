import { LiveCropperImage } from "./live-cropper-image";
import * as Cropper from "@zriz/react/cropper";
import { useZoom, type Cropper as CropperApi } from "@zriz/react";
import "@zriz/react/styles.css";
import type { BannerCrop } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function BannerEditor({
  bannerUrl,
  onSaved,
}: {
  bannerUrl: string | null;
  onSaved: (url: string | null, crop: BannerCrop | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Change profile banner"
        className="group absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="absolute inset-0 rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        <span className="relative flex items-center gap-2 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="size-4" aria-hidden="true" />
          {bannerUrl ? "Change banner" : "Add banner"}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Profile banner</DialogTitle>
          <DialogDescription className="sr-only">
            Upload an image or GIF, or choose an animated banner.
          </DialogDescription>
        </DialogHeader>
        <BannerPicker
          key={String(open)}
          current={bannerUrl}
          onSaved={(url, crop) => {
            onSaved(url, crop);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function BannerPicker({
  current,
  onSaved,
}: {
  current: string | null;
  onSaved: (url: string | null, crop: BannerCrop | null) => void;
}) {
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [selectedGif, setSelectedGif] = useState("");
  const [query, setQuery] = useState("cat");
  const [results, setResults] = useState<Awaited<
    ReturnType<typeof api.searchGifs>
  > | null>(null);
  const [page, setPage] = useState(1);
  const [searchedQuery, setSearchedQuery] = useState("");
  const scrollRoot = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [gifTab, setGifTab] = useState(false);
  const cropper = useRef<CropperApi>(null);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function choose(file: Blob | undefined) {
    if (!file) return;
    setError("");
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/gif",
      ].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Choose an image or GIF under 10 MB.");
      return;
    }
    setReady(false);
    setFile(file);
    setPreview(URL.createObjectURL(file));
  }
  const search = useCallback(
    async (pageNumber = 1) => {
      if (pageNumber > 1 && request.current && !request.current.signal.aborted)
        return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError("");
      const term = pageNumber === 1 ? query.trim() : searchedQuery;
      try {
        const response = await api.searchGifs(
          term,
          pageNumber,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setResults((previous) => {
          if (pageNumber === 1 || !previous) return response;
          const ids = new Set(previous.items.map((item) => item.id));
          const incoming = response.items.filter((item) => !ids.has(item.id));
          return {
            items: [...previous.items, ...incoming],
            hasNext: response.hasNext && incoming.length > 0,
          };
        });
        if (pageNumber === 1) scrollRoot.current?.scrollTo({ top: 0 });
        setPage(pageNumber);
        setSearchedQuery(term);
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error));
      } finally {
        if (request.current === controller) {
          request.current = null;
          if (!controller.signal.aborted) setLoading(false);
        }
      }
    },
    [query, searchedQuery],
  );
  useEffect(() => {
    const root = scrollRoot.current;
    const target = sentinel.current;
    if (
      !root ||
      !target ||
      !gifTab ||
      preview ||
      busy ||
      loading ||
      error ||
      !results?.hasNext
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void search(page + 1);
      },
      { root, rootMargin: "0px 0px 480px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [gifTab, preview, busy, loading, error, results, page, search]);
  async function save(remove = false) {
    if (busy || (!file && !selectedGif && !remove)) return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    const value = cropper.current?.getValue();
    const crop = value
      ? {
          x: Math.max(0, value.center.x - value.size.width / 2),
          y: Math.max(0, value.center.y - value.size.height / 2),
          width: Math.min(1, value.size.width),
          height: Math.min(1, value.size.height),
        }
      : null;
    try {
      if (!remove && !crop) throw new Error("Crop is not ready");
      if (remove) {
        await api.removeBanner();
        onSaved(null, null);
      } else if (selectedGif && crop) {
        const result = await api.selectBannerGif(
          selectedGif,
          crop,
          controller.signal,
        );
        onSaved(result.bannerUrl, crop);
      } else if (file && crop) {
        const result = await api.uploadBanner(file, crop, controller.signal);
        onSaved(result.bannerUrl, crop);
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="grid gap-4">
      {!preview && (
        <Tabs
          defaultValue="upload"
          onValueChange={(value) => {
            setGifTab(value === "gifs");
            if (!busy) {
              request.current?.abort();
              setLoading(false);
              setFile(null);
              setPreview(null);
              setSelectedGif("");
              setError("");
              if (value === "gifs" && !results) void search();
            }
          }}
        >
          <TabsList className="mb-2 w-full">
            <TabsTrigger value="upload" disabled={busy}>
              Upload image / GIF
            </TabsTrigger>
            <TabsTrigger value="gifs" disabled={busy}>
              Select GIF
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <input
              ref={input}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              onClick={(event) => {
                event.currentTarget.value = "";
              }}
              onChange={(event) => {
                setSelectedGif("");
                choose(event.target.files?.[0]);
              }}
            />
            {!preview ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  choose(event.dataTransfer.files[0]);
                }}
                className={`flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragging ? "border-primary bg-primary/10" : "border-border bg-muted/40 hover:bg-muted"}`}
              >
                <ImagePlus className="size-6" />
                <span>Drop an image or GIF here, or click to browse</span>
                <span className="text-xs text-muted-foreground">
                  3:1 banner · Up to 10 MB
                </span>
              </button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <ImagePlus />
                Replace
              </Button>
            )}
          </TabsContent>
          <TabsContent value="gifs" className="grid gap-3">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void search();
              }}
            >
              <input
                aria-label="Search KLIPY"
                placeholder="Search KLIPY"
                value={query}
                maxLength={100}
                disabled={busy}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" disabled={loading || busy}>
                Search
              </Button>
            </form>
            <div
              className="max-h-80 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain"
              aria-label="GIF results"
              ref={scrollRoot}
              aria-busy={loading}
            >
              <div className="columns-2 gap-2 sm:columns-3">
                {results?.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.title}
                    aria-pressed={selectedGif === item.token}
                    disabled={busy}
                    onClick={() => {
                      setReady(false);
                      setSelectedGif(item.token);
                      setFile(null);
                      setPreview(item.url);
                      setError("");
                    }}
                    className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg border-2 border-transparent outline-none aria-pressed:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <img
                      src={item.previewUrl}
                      width={item.width ?? 220}
                      height={item.height ?? 165}
                      alt={item.title}
                      loading="lazy"
                      className="h-auto w-full"
                    />
                  </button>
                ))}
              </div>
              <div ref={sentinel} className="h-px" aria-hidden="true" />
              {loading && results && (
                <p
                  role="status"
                  className="py-3 text-center text-xs text-muted-foreground"
                >
                  Loading more GIFs…
                </p>
              )}
            </div>
            {results?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No GIFs found. Try another search.
              </p>
            )}
            {!results && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Search for a GIF, or press Search to browse trending.
              </p>
            )}
            {error && results?.hasNext && (
              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => void search(page + 1)}
              >
                Retry loading GIFs
              </Button>
            )}
            <a
              href="https://klipy.com"
              target="_blank"
              rel="noreferrer"
              className="text-right text-xs text-muted-foreground"
            >
              <img
                src="/klipy/powered-by-klipy.svg"
                alt="Powered by KLIPY"
                className="ml-auto h-5 w-auto"
              />
            </a>
          </TabsContent>
        </Tabs>
      )}
      {loading && !results && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading GIF…
        </p>
      )}
      {preview && (
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setFile(null);
                setSelectedGif("");
                setReady(false);
              }}
            >
              Choose another
            </Button>
          </div>
          <Cropper.Root
            key={preview}
            src={file ?? preview}
            actionsRef={cropper}
            aspect={3}
            maxZoom={5}
            svg={false}
            disabled={busy}
            onLoad={() => setReady(true)}
            onError={() => {
              setReady(false);
              setError("This image could not open. Choose another file.");
            }}
            className="grid gap-3"
          >
            <Cropper.Viewport
              wheel="zoom"
              className="h-72 w-full overflow-hidden rounded-xl bg-muted"
              style={{ padding: 24 }}
            >
              <LiveCropperImage src={preview} />
              <Cropper.Mask />
              <Cropper.Area aria-label="Banner crop area">
                <Cropper.Handle position="top-left" />
                <Cropper.Handle position="top-right" />
                <Cropper.Handle position="bottom-left" />
                <Cropper.Handle position="bottom-right" />
              </Cropper.Area>
            </Cropper.Viewport>
            <BannerZoom />
          </Cropper.Root>
          {selectedGif && (
            <img
              src="/klipy/powered-by-klipy.svg"
              alt="Powered by KLIPY"
              className="ml-auto h-5 w-auto"
            />
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        {current ? (
          <Button
            variant="ghost"
            disabled={busy || loading}
            onClick={() => void save(true)}
          >
            <Trash2 />
            Remove
          </Button>
        ) : (
          <span />
        )}
        <Button
          size="icon"
          aria-label={busy ? "Saving banner" : "Save banner"}
          disabled={!ready || (!file && !selectedGif) || busy || loading}
          onClick={() => void save()}
        >
          <Check />
        </Button>
      </div>
    </div>
  );
}

function BannerZoom() {
  const zoom = useZoom();
  return (
    <label className="flex items-center gap-3 text-sm">
      Zoom
      <input
        aria-label="Banner zoom"
        type="range"
        className="min-w-0 flex-1 accent-primary"
        min={zoom.min}
        max={zoom.max}
        step={0.01}
        value={zoom.value}
        onChange={(event) => zoom.onValueChange(event.target.valueAsNumber)}
        onPointerUp={zoom.onValueCommitted}
        onKeyUp={zoom.onValueCommitted}
      />
    </label>
  );
}
