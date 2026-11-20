import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ExternalPostLink } from "@/features/feed/external-post-link";
import { PostEmbed } from "@/features/feed/post-embed";
import { api, type Post } from "@/lib/api";
import { messageLinks, readPreviewHtml, type MessageEmbed } from "./message-links";

const visibleLink = "text-primary underline underline-offset-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring";
const noImages = new Set<string>();

function MessageLink({ href, children, className }: { href: string; children: ReactNode; className: string }) {
  const url = new URL(href);
  return url.origin === globalThis.location?.origin
    ? <Link to={href} className={className}>{children}</Link>
    : <ExternalPostLink href={href} className={className}>{children}</ExternalPostLink>;
}

export const MessageBody = memo(function MessageBody({ text }: { text: string }) {
  const { parts, embeds } = messageLinks(text, import.meta.env.DEV, globalThis.location?.origin);
  return (
    <div className="col-start-2 min-w-0">
      <p dir="auto" className="text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.kind === "text") return <Fragment key={index}>{part.text}</Fragment>;
          const url = new URL(part.href);
          if (url.username || url.password) return <Fragment key={index}>{part.text}</Fragment>;
          return <MessageLink key={index} href={part.href} className={visibleLink}><bdi>{part.text}</bdi></MessageLink>;
        })}
      </p>
      {embeds.length > 0 && (
        <div className="mt-2 max-w-sm space-y-2">
          {embeds.map((embed) => <LinkPreview key={embed.href} embed={embed} />)}
        </div>
      )}
    </div>
  );
});

type Preview =
  | { kind: "idle" | "loading" | "unavailable" | "media" }
  | { kind: "website"; title: string; description: string }
  | { kind: "post"; post: Post };

function websiteDetails(html: string) {
  // Template contents stay inert. Only plain text from metadata is rendered.
  const template = document.createElement("template");
  template.innerHTML = html;
  const meta = (selector: string) => template.content.querySelector(selector)?.getAttribute("content")?.trim();
  const title = meta('meta[property="og:title"]') || template.content.querySelector("title")?.textContent?.trim() || "";
  const description = meta('meta[property="og:description"]') || meta('meta[name="description"]') || "";
  return { title: title.slice(0, 160), description: description.slice(0, 240) };
}

function LinkPreview({ embed }: { embed: MessageEmbed }) {
  const [preview, setPreview] = useState<Preview>({ kind: "idle" });
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function load() {
    if (embed.kind === "link") return;
    if (embed.kind === "image" || embed.kind === "youtube") {
      setPreview({ kind: "media" });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]);
    setPreview({ kind: "loading" });
    try {
      if (embed.kind === "post") {
        const { post } = await api.postPreview(embed.link.postId, signal);
        if (!controller.signal.aborted) setPreview({ kind: "post", post });
      } else {
        const details = websiteDetails(await readPreviewHtml(embed.href, signal));
        if (!controller.signal.aborted) setPreview(details.title || details.description
          ? { kind: "website", ...details }
          : { kind: "unavailable" });
      }
    } catch {
      if (!controller.signal.aborted) setPreview({ kind: "unavailable" });
    }
  }

  if (preview.kind === "post" && embed.kind === "post") {
    return <PostEmbed link={embed.link} post={preview.post} images={noImages} />;
  }
  const buttonLabel = embed.kind === "youtube" ? "Load video" : embed.kind === "image" ? "Show image" : "Load preview";
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-sm">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <Globe aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <MessageLink href={embed.href} className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          <bdi>{preview.kind === "website" && preview.title ? preview.title : embed.kind === "post" ? "YSocial post" : embed.hostname}</bdi>
        </MessageLink>
        {embed.kind !== "link" && (preview.kind === "idle" || preview.kind === "loading") && (
          <Button type="button" size="sm" variant="ghost" disabled={preview.kind === "loading"} onClick={() => void load()}>
            {preview.kind === "loading" ? "Loading…" : buttonLabel}
          </Button>
        )}
      </div>
      {preview.kind === "website" && preview.description && <p dir="auto" className="line-clamp-2 px-3 pb-2 text-xs text-muted-foreground">{preview.description}</p>}
      {preview.kind === "unavailable" && <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">Preview unavailable</p>}
      {preview.kind === "media" && embed.kind === "image" && (
        <img alt="Shared image" src={embed.href} referrerPolicy="no-referrer" decoding="async" className="block max-h-80 w-full border-t object-contain"
          onError={() => setPreview({ kind: "unavailable" })} />
      )}
      {preview.kind === "media" && embed.kind === "youtube" && (
        <iframe title="YouTube video" src={`https://www.youtube-nocookie.com/embed/${embed.videoId}`}
          referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full border-t" />
      )}
    </div>
  );
}
