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
import { UserRound } from "~/components/Icons";
import ProfileReplyCard from "~/components/ProfileReply";
import { useSocial } from "~/lib/social-context";
import {
  deletePost,
  PostError,
  savePost,
  type PostData,
  type RepostState,
} from "~/lib/posts";
import {
  loadProfile,
  type ProfileReply,
  type ProfileData,
} from "~/lib/profiles";

type ProfileTab = "posts" | "replies" | "reposts";
const profileTabs: ProfileTab[] = ["posts", "replies", "reposts"];
export default function ProfilePage() {
  const social = useSocial();
  const params = useParams<{ handle: string }>();
  const [profile, setProfile] = createSignal<ProfileData | null>(null);
  const [posts, setPosts] = createSignal<PostData[]>([]);
  const [replies, setReplies] = createSignal<ProfileReply[]>([]);
  const [reposts, setReposts] = createSignal<PostData[]>([]);
  const [tab, setTab] = createSignal<ProfileTab>("posts");
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
    setReplies([]);
    setReposts([]);
    setTab("posts");
    setError("");
    setMissing(false);
    setLoading(true);
    void loadProfile(handle, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProfile(result.profile);
        setPosts(result.posts);
        setReplies(result.replies);
        setReposts(result.reposts);
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
    setReplies((current) =>
      current.map((reply) => ({
        ...reply,
        post: reply.post.id === id ? result.post : reply.post,
        thread: reply.thread.map((parent) =>
          parent.id === id ? result.post : parent,
        ),
      })),
    );
    setReposts((current) =>
      current.map((post) => (post.id === id ? result.post : post)),
    );
    setPosts((current) =>
      current.map((post) => (post.id === id ? result.post : post)),
    );
  }
  async function remove(id: string) {
    const handle = params.handle;
    await deletePost(id);
    if (params.handle === handle) {
      setPosts((current) => current.filter((post) => post.id !== id));
      setReposts((current) => current.filter((post) => post.id !== id));
      setReplies((current) =>
        current.filter(
          (reply) =>
            reply.post.id !== id &&
            !reply.thread.some((post) => post.id === id),
        ),
      );
    }
  }
  function updateRepost(post: PostData, state: RepostState) {
    const update = (value: PostData) =>
      value.id === post.id ? { ...value, ...state } : value;
    setPosts((current) => current.map(update));
    setReplies((current) =>
      current.map((reply) => ({
        post: update(reply.post),
        thread: reply.thread.map(update),
      })),
    );
    const auth = social.auth();
    if (auth.kind === "signedIn" && auth.user.id === profile()?.id) {
      setReposts((current) =>
        state.reposted
          ? current.some((value) => value.id === post.id)
            ? current.map(update)
            : [{ ...post, ...state }, ...current]
          : current.filter((value) => value.id !== post.id),
      );
    } else setReposts((current) => current.map(update));
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
                <header class="border-b border-[#454545] pb-5">
                  <div class="profile-banner mt-2 flex min-h-[180px] items-end overflow-hidden rounded-xl border border-[#392445] p-4 max-[701px]:p-3">
                    <div class="profile-banner-identity relative flex max-w-full items-center gap-4 p-2 max-[701px]:gap-3">
                      <span
                        role="img"
                        aria-label={`Avatar for @${current().handle}`}
                        class="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl border border-[#3a3a3a] bg-[#252525] text-[#888] max-[701px]:h-16 max-[701px]:w-16"
                      >
                        <UserRound size={34} />
                      </span>
                      <div class="min-w-0">
                        <h1 class="text-2xl font-semibold [overflow-wrap:anywhere]">
                          {current().displayName || current().handle}
                        </h1>
                        <p class="mt-1 text-sm text-[#d1c5dc] [overflow-wrap:anywhere]">
                          @{current().handle}
                        </p>
                      </div>
                    </div>
                  </div>
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
                <div
                  role="tablist"
                  aria-label="Profile activity"
                  class="flex border-b border-[#454545]"
                >
                  <For each={profileTabs}>
                    {(value) => (
                      <button
                        type="button"
                        role="tab"
                        id={`profile-${value}-tab`}
                        aria-selected={tab() === value}
                        aria-controls={`profile-${value}-panel`}
                        tabIndex={tab() === value ? 0 : -1}
                        onClick={() => setTab(value)}
                        onKeyDown={(event) => {
                          if (
                            ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                              event.key,
                            )
                          ) {
                            event.preventDefault();
                            const index = profileTabs.indexOf(tab());
                            const next =
                              profileTabs[
                                event.key === "Home"
                                  ? 0
                                  : event.key === "End"
                                    ? profileTabs.length - 1
                                    : (index +
                                        (event.key === "ArrowRight" ? 1 : -1) +
                                        profileTabs.length) %
                                      profileTabs.length
                              ];
                            setTab(next);
                            document
                              .getElementById(`profile-${next}-tab`)
                              ?.focus();
                          }
                        }}
                        class="flex-1 border-b-2 border-transparent py-4 text-[#999] aria-selected:border-[#00d363] aria-selected:text-white focus-visible:outline-[#00d363]"
                      >
                        {value === "posts"
                          ? "Posts"
                          : value === "replies"
                            ? "Replies"
                            : "Reposts"}
                      </button>
                    )}
                  </For>
                </div>
                <div
                  role="tabpanel"
                  id="profile-posts-panel"
                  aria-labelledby="profile-posts-tab"
                  hidden={tab() !== "posts"}
                >
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
                        onRepost={updateRepost}
                      />
                    )}
                  </For>
                </div>
                <div
                  role="tabpanel"
                  id="profile-replies-panel"
                  aria-labelledby="profile-replies-tab"
                  hidden={tab() !== "replies"}
                >
                  <For
                    each={replies()}
                    fallback={<p class="py-8 text-[#999]">No replies yet.</p>}
                  >
                    {(reply) => (
                      <ProfileReplyCard
                        reply={reply}
                        serverOffset={offset()}
                        onEdit={edit}
                        onDelete={remove}
                        onRepost={updateRepost}
                      />
                    )}
                  </For>
                </div>
                <div
                  role="tabpanel"
                  id="profile-reposts-panel"
                  aria-labelledby="profile-reposts-tab"
                  hidden={tab() !== "reposts"}
                >
                  <For
                    each={reposts()}
                    fallback={<p class="py-8 text-[#999]">No reposts yet.</p>}
                  >
                    {(post) => (
                      <div class="border-b border-[#454545] pt-5 last:border-b-0 [&>[data-post]]:border-0 [&>[data-post]]:pt-4">
                        <A
                          href={`/profile/${current().handle}`}
                          title={`@${current().handle}`}
                          class="inline-flex max-w-full items-center gap-2 text-xs text-[#999] hover:text-[#ccc] focus-visible:outline-[#00d363]"
                        >
                          <span
                            role="img"
                            aria-label={`Avatar for @${current().handle}`}
                            class="flex size-6 shrink-0 items-center justify-center rounded-lg border border-[#3a3a3a] bg-[#252525] text-[#999]"
                          >
                            <UserRound size={14} />
                          </span>
                          <span class="min-w-0 truncate">
                            Reposted by{" "}
                            <span class="font-semibold text-[#bdbdbd]">
                              {current().displayName || current().handle}
                            </span>
                          </span>
                        </A>
                        <Post
                          post={post}
                          serverOffset={offset()}
                          onEdit={edit}
                          onDelete={remove}
                          onRepost={updateRepost}
                        />
                      </div>
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>
        </Match>
      </Switch>
    </section>
  );
}
