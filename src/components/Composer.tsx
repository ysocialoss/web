import {
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { MAX_ATTACHMENTS } from "~/lib/attachments";
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
  X,
} from "~/components/Icons";
import PostMedia from "~/components/PostMedia";
import {
  acceptsPostMedia,
  canPublishPost,
  isMediaPostType,
  mediaAccepts,
  postTypeLabels,
  type PostType,
} from "~/lib/post-types";
import type { PostAttachment, PostDraft } from "~/lib/posts";
import { useSocial } from "~/lib/social-context";

export default function Composer(props: {
  onPost: (draft: PostDraft) => void;
}) {
  const social = useSocial();
  const editorId = createUniqueId();
  const [expanded, setExpanded] = createSignal(false);
  const [text, setText] = createSignal("");
  const [postType, setPostType] = createSignal<PostType>("text");
  const [mediaError, setMediaError] = createSignal("");
  const [attachments, setAttachments] = createSignal<PostAttachment[]>([]);
  const ownedUrls = new Set<string>();
  let container: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  let textarea: HTMLTextAreaElement | undefined;
  let mediaInput: HTMLInputElement | undefined;
  const canPost = () =>
    canPublishPost({
      type: postType(),
      text: text(),
      mediaCount: attachments().length,
    });
  const accept = () => {
    const type = postType();
    return isMediaPostType(type) ? mediaAccepts[type] : undefined;
  };

  onMount(() => {
    if (container) onCleanup(social.observeComposer(container));
  });
  onCleanup(() => ownedUrls.forEach((url) => URL.revokeObjectURL(url)));

  function open() {
    setExpanded(true);
    textarea?.focus({ preventScroll: true });
  }
  function close() {
    setExpanded(false);
    trigger?.focus({ preventScroll: true });
  }
  function clearMedia() {
    attachments().forEach((attachment) => {
      ownedUrls.delete(attachment.url);
      URL.revokeObjectURL(attachment.url);
    });
    setAttachments([]);
    setMediaError("");
  }
  function selectType(type: PostType) {
    if (type !== postType()) clearMedia();
    setPostType(type);
    if (isMediaPostType(type)) mediaInput?.click();
  }
  function addFiles(input: HTMLInputElement) {
    const type = postType();
    if (!isMediaPostType(type)) return;
    const files = Array.from(input.files ?? []);
    const valid = files.filter((file) => acceptsPostMedia(type, file.type));
    if (attachments().length + valid.length > MAX_ATTACHMENTS) {
      setMediaError(`Maximum ${MAX_ATTACHMENTS} attachments.`);
      input.value = "";
      return;
    }
    setMediaError(
      valid.length === files.length
        ? ""
        : `Choose ${postTypeLabels[type].toLowerCase()} files for this post type.`,
    );
    const additions = valid.map((file) => {
      const url = URL.createObjectURL(file);
      ownedUrls.add(url);
      return { name: file.name, size: file.size, url, kind: type };
    });
    setAttachments((current) => [...current, ...additions]);
    input.value = "";
  }
  function removeAttachment(attachment: PostAttachment) {
    setMediaError("");
    setAttachments((current) => current.filter((item) => item !== attachment));
    ownedUrls.delete(attachment.url);
    URL.revokeObjectURL(attachment.url);
  }
  function post() {
    if (!canPost()) return;
    props.onPost({
      type: postType(),
      text: text().trim(),
      attachments: attachments(),
    });
    // Published previews belong to the feed until it unmounts.
    attachments().forEach((attachment) => ownedUrls.delete(attachment.url));
    setText("");
    if (textarea) textarea.style.height = "";
    setAttachments([]);
    setPostType("text");
    setMediaError("");
    close();
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
        <div class="
          pointer-events-none absolute top-[18px] right-[60px] left-[72px] flex items-center gap-1 text-[15px]
          leading-[22px] text-[#777] opacity-0 transition-opacity duration-200 [&>span:first-child]:shrink-0
          group-data-[expanded=true]/composer:opacity-100 motion-reduce:transition-none
        " aria-hidden={!expanded()}>
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
      <div id={editorId} data-composer-reveal class="
        grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[320ms,180ms]
        ease-[var(--composer-easing),ease-out] group-data-[expanded=true]/composer:grid-rows-[1fr]
        group-data-[expanded=true]/composer:opacity-100
        group-data-[expanded=true]/composer:duration-[360ms,240ms]
        group-data-[expanded=true]/composer:ease-[var(--composer-easing),ease-in] motion-reduce:transition-none
      " inert={!expanded()}>
        <div class="min-h-0 overflow-hidden">
          <form
            class="px-6 pb-[22px]"
            onSubmit={(event) => {
              event.preventDefault();
              post();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                post();
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
                onInput={(event) => {
                  setText(event.currentTarget.value);
                  event.currentTarget.style.height = "auto";
                  event.currentTarget.style.height = `${Math.min(240, event.currentTarget.scrollHeight)}px`;
                }}
              />
              <Show when={attachments().length > 0}>
                <ul class="mb-4 flex flex-wrap gap-3" aria-label="Attachments">
                  <For each={attachments()}>
                    {(attachment) => (
                      <li class="relative rounded-xl border border-[#383838] bg-[#171717]">
                        <PostMedia attachment={attachment} compact />
                        <button
                          type="button"
                          aria-label={`Remove ${attachment.name}`}
                          onClick={() => removeAttachment(attachment)}
                          class="absolute top-[3px] right-[3px] flex items-center justify-center rounded-full bg-[#111c]"
                        >
                          <X size={16} />
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
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
                  aria-pressed={postType() === "image"}
                  onClick={() => selectType("image")}
                >
                  <Image size={21} />
                </button>
                <button
                  type="button"
                  class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                  aria-label="Add GIF"
                  title="GIF"
                  aria-pressed={postType() === "gif"}
                  onClick={() => selectType("gif")}
                >
                  <span class="inline-flex h-[19px] w-[18px] items-center justify-center rounded border-[1.7px] border-current text-[9px] font-bold tracking-[-0.5px]">GIF</span>
                </button>
                <button
                  type="button"
                  class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                  aria-label="Add video"
                  title="Video"
                  aria-pressed={postType() === "video"}
                  onClick={() => selectType("video")}
                >
                  <Video size={21} />
                </button>
                <button
                  type="button"
                  class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                  aria-label="Add voice"
                  title="Voice"
                  aria-pressed={postType() === "voice"}
                  onClick={() => selectType("voice")}
                >
                  <Mic size={21} />
                </button>
                <button
                  type="button"
                  class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                  aria-label="Live post"
                  title="Live chat"
                  aria-pressed={postType() === "live"}
                  onClick={() =>
                    selectType(postType() === "live" ? "text" : "live")
                  }
                >
                  <Radio size={21} />
                </button>
                <button
                  type="button"
                  class="flex shrink-0 items-center justify-center text-[#808080] aria-pressed:text-[#f5f5f5]"
                  aria-label="Stream post"
                  title="Stream"
                  aria-pressed={postType() === "streams"}
                  onClick={() =>
                    selectType(postType() === "streams" ? "text" : "streams")
                  }
                >
                  <Tv size={21} />
                </button>
              </div>
              <Show when={postType() !== "text"}>
                <div class="mb-2 flex items-center gap-2 text-sm text-[#999]">
                  <span>{postTypeLabels[postType()]}</span>
                  <button
                    type="button"
                    aria-label="Switch to text post"
                    onClick={() => {
                      clearMedia();
                      setPostType("text");
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </Show>
              <Show when={mediaError()}>
                <p class="mb-2 text-sm text-[#ff7373]" role="alert">
                  {mediaError()}
                </p>
              </Show>
            </div>
            <div class="mt-[18px] flex items-center justify-between">
              <button type="button" class="flex items-center gap-2 text-[15px] font-semibold text-[#888]">
                <Clock size={20} />
                <span>Schedule post</span>
              </button>
              <button
                type="submit"
                class="min-w-[66px] rounded-xl border border-[#3a3a3a] px-4 text-[15px] font-semibold text-[#f5f5f5] disabled:border-[#272727] disabled:text-[#555]"
                disabled={!canPost()}
              >
                Post
              </button>
            </div>
            <input
              ref={(element) => {
                mediaInput = element;
              }}
              type="file"
              accept={accept()}
              multiple
              class="hidden"
              aria-label="Choose post media"
              onChange={(event) => addFiles(event.currentTarget)}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
