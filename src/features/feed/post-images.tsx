import { useState } from "react";
import { postImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ImageViewer } from "./image-viewer";

export function PostImages({ ids, compact = false }: { ids: string[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!ids.length) return null;
  const images = ids.map((id, index) => ({
    src: postImageUrl(id),
    alt: ids.length === 1 ? "Attached image" : `Attached image ${index + 1}`,
  }));
  return (
    <>
      <span className={cn("pointer-events-auto mt-2 grid max-w-xl gap-2", ids.length > 1 && "grid-cols-2")}>
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            aria-label={`Open ${image.alt.toLowerCase()}`}
            data-track="media"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(index);
            }}
            className="block w-fit max-w-full cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={image.src} alt={image.alt}
              loading="lazy" decoding="async"
              className={cn("w-auto max-w-full rounded-xl object-contain", compact ? "max-h-40" : "max-h-96")} />
          </button>
        ))}
      </span>
      <ImageViewer images={images} index={open} onIndexChange={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
