import { createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import { MAX_ATTACHMENTS } from "~/lib/attachments";
import Avatar from "~/components/Avatar";
import { Clock, ChevronRight, Image, Mic, Plus, Radio, Tv, Video, X } from "~/components/Icons";
import PostMedia from "~/components/PostMedia";
import { acceptsPostMedia, canPublishPost, isMediaPostType, mediaAccepts, postTypeLabels, type PostType } from "~/lib/post-types";
import type { PostAttachment, PostDraft } from "~/lib/posts";
import { useSocial } from "~/lib/social-context";

export default function Composer(props: { onPost: (draft: PostDraft) => void }) {
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
  const canPost = () => canPublishPost({ type: postType(), text: text(), mediaCount: attachments().length });
  const accept = () => { const type = postType(); return isMediaPostType(type) ? mediaAccepts[type] : undefined; };

  onMount(() => {
    if (container) onCleanup(social.observeComposer(container));
  });
  onCleanup(() => ownedUrls.forEach(url => URL.revokeObjectURL(url)));

  function open() {
    setExpanded(true);
    textarea?.focus({ preventScroll: true });
  }
  function close() {
    setExpanded(false);
    trigger?.focus({ preventScroll: true });
  }
  function clearMedia() {
    attachments().forEach(attachment => {
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
    const valid = files.filter(file => acceptsPostMedia(type, file.type));
    if (attachments().length + valid.length > MAX_ATTACHMENTS) {
      setMediaError(`Maximum ${MAX_ATTACHMENTS} attachments.`);
      input.value = "";
      return;
    }
    setMediaError(valid.length === files.length ? "" : `Choose ${postTypeLabels[type].toLowerCase()} files for this post type.`);
    const additions = valid.map(file => {
      const url = URL.createObjectURL(file);
      ownedUrls.add(url);
      return { name: file.name, size: file.size, url, kind: type };
    });
    setAttachments(current => [...current, ...additions]);
    input.value = "";
  }
  function removeAttachment(attachment: PostAttachment) {
    setMediaError("");
    setAttachments(current => current.filter(item => item !== attachment));
    ownedUrls.delete(attachment.url);
    URL.revokeObjectURL(attachment.url);
  }
  function post() {
    if (!canPost()) return;
    props.onPost({ type: postType(), text: text().trim(), attachments: attachments() });
    // Published previews belong to the feed until it unmounts.
    attachments().forEach(attachment => ownedUrls.delete(attachment.url));
    setText("");
    if (textarea) textarea.style.height = "";
    setAttachments([]);
    setPostType("text");
    setMediaError("");
    close();
  }

  return <div ref={element => { container = element; }} class="composer-panel" classList={{ "composer-expanded": expanded() }}>
    <div class="relative">
      <button ref={element => { trigger = element; }} type="button" aria-expanded={expanded()} aria-controls={editorId} onClick={open} class="composer flex w-full items-center px-[15px]">
        <Avatar /><span class="composer-prompt flex-1 text-[20px] font-medium text-[#8c8c8c]">What's on your mind?</span><span class="mr-2 w-6" aria-hidden="true" />
      </button>
      <div class="composer-meta" aria-hidden={!expanded()}><span class="font-semibold text-[#f5f5f5]">You</span><ChevronRight size={14} /><span class="truncate">Community or topic</span></div>
      <button type="button" aria-label={expanded() ? "Close composer" : "Open composer"} aria-expanded={expanded()} aria-controls={editorId} class="composer-toggle" onClick={() => expanded() ? close() : open()}><Plus size={24} /></button>
    </div>
    <div id={editorId} class="composer-reveal" inert={!expanded()}>
      <div class="min-h-0 overflow-hidden">
        <form class="composer-form" onSubmit={event => { event.preventDefault(); post(); }} onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); close(); }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); post(); }
        }}>
          <div class="composer-body">
          <label class="sr-only" for={`${editorId}-text`}>Write a post</label>
          <textarea ref={element => { textarea = element; }} id={`${editorId}-text`} class="composer-textarea" rows={1} placeholder="What’s new?" value={text()} onInput={event => {
            setText(event.currentTarget.value);
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(240, event.currentTarget.scrollHeight)}px`;
          }} />
          <Show when={attachments().length > 0}>
            <ul class="mb-4 flex flex-wrap gap-3" aria-label="Attachments">
              <For each={attachments()}>{attachment => <li class="relative rounded-xl border border-[#383838] bg-[#171717]">
                <PostMedia attachment={attachment} compact />
                <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => removeAttachment(attachment)} class="attachment-remove"><X size={16} /></button>
              </li>}</For>
            </ul>
          </Show>
          <div class="composer-tools" role="toolbar" aria-label="Post types">
            <button type="button" class="composer-tool" aria-label="Add images" title="Images" aria-pressed={postType() === "image"} onClick={() => selectType("image")}><Image size={21} /></button>
            <button type="button" class="composer-tool" aria-label="Add GIF" title="GIF" aria-pressed={postType() === "gif"} onClick={() => selectType("gif")}><span class="composer-gif">GIF</span></button>
            <button type="button" class="composer-tool" aria-label="Add video" title="Video" aria-pressed={postType() === "video"} onClick={() => selectType("video")}><Video size={21} /></button>
            <button type="button" class="composer-tool" aria-label="Add voice" title="Voice" aria-pressed={postType() === "voice"} onClick={() => selectType("voice")}><Mic size={21} /></button>
            <button type="button" class="composer-tool" aria-label="Live post" title="Live chat" aria-pressed={postType() === "live"} onClick={() => selectType(postType() === "live" ? "text" : "live")}><Radio size={21} /></button>
            <button type="button" class="composer-tool" aria-label="Stream post" title="Stream" aria-pressed={postType() === "streams"} onClick={() => selectType(postType() === "streams" ? "text" : "streams")}><Tv size={21} /></button>
          </div>
          <Show when={postType() !== "text"}>
            <div class="mb-2 flex items-center gap-2 text-sm text-[#999]">
              <span>{postTypeLabels[postType()]}</span>
              <button type="button" aria-label="Switch to text post" onClick={() => { clearMedia(); setPostType("text"); }}><X size={15} /></button>
            </div>
          </Show>
          <Show when={mediaError()}><p class="mb-2 text-sm text-[#ff7373]" role="alert">{mediaError()}</p></Show>
          </div>
          <div class="composer-footer">
            <button type="button" class="composer-options"><Clock size={20} /><span>Schedule post</span></button>
            <button type="submit" class="composer-submit" disabled={!canPost()}>Post</button>
          </div>
          <input ref={element => { mediaInput = element; }} type="file" accept={accept()} multiple class="hidden" aria-label="Choose post media" onChange={event => addFiles(event.currentTarget)} />
        </form>
      </div>
    </div>
  </div>;
}
