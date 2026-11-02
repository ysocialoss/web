import { A, useParams } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import Post from "~/components/Post";
import { deletePost, PostError, savePost, type PostData } from "~/lib/posts";
import { loadProfile, type ProfileData } from "~/lib/profiles";

export default function ProfilePage() {
  const params = useParams<{ handle: string }>();
  const [profile, setProfile] = createSignal<ProfileData | null>(null);
  const [posts, setPosts] = createSignal<PostData[]>([]);
  const [offset, setOffset] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [missing, setMissing] = createSignal(false);
  const [attempt, setAttempt] = createSignal(0);
  createEffect(() => {
    const handle = params.handle;
    attempt();
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    setProfile(null);
    setPosts([]);
    setError("");
    setMissing(false);
    setLoading(true);
    void loadProfile(handle, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProfile(result.profile);
        setPosts(result.posts);
        setOffset(Date.parse(result.serverNow) - Date.now());
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof PostError && error.status === 404)
          setMissing(true);
        else
          setError(
            error instanceof Error
              ? error.message
              : "Could not load this profile. Please retry.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  });
  async function edit(id: string, content: string) {
    const handle = params.handle;
    const result = await savePost(content, id);
    if (params.handle !== handle) return;
    setOffset(Date.parse(result.serverNow) - Date.now());
    setPosts((current) =>
      current.map((post) => (post.id === id ? result.post : post)),
    );
  }
  async function remove(id: string) {
    const handle = params.handle;
    await deletePost(id);
    if (params.handle === handle)
      setPosts((current) => current.filter((post) => post.id !== id));
  }
  return (
    <section aria-label="Profile">
      <A href="/" class="inline-block py-3 text-[#999] hover:text-white">
        ← Back to feed
      </A>
      <Switch>
        <Match when={loading()}>
          <p role="status" class="py-8 text-[#999]">
            Loading profile…
          </p>
        </Match>
        <Match when={missing()}>
          <h1 class="mt-6 text-xl font-semibold">Profile not found</h1>
        </Match>
        <Match when={error()}>
          <p role="alert" class="mt-6 text-red-300">
            {error()}
          </p>
          <button
            type="button"
            class="mt-3 rounded border border-[#555] px-4"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry loading profile
          </button>
        </Match>
        <Match when={profile()}>
          <Show when={profile()}>
            {(current) => (
              <>
                <header class="border-b border-[#454545] py-6">
                  <h1 class="text-2xl font-semibold [overflow-wrap:anywhere]">
                    {current().displayName || current().handle}
                  </h1>
                  <p class="mt-1 text-[#999]">@{current().handle}</p>
                  <Show when={current().bio}>
                    <p class="mt-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {current().bio}
                    </p>
                  </Show>
                  <p class="mt-4 text-sm text-[#999]">
                    Joined{" "}
                    {new Date(current().createdAt).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </header>
                <For
                  each={posts()}
                  fallback={<p class="py-8 text-[#999]">No posts yet.</p>}
                >
                  {(post) => (
                    <Post
                      post={post}
                      serverOffset={offset()}
                      onEdit={edit}
                      onDelete={remove}
                    />
                  )}
                </For>
              </>
            )}
          </Show>
        </Match>
      </Switch>
    </section>
  );
}
