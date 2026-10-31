import type { PostAttachment } from "~/lib/posts";

export default function PostMedia(props: { attachment: PostAttachment; compact?: boolean }) {
  const media = props.attachment;
  switch (media.kind) {
    case "image":
    case "gif":
      return <img src={media.url} alt={media.name} class={props.compact ? "h-24 w-28 rounded-xl object-cover" : "max-h-72 w-full rounded-xl object-contain"} />;
    case "video":
      return <video src={media.url} controls preload="metadata" aria-label={media.name} class={props.compact ? "h-28 w-48 rounded-xl object-contain" : "max-h-80 w-full rounded-xl"} />;
    case "voice":
      return <audio src={media.url} controls preload="metadata" aria-label={media.name} class={props.compact ? "my-3 w-56 max-w-full" : "w-full"} />;
    default: {
      const exhaustive: never = media.kind;
      return exhaustive;
    }
  }
}
