import { createSignal, For, Show } from "solid-js";
import type { PostData } from "~/lib/posts";
import Avatar from "~/components/Avatar";
import AnimatedCount from "~/components/AnimatedCount";
import RelativeTime from "~/components/RelativeTime";
import PostMedia from "~/components/PostMedia";
import {
  MessageCircle,
  Heart,
  Repeat2,
  Share2,
  EllipsisVertical,
} from "~/components/Icons";

export default function Post(props: { post: PostData }) {
  const [liked, setLiked] = createSignal(props.post.liked);
  const count = () =>
    props.post.likes + Number(liked()) - Number(props.post.liked);
  return (
    <article class="post">
      <header class="flex items-center gap-2">
        <Avatar />
        <span class="font-semibold tracking-[-0.25px]">You</span>
        <RelativeTime timestamp={props.post.createdAt} />
      </header>
      <p class="post-text">{props.post.text}</p>
      <Show when={props.post.type === "live" || props.post.type === "streams"}>
        <p class="mb-5 text-sm text-[#999]">
          {props.post.type === "live" ? "Live post" : "Stream post"}
        </p>
      </Show>
      <Show when={props.post.attachments?.length}>
        <div class="mb-6 grid grid-cols-2 gap-3">
          <For each={props.post.attachments}>
            {(attachment) => (
              <div
                classList={{
                  "col-span-2":
                    attachment.kind === "voice" || attachment.kind === "video",
                }}
              >
                <PostMedia attachment={attachment} />
              </div>
            )}
          </For>
        </div>
      </Show>
      <div class="post-actions flex items-center gap-[27px]">
        <button
          aria-label="Like post"
          aria-pressed={liked()}
          class="action"
          classList={{ "text-[#ff3030]": liked() }}
          onClick={() => setLiked(!liked())}
        >
          <Heart size={24} fill={liked() ? "currentColor" : "none"} />
          <Show when={count() > 0}>
            <AnimatedCount value={count()} />
          </Show>
        </button>
        <button aria-label="Reply to post" class="action">
          <MessageCircle size={24} />
          <Show when={props.post.comments}>
            <AnimatedCount value={props.post.comments} />
          </Show>
        </button>
        <button
          aria-label="Repost"
          aria-pressed={props.post.reposted}
          classList={{ "text-[#00bc57]": props.post.reposted }}
        >
          <Repeat2 size={24} />
        </button>
        <button aria-label="Share post">
          <Share2 size={24} />
        </button>
        <button aria-label="Post options" class="ml-auto">
          <EllipsisVertical size={24} />
        </button>
      </div>
    </article>
  );
}
