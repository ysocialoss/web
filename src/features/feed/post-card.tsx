import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PostActions } from "./post-actions";
import type { Post } from "./data";
import type { ComponentProps } from "react";

export function PostCard({
  post,
  feed,
}: {
  post: Post;
  feed: ComponentProps<typeof PostActions>["feed"];
}) {
  return (
    <article id={`post-${post.id}`} className="py-5">
      <div className="flex items-start gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">{post.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold">{post.name}</span>
            <span className="text-xs text-muted-foreground">
              @{post.handle}
            </span>
            <span className="text-xs text-muted-foreground">· {post.time}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {post.text}
          </p>
          <PostActions post={post} feed={feed} />
        </div>
      </div>
    </article>
  );
}
