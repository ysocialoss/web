import {
  Fragment,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link2 } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DisplayName } from "@/components/display-name";
import { api, type Post } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  OBJECT,
  parseMarkdown,
  type MdBlock,
  type MdNode,
} from "@/lib/markdown";
import { splitTopics, topicPath } from "@/lib/topics";
import { ExternalLink } from "@/components/ui/external-link";
import { MentionText } from "./mention-text";
import { PostEmbed } from "./post-embed";
import { WebsiteEmbed } from "./website-embed";
import { WebsiteIcon } from "./website-icon";
import { usePostLinkDetails } from "./use-post-link-details";
import {
  firstPostEmbed,
  isWebsiteLink,
  splitPostLinks,
  type PostPart,
} from "./post-links";

const chipClassName =
  "inline-flex max-w-full items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 align-baseline text-xs font-medium leading-4 text-blue-700 outline-none transition-colors hover:bg-blue-500/20 focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-300";
const chipPlaceholderClassName =
  "inline-flex w-32 max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 align-baseline outline-none focus-visible:ring-2 focus-visible:ring-ring";
const previewLines = 6;

/** What PostText needs of a post. Quoted posts carry only an id and content. */
type TextPost = Pick<Post, "id" | "content"> &
  Partial<Pick<Post, "topics" | "mentions">>;

