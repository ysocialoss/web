import { isWebsiteLink, splitPostLinks, type PostLink } from "../feed/post-links.ts";

type LinkTarget = { href: string; hostname: string };
const profilePath = /^\/@([a-z0-9_]{3,32})\/?$/;

export type MessageEmbed =
  | (LinkTarget & { kind: "post"; link: Extract<PostLink, { kind: "post" }> })
  | (LinkTarget & { kind: "profile"; handle: string })
  | (LinkTarget & { kind: "youtube"; videoId: string })
  | (LinkTarget & { kind: "image" | "website" | "link" });

function youtubeId(url: URL) {
  const { hostname, pathname, searchParams } = url;
  let id: string | null | undefined;
  if (hostname === "youtu.be") {
    id = /^\/([^/]+)\/?$/.exec(pathname)?.[1];
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(hostname)) {
    id = pathname === "/watch" ? searchParams.get("v") : /^\/(?:shorts|live|embed)\/([^/]+)\/?$/.exec(pathname)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

function embedFor(link: PostLink, origin?: string): MessageEmbed | undefined {
  const url = new URL(link.href);
  if (url.username || url.password) return;
  const target = { href: url.href, hostname: url.hostname };
  if (link.kind === "post") return { ...target, kind: "post", link };
  const handle = url.origin === origin ? profilePath.exec(url.pathname)?.[1] : undefined;
  if (handle) return { ...target, kind: "profile", handle };
  const host = url.hostname.replace(/\.$/, "");
  if (url.protocol !== "https:" || !host.includes(".") || !isWebsiteLink(link) || /\.(?:local|localhost|internal)$/i.test(host)) {
    return { ...target, kind: "link" };
  }
  const videoId = youtubeId(url);
  if (videoId) return { ...target, kind: "youtube", videoId };
  if (/\.(?:png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) return { ...target, kind: "image" };
  return { ...target, kind: "website" };
}

export function messageLinks(text: string, development = false, origin?: string) {
  const parts = splitPostLinks(text, development, origin);
  const embeds = new Map<string, MessageEmbed>();
  for (const part of parts) {
    if (part.kind === "text") continue;
    const embed = embedFor(part, origin);
    if (embed && !embeds.has(embed.href)) embeds.set(embed.href, embed);
    if (embeds.size === 3) break;
  }
  return { parts, embeds: [...embeds.values()] };
}

export async function readPreviewHtml(href: string, signal: AbortSignal) {
  const response = await fetch(href, {
    signal, mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error",
  });
  if (!response.ok || !/^text\/html(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel();
    return "";
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  let remaining = 64 * 1024;
  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value.subarray(0, remaining), { stream: true });
      remaining -= value.length;
    }
    return html + decoder.decode();
  } finally {
    void reader.cancel().catch(() => {});
  }
}
