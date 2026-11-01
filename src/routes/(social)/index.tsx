import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import Composer from "~/components/Composer";
import Post from "~/components/Post";
import { deletePost, loadPosts, savePost, type PostData } from "~/lib/posts";
import { useSocial } from "~/lib/social-context";

export default function Feed() {
  const social = useSocial();
  const [posts, setPosts] = createSignal<PostData[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [loaded, setLoaded] = createSignal(false);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [offset, setOffset] = createSignal(0);
  const controller = new AbortController();
  const deleted = new Set<string>();
  const changed = new Map<string, PostData>();
  let sentinel: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;
  let disposed = false;
  let inFlight = false;
  function calibrate(serverNow: string) {
    setOffset(Date.parse(serverNow) - Date.now());
  }
  function nearBottom() {
    const root = social.scrollRoot();
    return (
      root &&
      sentinel &&
      sentinel.getBoundingClientRect().top <=
        root.getBoundingClientRect().bottom + 400
    );
  }
  async function next() {
    if (inFlight || disposed || (loaded() && cursor() === null)) return;
    inFlight = true;
    setLoading(true);
    setError("");
    try {
      const page = await loadPosts(cursor(), controller.signal);
      if (disposed) return;
      calibrate(page.serverNow);
      setPosts((current) => {
        const ids = new Set(current.map((post) => post.id));
        return [
          ...current,
          ...page.posts
            .filter((post) => !ids.has(post.id) && !deleted.has(post.id))
            .map((post) => changed.get(post.id) || post),
        ];
      });
      setCursor(page.nextCursor);
      setLoaded(true);
    } catch (error) {
      if (!disposed)
        setError(
          error instanceof Error
            ? error.message
            : "Could not load posts. Please retry.",
        );
    } finally {
      inFlight = false;
      if (!disposed) {
        setLoading(false);
        // A short page or deletion may leave the sentinel inside the preload area.
        requestAnimationFrame(() => {
          if (!disposed && !error() && nearBottom()) void next();
        });
      }
    }
  }
  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !error())
          void next();
      },
      { root: social.scrollRoot(), rootMargin: "0px 0px 400px 0px" },
    );
    if (sentinel) observer.observe(sentinel);
    void next();
  });
  onCleanup(() => {
    disposed = true;
    controller.abort();
    observer?.disconnect();
  });
  async function publish(content: string) {
    const result = await savePost(content);
    if (disposed) return;
    calibrate(result.serverNow);
    setPosts((current) => [
      result.post,
      ...current.filter((post) => post.id !== result.post.id),
    ]);
  }
  async function edit(id: string, content: string) {
    const result = await savePost(content, id);
    if (disposed) return;
    calibrate(result.serverNow);
    changed.set(id, result.post);
    setPosts((current) =>
      current.map((post) => (post.id === id ? result.post : post)),
    );
  }
  async function remove(id: string) {
    await deletePost(id);
    if (disposed) return;
    deleted.add(id);
    changed.delete(id);
    setPosts((current) => current.filter((post) => post.id !== id));
    requestAnimationFrame(() => {
      if (!disposed && !error() && nearBottom()) void next();
    });
  }
  return (
    <>
      <Composer onPost={publish} />
      <section aria-label="Feed posts" aria-busy={loading()}>
        <For each={posts()}>
          {(post) => (
            <Post
              post={post}
              serverOffset={offset()}
              onEdit={edit}
              onDelete={remove}
            />
          )}
        </For>
        <Show when={loaded() && !posts().length && !loading() && !error()}>
          <p class="py-10 text-center text-[#999]">
            No posts yet. Be the first to share something.
          </p>
        </Show>
        <Show when={loading()}>
          <p role="status" class="py-6 text-center text-[#999]">
            {loaded() ? "Loading more posts…" : "Loading posts…"}
          </p>
        </Show>
        <Show when={error()}>
          <div class="py-6 text-center">
            <p role="alert" class="text-red-300">
              {error()}
            </p>
            <button
              type="button"
              class="mt-3 rounded-xl border border-[#555] px-4"
              onClick={() => void next()}
            >
              Retry loading posts
            </button>
          </div>
        </Show>
        <Show when={loaded() && cursor() === null && posts().length > 0}>
          <p role="status" class="py-6 text-center text-sm text-[#999]">
            You're all caught up.
          </p>
        </Show>
        <div ref={sentinel} class="h-px" aria-hidden="true" />
      </section>
    </>
  );
}
