import { A, useNavigate } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
  Switch,
  Match,
} from "solid-js";
import {
  setPostLike,
  characterCount,
  validContent,
  PostError,
  type PostData,
} from "~/lib/posts";
import Avatar from "~/components/Avatar";
import RelativeTime from "~/components/RelativeTime";
import AnimatedCount from "~/components/AnimatedCount";
import {
  MessageCircle,
  Heart,
  Repeat2,
  Share2,
  EllipsisVertical,
  X,
} from "~/components/Icons";
import { useSocial } from "~/lib/social-context";

export default function Post(props: {
  post: PostData;
  standalone?: boolean;
  serverOffset: number;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const social = useSocial();
  const navigate = useNavigate();
  const postUrl = () => `/post/${props.post.id}`;
  const editorId = createUniqueId();
  const [reaction, setReaction] = createSignal({
    likes: props.post.likes,
    liked: props.post.liked,
  });
  const [liking, setLiking] = createSignal(false);
  const [loginPrompt, setLoginPrompt] = createSignal(false);
  let loginLink: HTMLAnchorElement | undefined;
  let promptTrigger: HTMLButtonElement | undefined;
  const [menu, setMenu] = createSignal(false);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const [now, setNow] = createSignal(Date.now());
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [expired, setExpired] = createSignal(false);
  let textarea: HTMLTextAreaElement | undefined;
  let menuRoot: HTMLDivElement | undefined;
  createEffect(() =>
    setReaction({ likes: props.post.likes, liked: props.post.liked }),
  );
  const signedIn = () => social.auth().kind === "signedIn";
  const liked = () => signedIn() && reaction().liked;
  function showLoginPrompt(trigger: HTMLButtonElement) {
    promptTrigger = trigger;
    setMenu(false);
    setLoginPrompt(true);
    loginLink?.focus({ preventScroll: true });
  }
  function allowInteraction(trigger: HTMLButtonElement) {
    if (signedIn()) return true;
    showLoginPrompt(trigger);
    return false;
  }
  function closeLoginPrompt(restoreFocus = false) {
    setLoginPrompt(false);
    if (restoreFocus) promptTrigger?.focus({ preventScroll: true });
  }
  async function toggleLike(trigger: HTMLButtonElement) {
    if (!allowInteraction(trigger) || liking()) return;
    const previous = reaction();
    const next = !previous.liked;
    setLiking(true);
    setError("");
    setReaction({ liked: next, likes: previous.likes + (next ? 1 : -1) });
    try {
      setReaction(await setPostLike(props.post.id, next));
    } catch (error) {
      setReaction(previous);
      if (
        error instanceof PostError &&
        (error.status === 401 || error.code === "onboarding_required")
      ) {
        await social.reloadAuth();
        showLoginPrompt(trigger);
      } else
        setError(
          error instanceof Error
            ? error.message
            : "Could not update your like. Please retry.",
        );
    } finally {
      setLiking(false);
    }
  }
  const owns = () => {
    const auth = social.auth();
    return auth.kind === "signedIn" && auth.user.id === props.post.author.id;
  };
  const secondsLeft = () =>
    Math.max(
      0,
      Math.ceil(
        (Date.parse(props.post.editExpiresAt) - now() - props.serverOffset) /
          1000,
      ),
    );
  const canEdit = () => !expired() && secondsLeft() > 0;
  const countdown = () =>
    `${Math.floor(secondsLeft() / 60)}:${String(secondsLeft() % 60).padStart(2, "0")}`;
  onMount(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRoot?.contains(event.target)) {
        setMenu(false);
        closeLoginPrompt();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        if (loginPrompt()) closeLoginPrompt(true);
      }
    };
    document.addEventListener("visibilitychange", tick);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    onCleanup(() => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    });
  });
  async function save() {
    if (busy() || !canEdit() || !validContent(draft())) return;
    setBusy(true);
    setError("");
    try {
      await props.onEdit(props.post.id, draft().trim());
      setEditing(false);
    } catch (error) {
      if (error instanceof PostError && error.code === "edit_window_expired")
        setExpired(true);
      setError(
        error instanceof Error
          ? error.message
          : "Could not save. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setMenu(false);
    if (busy() || !window.confirm("Permanently delete this post?")) return;
    setBusy(true);
    setError("");
    try {
      await props.onDelete(props.post.id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      data-post
      classList={{ "cursor-pointer": !props.standalone && !editing() }}
      onClick={(event) => {
        if (
          props.standalone ||
          editing() ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        if (
          event.target instanceof Element &&
          event.target.closest('a,button,input,textarea,form,[role="dialog"]')
        )
          return;
        if (window.getSelection()?.toString()) return;
        navigate(postUrl());
      }}
      class="
      border-b border-[#454545] pt-[30px] pb-[29px] last:border-b-0 max-[701px]:pt-[25px]
      max-[701px]:[&_header]:flex-wrap max-[701px]:[&_header]:gap-1.5 max-[701px]:[&_header]:text-[13px]
      max-[701px]:[&_header_img]:size-[34px] max-[701px]:[&_time]:text-[12px]
    "
    >
      <header class="flex items-center gap-2">
        <Avatar label={`Avatar for @${props.post.author.handle}`} />
        <A
          href={`/profile/${props.post.author.handle}`}
          class="min-w-0 font-semibold tracking-[-0.25px] hover:underline focus-visible:outline-[#00d363]"
          title={`@${props.post.author.handle}`}
        >
          {props.post.author.displayName || props.post.author.handle}
        </A>
        <Show
          when={!props.standalone}
          fallback={
            <RelativeTime timestamp={Date.parse(props.post.createdAt)} />
          }
        >
          <A
            href={postUrl()}
            class="ml-auto whitespace-nowrap focus-visible:outline-[#00d363]"
            aria-label={`View post by @${props.post.author.handle}`}
          >
            <RelativeTime timestamp={Date.parse(props.post.createdAt)} />
          </A>
        </Show>
      </header>
      <Show
        when={editing() && owns()}
        fallback={
          <p class="mt-[25px] mb-6 whitespace-pre-wrap leading-[21px] [overflow-wrap:anywhere] max-[701px]:mt-5">
            {props.post.content}
          </p>
        }
      >
        <form
          class="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label for={editorId} class="sr-only">
            Edit post
          </label>
          <textarea
            ref={textarea}
            id={editorId}
            aria-describedby={`${editorId}-count ${editorId}-deadline`}
            class="min-h-32 w-full rounded-xl border border-[#555] bg-[#202020] p-3 outline-[#00d363]"
            value={draft()}
            disabled={busy()}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
          <div id={`${editorId}-deadline`} class="mt-2 text-sm text-[#999]">
            {canEdit()
              ? `Editing closes in ${countdown()}`
              : "The 15-minute editing window has closed."}
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <span
              id={`${editorId}-count`}
              class="mr-auto text-sm text-[#999]"
              classList={{
                "text-red-300": characterCount(draft().trim()) > 2000,
              }}
            >
              {characterCount(draft().trim())} / 2,000
            </span>
            <button
              type="button"
              disabled={busy()}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded-xl border border-[#555] px-4 disabled:opacity-40"
              disabled={busy() || !canEdit() || !validContent(draft())}
            >
              {busy() ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Show>
      <Show when={props.post.editedAt}>
        <p class="mb-4 text-xs text-[#888]">Edited</p>
      </Show>
      <div ref={menuRoot} class="relative">
        <div
          class="
        [&_button]:relative [&_button]:isolate [&_button]:-m-2.5 [&_button]:p-2.5 [&_button:last-child]:ml-auto
        [&_button[aria-pressed=true]_svg]:animate-[icon-pop_300ms_cubic-bezier(0.2,0.8,0.3,1)]
        motion-reduce:[&_button_svg]:animate-none! flex items-center gap-[27px]
      "
        >
          <button
            type="button"
            aria-label="Like post"
            aria-pressed={liked()}
            class="flex items-center gap-2.5 max-[701px]:gap-[7px]"
            classList={{ "text-[#ff3030]": liked() }}
            aria-disabled={!signedIn()}
            disabled={liking()}
            aria-busy={liking()}
            onClick={(event) => void toggleLike(event.currentTarget)}
          >
            <Heart size={24} fill={liked() ? "currentColor" : "none"} />
            <Show when={reaction().likes > 0}>
              <AnimatedCount value={reaction().likes} />
            </Show>
          </button>
          <button
            type="button"
            aria-label="Reply to post"
            aria-disabled={!signedIn()}
            onClick={(event) => allowInteraction(event.currentTarget)}
            class="flex items-center gap-2.5 max-[701px]:gap-[7px]"
          >
            <MessageCircle size={24} />
          </button>
          <button
            type="button"
            aria-label="Repost"
            aria-pressed={false}
            aria-disabled={!signedIn()}
            onClick={(event) => allowInteraction(event.currentTarget)}
          >
            <Repeat2 size={24} />
          </button>
          <button
            type="button"
            aria-label="Share post"
            aria-disabled={!signedIn()}
            onClick={(event) => allowInteraction(event.currentTarget)}
          >
            <Share2 size={24} />
          </button>
          <button
            type="button"
            aria-label="Post options"
            class="ml-auto"
            aria-expanded={owns() ? menu() : undefined}
            aria-controls={owns() ? `${editorId}-menu` : undefined}
            disabled={busy()}
            aria-disabled={!signedIn()}
            onClick={(event) => {
              if (allowInteraction(event.currentTarget) && owns())
                setMenu(!menu());
            }}
          >
            <EllipsisVertical size={24} />
          </button>
        </div>
        <Show when={loginPrompt()}>
          <div
            role="dialog"
            aria-label="Login required"
            aria-describedby={`${editorId}-login-message`}
            class="absolute bottom-[calc(100%+12px)] left-0 z-20 w-[280px] max-w-full rounded-xl border border-[#444] bg-[#202020] p-4 text-sm shadow-xl"
          >
            <button
              type="button"
              aria-label="Close login popup"
              class="absolute right-2 top-2 text-[#999]"
              onClick={() => closeLoginPrompt(true)}
            >
              <X size={16} />
            </button>
            <Switch>
              <Match when={social.auth().kind === "loading"}>
                <p id={`${editorId}-login-message`} role="status" class="pr-6">
                  Checking your account…
                </p>
              </Match>
              <Match when={social.auth().kind === "unavailable"}>
                <p id={`${editorId}-login-message`} class="pr-6">
                  Could not check your account.
                </p>
                <button
                  type="button"
                  class="mt-3 text-[#00d363]"
                  onClick={() => void social.reloadAuth()}
                >
                  Retry account connection
                </button>
              </Match>
              <Match when={social.auth().kind === "onboarding"}>
                <p id={`${editorId}-login-message`} class="pr-6">
                  Choose your handle to interact with this post.
                </p>
                <a
                  ref={loginLink}
                  href="/onboarding"
                  class="mt-3 inline-block font-semibold text-[#00d363]"
                >
                  Choose your handle
                </a>
              </Match>
              <Match when={social.auth().kind === "anonymous"}>
                <p id={`${editorId}-login-message`} class="pr-6">
                  Log in to interact with this post.
                </p>
                <a
                  ref={loginLink}
                  href="/auth/login"
                  rel="external"
                  class="mt-3 inline-block font-semibold text-[#00d363]"
                >
                  Log in with CNS
                </a>
              </Match>
              <Match when={signedIn()}>
                <p id={`${editorId}-login-message`} class="pr-6">
                  You're signed in. Try the action again.
                </p>
              </Match>
            </Switch>
          </div>
        </Show>
        <Show when={owns() && menu()}>
          <div
            id={`${editorId}-menu`}
            class="absolute right-0 bottom-[calc(100%+12px)] z-10 min-w-40 rounded-xl border border-[#444] bg-[#202020] p-2 shadow-xl"
          >
            <button
              type="button"
              class="block w-full px-3 py-2 text-left disabled:text-[#777]"
              disabled={!canEdit() || busy()}
              onClick={() => {
                setDraft(props.post.content);
                setError("");
                setEditing(true);
                setMenu(false);
                textarea?.focus();
              }}
            >
              Edit
            </button>
            <button
              type="button"
              class="block w-full px-3 py-2 text-left text-red-300"
              onClick={() => void remove()}
            >
              Delete
            </button>
          </div>
        </Show>
      </div>
      <Show when={error()}>
        <p role="alert" class="mt-3 text-sm text-red-300">
          {error()}
        </p>
      </Show>
    </article>
  );
}
