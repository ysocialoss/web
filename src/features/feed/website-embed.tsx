import { useState } from "react";
import { api, type WebsitePreview } from "@/lib/api";
import { ExternalLink } from "@/components/ui/external-link";
import { WebsiteIcon } from "./website-icon";

export function WebsiteEmbed({
  postId,
  preview,
  images,
}: {
  postId: string;
  preview: WebsitePreview;
  images: ReadonlySet<string>;
}) {
  const image =
    preview.imageKey && api.websitePreviewImage(postId, preview.imageKey);
  const imageSrc = image && images.has(image) ? image : undefined;
  if (preview.kind === "image") {
    return imageSrc ? (
      <ImgurImageEmbed href={preview.href} src={imageSrc} />
    ) : null;
  }
  const icon =
    preview.iconKey && api.websitePreviewIcon(postId, preview.iconKey);
  const iconSrc = icon && images.has(icon) ? icon : undefined;

  return (
    <div className="mt-3">
      <ExternalLink
        href={preview.href}
        className="block max-w-[25rem] overflow-hidden rounded-lg border bg-card text-sm text-card-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {imageSrc && <PreviewImage src={imageSrc} />}
        <span className="block space-y-1 px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <WebsiteIcon src={iconSrc} />
            <span className="truncate">{new URL(preview.href).hostname}</span>
          </span>
          <span className="line-clamp-2 font-medium wrap-anywhere">
            {preview.title}
          </span>
          {preview.description && (
            <span className="block truncate text-muted-foreground">
              {preview.description}
            </span>
          )}
        </span>
      </ExternalLink>
    </div>
  );
}

function ImgurImageEmbed({ href, src }: { href: string; src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="mt-3">
      <ExternalLink
        href={href}
        className="inline-block max-w-full overflow-hidden rounded-lg border align-top outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img
          src={src}
          alt="Imgur image"
          decoding="async"
          onError={() => setFailed(true)}
          className="max-h-96 max-w-full object-contain"
        />
      </ExternalLink>
    </div>
  );
}

function PreviewImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <span className="block aspect-[2/1] border-b bg-black">
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-contain"
      />
    </span>
  );
}
