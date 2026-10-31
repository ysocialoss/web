// POST /post types documented in api/README.md.
export const postTypeLabels = {
  text: "Text",
  image: "Images",
  gif: "GIF",
  video: "Video",
  voice: "Voice",
  live: "Live chat",
  streams: "Stream",
};
export type PostType = keyof typeof postTypeLabels;

export const mediaAccepts = {
  image: "image/*",
  gif: "image/gif",
  video: "video/*",
  voice: "audio/*",
};
export type MediaPostType = keyof typeof mediaAccepts;

export function isMediaPostType(type: PostType): type is MediaPostType {
  return type === "image" || type === "gif" || type === "video" || type === "voice";
}

export function acceptsPostMedia(type: MediaPostType, mime: string) {
  switch (type) {
    case "image": return mime.startsWith("image/") && mime !== "image/gif";
    case "gif": return mime === "image/gif";
    case "video": return mime.startsWith("video/");
    case "voice": return mime.startsWith("audio/");
  }
}

export function canPublishPost(draft: { type: PostType; text: string; mediaCount: number }) {
  if (isMediaPostType(draft.type)) return draft.mediaCount > 0;
  return draft.type === "live" || draft.type === "streams" || draft.text.trim().length > 0;
}