export function PostText({
  post,
  className,
  previewExternalLinks,
  collapsible = true,
}: {
  post: TextPost;
  className: string;
  previewExternalLinks: boolean;
  collapsible?: boolean;
}) {
  const parts = useMemo(
    () => splitPostLinks(post.content, import.meta.env.DEV),
    [post.content],
  );
  const blocks = useMemo(
    () =>
      parseMarkdown(
        parts
          .map((part) => (part.kind === "text" ? part.text : OBJECT))
          .join(""),
      ),
    [parts],
  );
  const embed = firstPostEmbed(parts);
  const { captionRef, details, loading } = usePostLinkDetails(
    post.id,
    parts,
    embed,
    previewExternalLinks,
  );
  const captionId = useId();
  const [expanded, setExpanded] = useState(false);
  const [overflowHeight, setOverflowHeight] = useState(0);
  useLayoutEffect(() => {
    const caption = captionRef.current;
    if (!collapsible || !caption) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(caption).lineHeight);
      const height = Math.ceil(caption.getBoundingClientRect().height);
      setOverflowHeight(height > lineHeight * previewLines + 1 ? height : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(caption);
    return () => observer.disconnect();
  }, [captionRef, collapsible]);
  const overflows = collapsible && overflowHeight > 0;
  const websites = details?.websites;
  const websiteEmbed =
    embed?.kind === "external"
      ? websites?.previews.find(({ href }) => href === embed.href)
      : undefined;

  function renderObject(
    part: Exclude<PostPart, { kind: "text" }>,
    index: number,
  ) {
    const key = `${index}:${part.href}`;
    const pending = loading && (part.kind === "post" || isWebsiteLink(part));
    const chipClass = pending ? chipPlaceholderClassName : chipClassName;
    if (part.kind === "external") {
      const website =
        websites?.links.find(({ href }) => href === part.href) ??
        websites?.previews.find(({ href }) => href === part.href);
      const title = website?.title ?? part.text;
      const iconSrc =
        website?.iconKey && api.websitePreviewIcon(post.id, website.iconKey);
      return (
        <ExternalLink key={key} href={part.href} className={chipClass}>
          {pending ? (
            <ChipSkeleton label={part.text} />
          ) : (
            <>
              <WebsiteIcon
                src={
                  iconSrc && details?.images.has(iconSrc) ? iconSrc : undefined
                }
              />
              <bdi className="min-w-0 truncate" title={title}>
                {title}
              </bdi>
            </>
          )}
        </ExternalLink>
      );
    }
    const linkedPost =
      part.kind === "post" ? details?.posts.get(part.postId) : undefined;
    return (
      <a key={key} href={part.href} className={chipClass}>
        {pending ? (
          <ChipSkeleton label={part.text} />
        ) : linkedPost ? (
          <PostChipLabel
            post={linkedPost}
            showAvatar={Boolean(
              linkedPost.author.avatarUrl &&
              details?.images.has(linkedPost.author.avatarUrl),
            )}
          />
        ) : (
          <>
            {part.kind === "owned" ? (
              <WebsiteIcon src="/favicon.png" />
            ) : (
              <Link2 aria-hidden="true" className="size-3 shrink-0" />
            )}
            <bdi className="min-w-0 truncate" title={part.text}>
              {part.text}
            </bdi>
          </>
        )}
      </a>
    );
  }

  function renderRich() {
    const objects = parts.flatMap((part, index) =>
      part.kind === "text" ? [] : [{ part, index }],
    );
    let used = 0;
    let keys = 0;
    const nextObject = () => {
      const item = objects[used++];
      return item ? renderObject(item.part, item.index) : null;
    };
    const leaf = (text: string, plain: boolean): ReactNode[] =>
      text.split(OBJECT).flatMap((piece, position) => {
        const out: ReactNode[] = [];
        if (position > 0) {
          const item = objects[used];
          out.push(plain ? (item?.part.text ?? "") : nextObject());
          if (plain) used++;
        }
        if (piece)
          out.push(
            plain ? (
              piece
            ) : (
              <Fragment key={`t${keys++}`}>{renderText(post, piece)}</Fragment>
            ),
          );
        return out;
      });
    const inline = (nodes: MdNode[]): ReactNode[] =>
      nodes.flatMap((node): ReactNode[] => {
        const key = `n${keys++}`;
        switch (node.type) {
          case "text":
            return leaf(node.text, false);
          case "code":
            return [
              <code
                key={key}
                className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.88em] break-words whitespace-pre-wrap"
              >
                {leaf(node.text, true)}
              </code>,
            ];
          case "strong":
            return [
              <strong key={key} className="font-semibold">
                {inline(node.children)}
              </strong>,
            ];
          case "em":
            return [<em key={key}>{inline(node.children)}</em>];
          case "del":
            return [
              <del key={key} className="text-muted-foreground decoration-1">
                {inline(node.children)}
              </del>,
            ];
          case "spoiler":
            return [<Spoiler key={key}>{inline(node.children)}</Spoiler>];
        }
      });
    const blocksOut = (list: MdBlock[]): ReactNode[] =>
      list.flatMap((block): ReactNode[] => {
        const key = `b${keys++}`;
        switch (block.type) {
          case "inline":
            return inline(block.nodes);
          case "fence":
            return [
              <span
                key={key}
                data-slot="markdown-fence"
                className="my-1.5 block overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-[0.85em] leading-snug whitespace-pre"
              >
                {leaf(block.text, true)}
              </span>,
            ];
          case "quote":
            return [
              <span
                key={key}
                data-slot="markdown-quote"
                className="my-1 block border-l-2 border-mention/50 pl-3 text-foreground/80"
              >
                {blocksOut(block.blocks)}
              </span>,
            ];
          case "heading":
            return [
              <span
                key={key}
                className={cn(
                  "block font-semibold leading-snug",
                  block.level === 1 && "text-[1.35em]",
                  block.level === 2 && "text-[1.18em]",
                  block.level === 3 && "text-[1.06em]",
                )}
              >
                {inline(block.nodes)}
              </span>,
            ];
          case "list":
            return [
              <span key={key} className="my-0.5 block">
                {block.items.map((item, position) => (
                  <span key={position} className="relative block pl-6">
                    <span
                      aria-hidden="true"
                      className="absolute left-1 text-muted-foreground tabular-nums"
                    >
                      {block.ordered ? `${block.start + position}.` : "\u2022"}
                    </span>
                    {inline(item)}
                  </span>
                ))}
              </span>,
            ];
        }
      });
    return blocksOut(blocks);
  }

  return (
    <>
      <div
        className={cn(
          className,
          overflows &&
            "overflow-clip motion-safe:transition-[max-height,mask-size] motion-safe:duration-300 motion-safe:ease-out",
        )}
        style={
          overflows
            ? {
                maxHeight: expanded ? overflowHeight : `${previewLines}lh`,
                maskImage: "linear-gradient(black calc(100% - 1lh), transparent)",
                // Move the fade below the text as the preview expands.
                maskSize: expanded ? "100% calc(100% + 1lh)" : "100% 100%",
                maskRepeat: "no-repeat",
              }
            : undefined
        }
        onFocus={(event) => {
          if (
            overflows &&
            !expanded &&
            event.target.getBoundingClientRect().bottom >
              event.currentTarget.getBoundingClientRect().bottom
          ) {
            setExpanded(true);
          }
        }}
      >
        <p
          id={captionId}
          ref={captionRef}
          data-selectable
          aria-busy={loading || undefined}
          className="flow-root"
        >
          {renderRich()}
        </p>
      </div>
      {overflows && (
        <button
          type="button"
          aria-controls={captionId}
          aria-expanded={expanded}
          className="mt-1 block cursor-pointer rounded-sm text-sm font-medium text-mention underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
      {embed && loading && (
        <EmbedSkeleton website={embed.kind === "external"} />
      )}
      {embed?.kind === "post" && details && (
        <div className="mt-2">
          <PostEmbed
            link={embed}
            post={details.posts.get(embed.postId)}
            images={details.images}
          />
        </div>
      )}
      {websiteEmbed && details && (
        <WebsiteEmbed
          key={websiteEmbed.href}
          postId={post.id}
          preview={websiteEmbed}
          images={details.images}
        />
      )}
    </>
  );
}

function ChipSkeleton({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        data-slot="link-chip-skeleton"
        className="flex h-4 w-full min-w-0 animate-pulse items-center gap-1 motion-reduce:animate-none"
      >
        <span className="size-3.5 shrink-0 rounded-sm bg-foreground/10" />
        <span className="h-2.5 flex-1 rounded-sm bg-foreground/10" />
      </span>
    </>
  );
}

function EmbedSkeleton({ website }: { website: boolean }) {
  return (
    <div
      role="status"
      data-slot="link-embed-skeleton"
      className={
        website
          ? "mt-3 max-w-[25rem] overflow-hidden rounded-lg border"
          : "mt-2 rounded-xl border"
      }
    >
      <span className="sr-only">Loading link preview…</span>
      <div
        aria-hidden="true"
        className="animate-pulse motion-reduce:animate-none"
      >
        {website && <div className="aspect-[2/1] border-b bg-muted" />}
        <div className="flex gap-2.5 p-3">
          {!website && (
            <div className="size-7 shrink-0 rounded-[30%] bg-muted" />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 max-w-full rounded bg-muted" />
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PostChipLabel({
  post,
  showAvatar,
}: {
  post: Post;
  showAvatar: boolean;
}) {
  const name = post.author.displayName || `@${post.author.handle}`;
  const summary =
    post.content.trim().replace(/\s+/g, " ") ||
    post.poll?.title ||
    post.gif?.title ||
    (post.imageIds.length ? "Image attachment" : "") ||
    "Post";
  return (
    <>
      <Avatar userId={post.author.id} className="size-4">
        {showAvatar && post.author.avatarUrl && (
          <AvatarImage
            src={post.author.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        )}
        <AvatarFallback className="text-[0.5rem]">
          {name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <bdi className="min-w-0 truncate" title={`${name} / ${summary}`}>
        <DisplayName user={post.author} name={name} className="font-semibold" />
        {" / "}
        {summary}
      </bdi>
    </>
  );
}

function renderText(post: TextPost, content: string) {
  return splitTopics(content, post.topics ?? []).map((part, index) =>
    part.topic ? (
      <Link
        key={index}
        to={topicPath(part.topic)}
        className="rounded-sm text-blue-600 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-400"
      >
        {part.text}
      </Link>
    ) : (
      <Fragment key={index}>
        <MentionText
          post={{ content: part.text, mentions: post.mentions ?? [] }}
        />
      </Fragment>
    ),
  );
}

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={shown ? undefined : "Hidden text, activate to reveal"}
      data-revealed={shown || undefined}
      onClick={(event) => {
        if (shown) return;
        event.stopPropagation();
        setShown(true);
      }}
      onKeyDown={(event) => {
        if (!shown && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          setShown(true);
        }
      }}
      className={cn(
        "rounded-sm px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        shown
          ? "bg-muted"
          : "cursor-pointer bg-muted-foreground/35 text-transparent select-none [&_*]:text-transparent",
      )}
    >
      {children}
    </span>
  );
}
