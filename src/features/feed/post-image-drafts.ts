import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";

const maxImages = 4;
const maxBytes = 8 * 1024 * 1024;
export const postImageAccept = "image/jpeg,image/png,image/webp";

type CheckingImage = { status: "checking"; file: File; previewUrl: string };
type ReadyImage = { status: "ready"; id: string; previewUrl: string };
type ImageDraft = CheckingImage | ReadyImage;

function discard(id: string) {
  void api.discardPostImage(id).catch(() => {
    // The server expires drafts that could not be removed.
  });
}

export function usePostImageDrafts(viewerId: string | null) {
  const [cards, setCards] = useState<ImageDraft[]>([]);
  const [error, setError] = useState("");
  const drafts = useRef<ImageDraft[]>([]);
  const active = useRef<AbortController | null>(null);

  function update(next: ImageDraft[]) {
    drafts.current = next;
    setCards(next);
  }

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
    for (const draft of drafts.current) {
      URL.revokeObjectURL(draft.previewUrl);
      if (draft.status === "ready") discard(draft.id);
    }
    drafts.current = [];
  }, []);

  async function add(files: File[]) {
    if (!files.length || !viewerId || active.current) return;
    const available = maxImages - drafts.current.length;
    if (files.length > available) {
      setError("You can attach up to four images.");
      return;
    }
    setError("");
    const pending: CheckingImage[] = [];
    for (const file of files) {
      if (file.size > maxBytes) {
        setError(`${file.name} exceeds the 8 MB limit.`);
        continue;
      }
      pending.push({ status: "checking", file, previewUrl: URL.createObjectURL(file) });
    }
    if (!pending.length) return;
    const controller = new AbortController();
    active.current = controller;
    update([...drafts.current, ...pending]);
    try {
      for (const draft of pending) {
        try {
          const { id } = await api.uploadPostImage(draft.file, controller.signal);
          if (controller.signal.aborted) {
            discard(id);
            return;
          }
          const ready: ReadyImage = { status: "ready", id, previewUrl: draft.previewUrl };
          update(drafts.current.map((card) => card === draft ? ready : card));
        } catch (cause) {
          if (controller.signal.aborted) return;
          URL.revokeObjectURL(draft.previewUrl);
          update(drafts.current.filter((card) => card !== draft));
          setError(`${draft.file.name}. ${errorMessage(cause)}`);
        }
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
      }
    }
  }

  function remove(draft: ReadyImage) {
    URL.revokeObjectURL(draft.previewUrl);
    update(drafts.current.filter((card) => card !== draft));
    setError("");
    discard(draft.id);
  }

  function handOff() {
    drafts.current.forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
    update([]);
    setError("");
  }

  const ids = cards.filter((card) => card.status === "ready").map((card) => card.id);
  const busy = cards.some((card) => card.status === "checking");
  return { cards, ids, busy, error, add, remove, handOff, full: cards.length >= maxImages };
}
