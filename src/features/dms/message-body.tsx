import { Fragment, memo, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { messageLinks, type MessageEmbed } from "./message-links";
import { LinkCard, PostCard } from "./embeds";

const visibleLink = "text-primary underline underline-offset-2 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring";

function MessageLink({ href, children, className }: { href: string; children: ReactNode; className: string }) {
  const url = new URL(href);
  return url.origin === globalThis.location?.origin
    ? <Link to={href} className={className}>{children}</Link>
    : <ExternalLink href={href} className={className}>{children}</ExternalLink>;
}

export const MessageBody = memo(function MessageBody({ text }: { text: string }) {
  const { parts, embeds } = messageLinks(text, import.meta.env.DEV, globalThis.location?.origin);
  const onlyPost = embeds.length === 1 && embeds[0].kind === "post" && parts.every((part) => part.kind !== "text" || !part.text.trim());
  return (
    <div className="min-w-0">
      {!onlyPost && <p dir="auto" className="text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.kind === "text") return <Fragment key={index}>{part.text}</Fragment>;
          const url = new URL(part.href);
          if (url.username || url.password) return <Fragment key={index}>{part.text}</Fragment>;
          return <MessageLink key={index} href={part.href} className={visibleLink}><bdi>{part.text}</bdi></MessageLink>;
        })}
      </p>}
      {embeds.length > 0 && (
        <div className="mt-2 max-w-md space-y-2">
          {embeds.map((embed) => embed.kind === "post" ? <PostCard key={embed.href} postId={embed.link.postId} href={embed.href} />
            : embed.kind === "website" ? <LinkCard key={embed.href} href={embed.href} />
            : <MediaEmbed key={embed.href} embed={embed} />)}
        </div>
      )}
    </div>
  );
});

function MediaEmbed({ embed }: { embed: MessageEmbed }) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  if (embed.kind !== "youtube" && embed.kind !== "image") return null;
  const label = embed.kind === "youtube" ? "Load video" : "Show image";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-sm">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <Globe aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <MessageLink href={embed.href} className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          <bdi>{embed.hostname}</bdi>
        </MessageLink>
        {!shown && <Button type="button" size="sm" variant="ghost" onClick={() => setShown(true)}>{label}</Button>}
      </div>
      {failed && <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">Preview unavailable</p>}
      {shown && embed.kind === "image" && !failed && (
        <img alt="Shared image" src={embed.href} referrerPolicy="no-referrer" decoding="async" className="block max-h-80 w-full border-t object-contain" onError={() => setFailed(true)} />
      )}
      {shown && embed.kind === "youtube" && (
        <iframe title="YouTube video" src={`https://www.youtube-nocookie.com/embed/${embed.videoId}`}
          referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="aspect-video w-full border-t" />
      )}
    </div>
  );
}
