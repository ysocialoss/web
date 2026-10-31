import type { MediaPostType, PostType } from "~/lib/post-types";

export type PostAttachment = {
  name: string;
  url: string;
  size: number;
  kind: MediaPostType;
};

export type PostDraft = { type: PostType; text: string; attachments: PostAttachment[] };
export type PostData = { text: string; createdAt: number; likes: number; comments: number; liked: boolean; reposted: boolean; community: boolean; type?: PostType; attachments?: PostAttachment[] };
