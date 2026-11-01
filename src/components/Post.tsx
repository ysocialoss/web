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
    <article data-post class="
      border-b border-[#454545] pt-[30px] pb-[29px] last:border-b-0 max-[701px]:pt-[25px]
      max-[701px]:[&_header]:flex-wrap max-[701px]:[&_header]:gap-1.5 max-[701px]:[&_header]:text-[13px]
      max-[701px]:[&_header_img]:size-[34px] max-[701px]:[&_time]:text-[12px]
    ">
      <header class="flex items-center gap-2">
        <Avatar />
        <span class="font-semibold tracking-[-0.25px]">You</span>
        <RelativeTime timestamp={props.post.createdAt} />
      </header>
      <p class="mt-[25px] mb-6 whitespace-pre-wrap leading-[21px] [overflow-wrap:anywhere] max-[701px]:mt-5">{props.post.text}</p>
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
      <div class="
        [&_button]:relative [&_button]:isolate [&_button]:-m-2.5 [&_button]:p-2.5 [&_button:last-child]:ml-auto
        [&_button[aria-pressed=true]_svg]:animate-[icon-pop_300ms_cubic-bezier(0.2,0.8,0.3,1)]
        motion-reduce:[&_button_svg]:animate-none! flex items-center gap-[27px]
      ">
        <button
          aria-label="Like post"
          aria-pressed={liked()}
          class="flex items-center gap-2.5 max-[701px]:gap-[7px]"
          classList={{ "text-[#ff3030]": liked() }}
          onClick={() => setLiked(!liked())}
        >
          <Heart size={24} fill={liked() ? "currentColor" : "none"} />
          <Show when={count() > 0}>
            <AnimatedCount value={count()} />
          </Show>
        </button>
        <button aria-label="Reply to post" class="flex items-center gap-2.5 max-[701px]:gap-[7px]">
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
