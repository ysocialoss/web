import { useRef, useState } from "react";
import { initialPosts, type Post } from "./data";

export function useFeed() {
  const [feedPosts, setFeedPosts] = useState(initialPosts);
  const [draft, setDraft] = useState("");
  const nextPostId = useRef(4);
  const [likedPosts, setLikedPosts] = useState<number[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<number[]>([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<number[]>([]);
  const [shareCounts, setShareCounts] = useState<Record<number, number>>({});
  const [shareStatus, setShareStatus] = useState("");

  function publishPost() {
    if (!draft.trim()) return;
    const post = {
      id: nextPostId.current++,
      name: "User",
      handle: "user",
      initials: "U",
      time: "now",
      text: draft.trim(),
      likes: 0,
      replies: 0,
      reposts: 0,
      shares: 0,
      bookmarks: 0,
    };
    setFeedPosts((current) => [post, ...current]);
    setDraft("");
  }

  async function sharePost(post: Post) {
    const url = new URL(window.location.href);
    url.hash = `post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.name}`,
          text: post.text,
          url: url.href,
        });
      } else {
        await navigator.clipboard.writeText(url.href);
        setShareStatus("Post link copied");
      }
      setShareCounts((current) => ({
        ...current,
        [post.id]: (current[post.id] ?? 0) + 1,
      }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setShareStatus("Unable to share this post");
      }
    }
  }

  return {
    feedPosts,
    draft,
    setDraft,
    publishPost,
    likedPosts,
    setLikedPosts,
    repostedPosts,
    setRepostedPosts,
    bookmarkedPosts,
    setBookmarkedPosts,
    shareCounts,
    shareStatus,
    sharePost,
  };
}

export type FeedState = ReturnType<typeof useFeed>;
