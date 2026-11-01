import { createSignal, For, onCleanup } from "solid-js";
import Composer from "~/components/Composer";
import Post from "~/components/Post";
import { type PostData, type PostDraft } from "~/lib/posts";

export default function Feed() {
  const [posts, setPosts] = createSignal<PostData[]>([]);
  const publishedUrls = new Set<string>();
  onCleanup(() => publishedUrls.forEach((url) => URL.revokeObjectURL(url)));

  function publish(draft: PostDraft) {
    draft.attachments.forEach((attachment) =>
      publishedUrls.add(attachment.url),
    );
    setPosts((current) => [
      {
        ...draft,
        createdAt: Date.now(),
        likes: 0,
        comments: 0,
        liked: false,
        reposted: false,
        community: false,
      },
      ...current,
    ]);
  }

  return (
    <>
      <Composer onPost={publish} />
      <section aria-label="Feed posts">
        <For each={posts()}>{(post) => <Post post={post} />}</For>
      </section>
    </>
  );
}
