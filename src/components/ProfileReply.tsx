import { A } from "@solidjs/router";
import { For } from "solid-js";
import Avatar from "~/components/Avatar";
import Post from "~/components/Post";
import RelativeTime from "~/components/RelativeTime";
import type { PostData, RepostState } from "~/lib/posts";
import type { ProfileReply as ProfileReplyData } from "~/lib/profiles";

export default function ProfileReply(props: {
  reply: ProfileReplyData;
  serverOffset: number;
  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRepost?: (post: PostData, state: RepostState) => void;
}) {
  return (
    <div class="border-b border-[#454545] last:border-b-0">
      <div aria-label="Parent thread" class="pt-6">
        <For each={props.reply.thread}>
          {(parent) => (
            <div class="relative grid grid-cols-[42px_minmax(0,1fr)] gap-x-2 pb-5">
              <span
                aria-hidden="true"
                class="absolute top-9 bottom-0 left-5 w-px bg-[#3a3a3a]"
              />
              <A
                href={`/profile/${parent.author.handle}`}
                class="relative z-10 mx-auto block h-8 w-8 rounded-full focus-visible:outline-[#00d363] [&>span]:h-8 [&>span]:w-8 [&_svg]:size-[18px]"
              >
                <Avatar label={`Avatar for @${parent.author.handle}`} />
              </A>
              <div class="min-w-0 pt-1">
                <div class="flex min-w-0 items-center gap-3 text-[13px] leading-5">
                  <A
                    href={`/profile/${parent.author.handle}`}
                    title={`@${parent.author.handle}`}
                    class="min-w-0 truncate font-semibold text-[#bdbdbd] hover:underline focus-visible:outline-[#00d363]"
                  >
                    {parent.author.displayName || `@${parent.author.handle}`}
                  </A>
                  <A
                    href={`/post/${parent.id}`}
                    class="ml-auto shrink-0 text-xs text-[#777] hover:text-[#bbb] focus-visible:outline-[#00d363]"
                  >
                    <RelativeTime timestamp={Date.parse(parent.createdAt)} />
                  </A>
                </div>
                <A
                  href={`/post/${parent.id}`}
                  class="mt-1 block rounded-sm focus-visible:outline-[#00d363]"
                >
                  <p class="line-clamp-3 whitespace-pre-wrap text-[13px] leading-5 text-[#aaa] [overflow-wrap:anywhere]">
                    {parent.content}
                  </p>
                </A>
              </div>
            </div>
          )}
        </For>
      </div>
      <div class="relative [&>[data-post]]:border-0 [&>[data-post]]:pt-3">
        <span
          aria-hidden="true"
          class="absolute top-0 left-5 h-3 w-px bg-[#3a3a3a]"
        />
        <Post
          post={props.reply.post}
          serverOffset={props.serverOffset}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
          onRepost={props.onRepost}
        />
      </div>
    </div>
  );
}
