import { useCallback, useEffect, useRef, useState } from "react";
import { Download, File as FileIcon, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import {
  Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle,
} from "@/components/ui/attachment";
import { Progress } from "@/components/ui/progress";
import { ImageViewer } from "@/features/feed/image-viewer";
import { dmApi, dmError } from "./dm-api";
import type { LocalDevice } from "./dm-crypto";
import { decryptFile, encryptFile, fileBinding, fileByteLimit } from "./dm-files";
import { prepareImage } from "./dm-images";
import { cleanFileName, type MessageFile } from "./message-payload";

/** Images shown inline after decryption; every other type is only offered as a download. */
const previewable = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export type FileDraft = {
  conversationId: string;
  name: string;
  size: number;
  state: "uploading" | "error" | "done";
  progress: number;
  error?: string;
  file?: MessageFile;
};

/** Encrypts and uploads one picked file while the person writes an optional caption. */
export function useFileDraft(conversationId: string, device: LocalDevice) {
  const [draft, setDraft] = useState<FileDraft | null>(null);
  const picked = useRef<File | null>(null);
  const upload = useRef<AbortController | null>(null);

  useEffect(() => () => upload.current?.abort(), []);
  // Switching conversations drops the abandoned upload; its staged object expires on the server.
  useEffect(() => () => upload.current?.abort(), [conversationId]);

  const start = useCallback(async (file: File) => {
    upload.current?.abort();
    const controller = new AbortController();
    upload.current = controller;
    picked.current = file;
    setDraft({ conversationId, name: cleanFileName(file.name), size: file.size, progress: 0, state: "uploading" });
    // Photos become resized, metadata-free WebP before encryption; other files go as they are.
    const prepared = await prepareImage(file);
    if (controller.signal.aborted) return;
    file = prepared;
    const name = cleanFileName(file.name);
    const base = { conversationId, name, size: file.size, progress: 0 };
    if (file.size > fileByteLimit) {
      setDraft({ ...base, state: "error", error: "Files can be up to 25 MB." });
      return;
    }
    setDraft({ ...base, state: "uploading" });
    try {
      const id = crypto.randomUUID();
      const mime = /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type.toLowerCase() : "application/octet-stream";
      const { data, key, iv } = await encryptFile(file, fileBinding(conversationId, id));
      controller.signal.throwIfAborted();
      await dmApi.upload(conversationId, device, id, data as Uint8Array<ArrayBuffer>, {
        signal: controller.signal,
        onProgress: (progress) => setDraft((current) => current && { ...current, progress }),
      });
      if (controller.signal.aborted) return;
      setDraft({ ...base, state: "done", progress: 1, file: { id, key, iv, mime, name, size: file.size } });
    } catch (error) {
      if (controller.signal.aborted) return;
      setDraft({ ...base, state: "error", error: dmError(error) });
    }
  }, [conversationId, device]);

  const clear = useCallback(() => {
    upload.current?.abort();
    picked.current = null;
    setDraft(null);
  }, []);

  const retry = useCallback(() => {
    if (picked.current) void start(picked.current);
  }, [start]);

  return { draft: draft?.conversationId === conversationId ? draft : null, attach: start, clear, retry };
}

export function FileDraftChip({ draft, onRemove, onRetry }: { draft: FileDraft; onRemove: () => void; onRetry: () => void }) {
  return (
    <div className="border-b border-border/70 px-2 py-1.5">
      <Attachment state={draft.state} size="sm" className="max-w-full">
        <AttachmentMedia>
          {draft.state === "uploading" ? <LoaderCircle aria-hidden="true" className="animate-spin" />
            : draft.state === "error" ? <TriangleAlert aria-hidden="true" /> : <FileIcon aria-hidden="true" />}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{draft.name}</AttachmentTitle>
          <AttachmentDescription role={draft.state === "error" ? "alert" : undefined}>
            {draft.state === "error" ? draft.error
              : draft.state === "uploading" ? `Encrypting and uploading · ${Math.round(draft.progress * 100)}%`
              : `${formatBytes(draft.size)} · end-to-end encrypted`}
          </AttachmentDescription>
          {draft.state === "uploading" && <Progress value={Math.round(draft.progress * 100)} aria-label="Upload progress" className="mt-1" />}
        </AttachmentContent>
        <AttachmentActions>
          {draft.state === "error" && draft.size <= fileByteLimit && (
            <AttachmentAction aria-label="Retry upload" onClick={onRetry}><RotateCcw aria-hidden="true" /></AttachmentAction>
          )}
          <AttachmentAction aria-label="Remove file" onClick={onRemove}><X aria-hidden="true" /></AttachmentAction>
        </AttachmentActions>
      </Attachment>
    </div>
  );
}

async function openFile(conversationId: string, file: MessageFile, signal: AbortSignal) {
  const data = await dmApi.download(conversationId, file.id, AbortSignal.any([signal, AbortSignal.timeout(60_000)]));
  return decryptFile(data as Uint8Array<ArrayBuffer>, file.key, file.iv, file.mime, fileBinding(conversationId, file.id));
}

export function FileMessage({ file, conversationId }: { file: MessageFile; conversationId: string }) {
  const image = previewable.has(file.mime);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [url, setUrl] = useState<string>();
  const [viewing, setViewing] = useState(false);
  const loading = useRef<AbortController | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => loading.current?.abort(), []);

  async function decrypt() {
    if (url) return url;
    if (loading.current) return;
    const request = new AbortController();
    loading.current = request;
    setState("loading");
    try {
      // Non-image files are handed over as a generic download so the browser never renders them.
      const blob = await openFile(conversationId, file, request.signal);
      const typed = image ? blob : new Blob([blob], { type: "application/octet-stream" });
      if (request.signal.aborted) return;
      const created = URL.createObjectURL(typed);
      setUrl(created);
      setState("ready");
      return created;
    } catch {
      if (!request.signal.aborted) setState("failed");
    } finally {
      loading.current = null;
    }
  }

  async function download() {
    const href = await decrypt();
    if (!href) return;
    const link = document.createElement("a");
    link.href = href;
    link.download = file.name;
    link.rel = "noopener";
    link.click();
  }

  if (image && state === "ready" && url) {
    return (
      <>
        <button type="button" className="block overflow-hidden rounded-lg" onClick={() => setViewing(true)} aria-label={`Open ${file.name}`}>
          <img src={url} alt={file.name} className="max-h-72 max-w-full object-contain" />
        </button>
        <ImageViewer images={[{ src: url, alt: file.name }]} index={viewing ? 0 : null} onIndexChange={() => {}} onClose={() => setViewing(false)} />
      </>
    );
  }

  return (
    <Attachment state={state === "failed" ? "error" : state === "loading" ? "uploading" : "done"} size="sm" className="max-w-72">
      <AttachmentMedia>
        {state === "loading" ? <LoaderCircle aria-hidden="true" className="animate-spin" />
          : state === "failed" ? <TriangleAlert aria-hidden="true" /> : <FileIcon aria-hidden="true" />}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{file.name}</AttachmentTitle>
        <AttachmentDescription>
          {state === "failed" ? "Couldn’t open this file." : formatBytes(file.size)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label={image ? `Show ${file.name}` : `Download ${file.name}`} disabled={state === "loading"}
          onClick={() => void (image ? decrypt() : download())}>
          {state === "failed" ? <RotateCcw aria-hidden="true" /> : <Download aria-hidden="true" />}
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
}
