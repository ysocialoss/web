import { A } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import Post from "~/components/Post";
import { useSocial } from "~/lib/social-context";
import {
  characterCount,
  validContent,
  loadPosts,
  replyToPost,
  savePost,
  deletePost,
  type PostData,
  PostError,
} from "~/lib/posts";

export default function Replies(props: {
  postId: string;
  onCountChange: (delta: number) => void;
}) {
  const social = useSocial();
  const postId = createMemo(() => props.postId);
  const [replies, setReplies] = createSignal<PostData[]>([]);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [offset, setOffset] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [loadError, setLoadError] = createSignal("");
  const [draft, setDraft] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal("");
  let controller: AbortController;
  onMount(() => {
    if (window.location.hash === "#reply")
      document.getElementById("reply")?.focus();
  });
  createEffect(() => {
    const id = postId();
    const current = new AbortController();
    controller = current;
    onCleanup(() => current.abort());
    setReplies([]);
    setCursor(null);
    setDraft("");
    setError("");
    setSending(false);
    void load(id, null, current.signal);
  });
  async function load(id: string, page: string | null, signal: AbortSignal) {
    setLoading(true);
    setLoadError("");
    try {
      const result = await loadPosts(page, signal, id);
      if (signal.aborted) return;
      setReplies((existing) => {
        const seen = new Set(existing.map((reply) => reply.id));
        return [
          ...existing,
          ...result.posts.filter((reply) => !seen.has(reply.id)),
        ];
      });
      setCursor(result.nextCursor);
      setOffset(Date.parse(result.serverNow) - Date.now());
    } catch (error) {
      if (!signal.aborted)
        setLoadError(
          error instanceof Error ? error.message : "Could not load replies.",
        );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }
  async function publish() {
    if (
      sending() ||
      !validContent(draft()) ||
      social.auth().kind !== "signedIn"
    )
      return;
    const id = props.postId;
    const signal = controller.signal;
    setSending(true);
    setError("");
    try {
      const result = await replyToPost(id, draft().trim());
      if (signal.aborted) return;
      setReplies((existing) => [result.post, ...existing]);
      setOffset(Date.parse(result.serverNow) - Date.now());
      props.onCountChange(1);
      setDraft("");
    } catch (error) {
      if (signal.aborted) return;
      if (
        error instanceof PostError &&
        (error.status === 401 || error.code === "onboarding_required")
      )
        await social.reloadAuth();
      if (!signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Could not reply. Please retry.",
        );
    } finally {
      if (!signal.aborted) setSending(false);
    }
  }
  async function edit(id: string, content: string) {
    const signal = controller.signal;
    const result = await savePost(content, id);
    if (signal.aborted) return;
    setReplies((existing) =>
      existing.map((reply) => (reply.id === id ? result.post : reply)),
    );
    setOffset(Date.parse(result.serverNow) - Date.now());
  }
  async function remove(id: string) {
    const signal = controller.signal;
    await deletePost(id);
    if (signal.aborted) return;
    setReplies((existing) => existing.filter((reply) => reply.id !== id));
    props.onCountChange(-1);
  }
  return (
    <section aria-label="Replies" class="border-t border-[#454545] py-5">
      <h2 class="text-lg font-semibold">Replies</h2>
      <Show
        when={social.auth().kind === "signedIn"}
        fallback={
          <p class="py-4 text-[#999]">
            <A href="/login" class="text-[#00d363] hover:underline">
              Sign in
            </A>{" "}
            to reply.
          </p>
        }
      >
        <form
          class="my-5"
          onSubmit={(event) => {
            event.preventDefault();
            void publish();
          }}
        >
          <label for="reply" class="mb-2 block text-sm text-[#999]">
            Write a reply
          </label>
          <textarea
            id="reply"
            rows={3}
            value={draft()}
            disabled={sending()}
            onInput={(event) => setDraft(event.currentTarget.value)}
            aria-describedby="reply-count"
            class="w-full resize-y rounded-xl border border-[#555] p-3 focus:outline-[#00d363]"
          />
          <div class="mt-2 flex items-center justify-end gap-4">
            <span id="reply-count" class="text-xs text-[#999]">
              {characterCount(draft().trim())} / 2,000
            </span>
            <button
              type="submit"
              disabled={sending() || !validContent(draft())}
              class="rounded-xl border border-[#555] px-4 disabled:opacity-40"
            >
              {sending() ? "Replying…" : "Reply"}
            </button>
          </div>
        </form>
      </Show>
      <Show when={error()}>
        <p role="alert" class="py-3 text-red-300">
          {error()}
        </p>
      </Show>
      <For each={replies()}>
        {(reply) => (
          <Post
            post={reply}
            serverOffset={offset()}
            onEdit={edit}
            onDelete={remove}
          />
        )}
      </For>
      <Show when={loading()}>
        <p role="status" class="py-4 text-[#999]">
          Loading replies…
        </p>
      </Show>
      <Show when={loadError()}>
        <p role="alert" class="py-3 text-red-300">
          {loadError()}
        </p>
        <button
          type="button"
          onClick={() => void load(props.postId, cursor(), controller.signal)}
          class="rounded-xl border border-[#555] px-4"
        >
          Retry loading replies
        </button>
      </Show>
      <Show when={!loading() && !loadError()}>
        <Show when={replies().length === 0}>
          <p class="py-4 text-[#999]">No replies yet.</p>
        </Show>
        <Show when={cursor()}>
          <button
            type="button"
            onClick={() => void load(props.postId, cursor(), controller.signal)}
            class="rounded-xl border border-[#555] px-4"
          >
            Load more replies
          </button>
        </Show>
      </Show>
    </section>
  );
}
