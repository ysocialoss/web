import { postImageUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export function PostImages({ ids, compact = false }: { ids: string[]; compact?: boolean }) {
  if (!ids.length) return null;
  return (
    <span className={cn("mt-2 grid max-w-xl gap-2", ids.length > 1 && "grid-cols-2")}>
      {ids.map((id, index) => (
        <img key={id} src={postImageUrl(id)}
          alt={ids.length === 1 ? "Attached image" : `Attached image ${index + 1}`}
          loading="lazy" decoding="async"
          className={cn("w-auto max-w-full rounded-xl object-contain", compact ? "max-h-40" : "max-h-96")} />
      ))}
    </span>
  );
}
