import { find } from "linkifyjs";

const ownedHost = "ysocial.cns-preview.de";
const postPath = /^\/posts\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/i;

export type PostLink =
  | { kind: "external"; text: string; href: string }
  | { kind: "owned"; text: string; href: string }
  | {
      kind: "post";
      text: string;
      href: string;
      postId: string;
    };

export type PostPart = { kind: "text"; text: string } | PostLink;

export function splitPostLinks(content: string, development = false, origin?: string) {
  const parts: PostPart[] = [];
  let end = 0;
  for (const { match, url } of findWebLinks(content)) {
    if (match.start > end)
      parts.push({ kind: "text", text: content.slice(end, match.start) });
    end = match.end;

    const local = development && url.host === "localhost:3000";
    if (local && /^localhost:3000(?:[/?#]|$)/i.test(match.value))
      url.protocol = "http:";
    const owned =
      !url.username &&
      !url.password &&
      (local || url.origin === origin || (url.hostname === ownedHost && !url.port));
    const postId = owned ? postPath.exec(url.pathname)?.[1] : undefined;
    parts.push(
      postId
        ? {
            kind: "post",
            text: match.value,
            href: url.href,
            postId: postId.toLowerCase(),
          }
        : {
            kind: owned ? "owned" : "external",
            href: url.href,
            text: match.value,
          },
    );
  }
  if (end < content.length)
    parts.push({ kind: "text", text: content.slice(end) });
  return parts;
}

export function firstPostEmbed(parts: readonly PostPart[]) {
  return parts.find((part) => part.kind === "post" || isWebsiteLink(part));
}

export function isWebsiteLink(part: PostPart) {
  if (part.kind !== "external") return false;
  // Match the API's URL eligibility. The API also verifies DNS before fetching.
  const { hostname, port, username, password } = new URL(part.href);
  return (
    hostname.includes(".") &&
    !/^(?:\d+\.){3}\d+$/.test(hostname) &&
    !port &&
    !username &&
    !password
  );
}

function findWebLinks(content: string) {
  return find(content, "url", { defaultProtocol: "https" }).flatMap((match) => {
    const url = URL.parse(match.href);
    return url && (url.protocol === "http:" || url.protocol === "https:")
      ? [{ match, url }]
      : [];
  });
}
