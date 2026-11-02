import { A, useParams } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  onCleanup,
  Show,
  Switch,
  Match,
} from "solid-js";
import Post from "~/components/Post";
import {
  deletePost,
  loadPost,
  PostError,
  savePost,
  type PostData,
} from "~/lib/posts";

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const [post, setPost] = createSignal<PostData | null>(null);
  const [offset, setOffset] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [missing, setMissing] = createSignal(false);
  const [deleted, setDeleted] = createSignal(false);
  const [attempt, setAttempt] = createSignal(0);
  createEffect(() => {
    const id = params.id;
    attempt();
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    setPost(null);
    setError("");
    setMissing(false);
    setDeleted(false);
    setLoading(true);
    void loadPost(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setOffset(Date.parse(result.serverNow) - Date.now());
        setPost(result.post);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (
          error instanceof PostError &&
          (error.status === 404 || error.code === "invalid_post_id")
        )
          setMissing(true);
        else
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this post. Please retry.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  });
  async function edit(id: string, content: string) {
    const result = await savePost(content, id);
    if (params.id !== id) return;
    setOffset(Date.parse(result.serverNow) - Date.now());
    setPost(result.post);
  }
  async function remove(id: string) {
    await deletePost(id);
    if (params.id !== id) return;
    setPost(null);
    setDeleted(true);
  }
  return (
    <section aria-label="Post">
      <A
        href="/"
        class="inline-block py-3 text-[#999] hover:text-white focus-visible:outline-[#00d363]"
      >
        ← Back to feed
      </A>
      <Switch>
        <Match when={loading()}>
          <p role="status" class="py-8 text-[#999]">
            Loading post…
          </p>
        </Match>
        <Match when={missing()}>
          <h1 class="mt-6 text-xl font-semibold">Post not found</h1>
          <p class="mt-3 text-[#999]">
            This post may have been deleted, or the link is incorrect.
          </p>
        </Match>
        <Match when={deleted()}>
          <p role="status" class="py-8 text-[#999]">
            Post deleted.
          </p>
        </Match>
        <Match when={error()}>
          <p role="alert" class="mt-6 text-red-300">
            {error()}
          </p>
          <button
            type="button"
            class="mt-3 rounded-xl border border-[#555] px-4"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry loading post
          </button>
        </Match>
        <Match when={post()}>
          <Show when={post()}>
            {(current) => (
              <Post
                post={current()}
                serverOffset={offset()}
                onEdit={edit}
                onDelete={remove}
                standalone
              />
            )}
          </Show>
        </Match>
      </Switch>
    </section>
  );
}
