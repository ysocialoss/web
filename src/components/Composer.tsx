import {
  createSignal,
  createUniqueId,
  onCleanup,
  onMount,
  Show,
  Switch,
  Match,
} from "solid-js";
import Avatar from "~/components/Avatar";
import {
  Clock,
  ChevronRight,
  Image,
  Mic,
  Plus,
  Radio,
  Tv,
  Video,
} from "~/components/Icons";
import { characterCount, validContent } from "~/lib/posts";
import { useSocial } from "~/lib/social-context";

export default function Composer(props: {
  onPost: (content: string) => Promise<void>;
}) {
  const social = useSocial();
  const editorId = createUniqueId();
  const [expanded, setExpanded] = createSignal(false);
  const [text, setText] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  let container: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  let textarea: HTMLTextAreaElement | undefined;
  onMount(() => {
    if (container) onCleanup(social.observeComposer(container));
  });
  function open() {
    setExpanded(true);
    textarea?.focus({ preventScroll: true });
  }
  function close() {
    setExpanded(false);
    trigger?.focus({ preventScroll: true });
  }
  async function publish() {
    if (busy() || !validContent(text()) || social.auth().kind !== "signedIn")
      return;
    setBusy(true);
    setError("");
    try {
      await props.onPost(text().trim());
      setText("");
      if (textarea) textarea.style.height = "";
      close();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not publish. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      ref={(element) => {
        container = element;
      }}
      class="
        group/composer rounded-[36px] bg-[#202020] [--composer-easing:cubic-bezier(0.215,0.61,0.355,1)]
        transition-[border-radius,background-color] duration-[320ms] ease-[var(--composer-easing)]
        data-[expanded=true]:rounded-[20px]
        data-[expanded=true]:[--composer-easing:cubic-bezier(0.55,0.055,0.675,0.19)]
        motion-reduce:transition-none
      "
      data-expanded={expanded()}
    >
      <div class="relative">
        <button
          ref={(element) => {
            trigger = element;
          }}
          data-composer-trigger
          type="button"
          aria-expanded={expanded()}
          aria-controls={editorId}
          onClick={open}
          class="
            h-[71px] rounded-[36px] transition-[height,min-height,transform,filter] duration-[360ms]
            ease-[var(--composer-easing)] hover:scale-100! active:scale-100!
            group-data-[expanded=true]/composer:h-[42px] group-data-[expanded=true]/composer:min-h-[42px]
            group-data-[expanded=true]/composer:items-start group-data-[expanded=true]/composer:px-6
            group-data-[expanded=true]/composer:pt-5 motion-reduce:transition-none flex w-full items-center
            px-[15px]
          "
        >
          <Avatar />
          <span class="transition-opacity duration-[160ms] group-data-[expanded=true]/composer:opacity-0 motion-reduce:transition-none flex-1 text-[20px] font-medium text-[#8c8c8c]">
            What's on your mind?
          </span>
          <span class="mr-2 w-6" aria-hidden="true" />
        </button>
        <div
          class="
          pointer-events-none absolute top-[18px] right-[60px] left-[72px] flex items-center gap-1 text-[15px]
          leading-[22px] text-[#777] opacity-0 transition-opacity duration-200 [&>span:first-child]:shrink-0
          group-data-[expanded=true]/composer:opacity-100 motion-reduce:transition-none
        "
          aria-hidden={!expanded()}
        >
          <span class="font-semibold text-[#f5f5f5]">You</span>
          <ChevronRight size={14} />
          <span class="truncate">Community or topic</span>
        </div>
        <button
          type="button"
          aria-label={expanded() ? "Close composer" : "Open composer"}
          aria-expanded={expanded()}
          aria-controls={editorId}
          class="
            absolute top-[13.5px] right-[13px] flex items-center justify-center text-[#909090]
            [&_svg]:transition-transform [&_svg]:duration-[320ms] [&_svg]:ease-[var(--composer-easing)]
            group-data-[expanded=true]/composer:[&_svg]:rotate-45 motion-reduce:[&_svg]:transition-none
          "
          onClick={() => (expanded() ? close() : open())}
        >
          <Plus size={24} />
        </button>
      </div>
      <div
        id={editorId}
        data-composer-reveal
        class="
        grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[320ms,180ms]
        ease-[var(--composer-easing),ease-out] group-data-[expanded=true]/composer:grid-rows-[1fr]
        group-data-[expanded=true]/composer:opacity-100
        group-data-[expanded=true]/composer:duration-[360ms,240ms]
        group-data-[expanded=true]/composer:ease-[var(--composer-easing),ease-in] motion-reduce:transition-none
      "
        inert={!expanded()}
      >
        <div class="min-h-0 overflow-hidden">
          <div class="px-6 pb-[22px]">
            <Switch>
              <Match when={social.auth().kind === "loading"}>
                <p role="status">Loading account…</p>
              </Match>
              <Match when={social.auth().kind === "anonymous"}>
                <a class="text-[#00d363]" href="/auth/login" rel="external">
                  Sign in with CNS to post
                </a>
              </Match>
              <Match when={social.auth().kind === "onboarding"}>
                <a class="text-[#00d363]" href="/onboarding">
                  Choose your handle to post
                </a>
              </Match>
              <Match when={social.auth().kind === "unavailable"}>
                <button type="button" onClick={() => void social.reloadAuth()}>
                  Retry account connection
                </button>
              </Match>
              <Match when={social.auth().kind === "signedIn"}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void publish();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      close();
                    }
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      void publish();
                    }
                  }}
                >
                  <div class="ml-12">
                    <label class="sr-only" for={`${editorId}-text`}>
                      Write a post
                    </label>
                    <textarea
                      ref={(element) => {
                        textarea = element;
                      }}
                      id={`${editorId}-text`}
                      class="m-0 block h-6 min-h-6 max-h-60 w-full resize-none rounded-none border-0 bg-transparent p-0 text-[15px] leading-6 outline-none placeholder:text-[#777]"
                      rows={1}
                      placeholder="What’s new?"
                      value={text()}
                      disabled={busy()}
                      aria-describedby={`${editorId}-count`}
                      onInput={(event) => {
                        setText(event.currentTarget.value);
                        event.currentTarget.style.height = "auto";
                        event.currentTarget.style.height = `${Math.min(240, event.currentTarget.scrollHeight)}px`;
                      }}
                    />
                    <div
                      class="-mx-2.5 flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      role="toolbar"
                      aria-label="Post types"
                    >
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                        aria-label="Add images"
                        title="Images"
                      >
                        <Image size={21} />
                      </button>
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                        aria-label="Add GIF"
                        title="GIF"
                      >
                        <span class="inline-flex h-[19px] w-[18px] items-center justify-center rounded border-[1.7px] border-current text-[9px] font-bold tracking-[-0.5px]">
                          GIF
                        </span>
                      </button>
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                        aria-label="Add video"
                        title="Video"
                      >
                        <Video size={21} />
                      </button>
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                        aria-label="Add voice"
                        title="Voice"
                      >
                        <Mic size={21} />
                      </button>
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                        aria-label="Live post"
                        title="Live chat"
                      >
                        <Radio size={21} />
                      </button>
                      <button
                        type="button"
                        class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                        aria-label="Stream post"
                        title="Stream"
                      >
                        <Tv size={21} />
                      </button>
                    </div>
                    <Show when={error()}>
                      <p class="mb-2 text-sm text-[#ff7373]" role="alert">
                        {error()}
                      </p>
                    </Show>
                  </div>
                  <div class="mt-[18px] flex items-center justify-between">
                    <button
                      type="button"
                      class="flex items-center gap-2 text-[15px] font-semibold text-[#888]"
                    >
                      <Clock size={20} />
                      <span>Schedule post</span>
                    </button>
                    <span
                      id={`${editorId}-count`}
                      class="ml-auto mr-4 text-xs text-[#999]"
                      classList={{
                        "text-red-300": characterCount(text().trim()) > 2000,
                      }}
                    >
                      {characterCount(text().trim())} / 2,000
                    </span>
                    <button
                      type="submit"
                      class="min-w-[66px] rounded-xl border border-[#3a3a3a] px-4 text-[15px] font-semibold text-[#f5f5f5] disabled:border-[#272727] disabled:text-[#555]"
                      disabled={busy() || !validContent(text())}
                    >
                      {busy() ? "Posting…" : "Post"}
                    </button>
                  </div>
                </form>
              </Match>
            </Switch>
          </div>
        </div>
      </div>
    </div>
  );
}
