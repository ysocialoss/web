import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Globe, Heart, ListChecks, MessageCircle, Mic, Repeat2 } from "lucide-react";
import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Post } from "@/lib/api";
import { countFormat } from "@/lib/count-format";
import { cn } from "@/lib/utils";
import { ExternalLink } from "@/components/ui/external-link";
import { PostText } from "@/features/feed/post-text";
import { useProfileCard } from "@/features/profile/profile-card-cache";
import { dmApi, type LinkPreview } from "./dm-api";

const compact = new Intl.NumberFormat(undefined, countFormat);

function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  return [ref, visible] as const;
}

function Count({ icon: Icon, value, label }: { icon: typeof Heart; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums" title={`${value} ${label}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      <span aria-hidden="true">{compact.format(value)}</span>
      <span className="sr-only">{value} {label}</span>
    </span>
  );
}

export function PostCard({ postId, href }: { postId: string; href: string }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [state, setState] = useState<{ post?: Post; failed?: boolean }>({});
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    api.postPreview(postId, AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]))
      .then(({ post }) => { if (!controller.signal.aborted) setState({ post }); })
      .catch(() => { if (!controller.signal.aborted) setState({ failed: true }); });
    return () => controller.abort();
  }, [visible, postId]);
  const { post, failed } = state;
  const target = new URL(href);
  const internal = target.origin === window.location.origin;
  const className = "block w-full max-w-md overflow-hidden rounded-xl border bg-card text-left text-sm text-card-foreground transition-colors hover:bg-muted/50";
  const body = post ? (
    <span className="block space-y-2 px-3.5 py-3">
      <span className="flex items-center gap-2.5">
        <Avatar className="size-8 shrink-0">
          {post.author.avatarUrl && <AvatarImage src={post.author.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="text-[0.65rem]">{(post.author.displayName || post.author.handle).slice(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-semibold">{post.author.displayName || post.author.handle}</span>
          <span className="block truncate text-xs text-muted-foreground">
            @{post.author.handle} · <time dateTime={post.createdAt}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</time>
          </span>
        </span>
        <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/post:opacity-100" />
      </span>
      {post.content && (
        <div dir="auto" className="relative [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_[role=button]]:pointer-events-auto">
          <PostText post={post} previewExternalLinks={false} collapsible={false}
            className="leading-relaxed wrap-anywhere whitespace-pre-wrap max-h-40 overflow-hidden [mask-image:linear-gradient(black_calc(100%-1.5rem),transparent)]" />
        </div>
      )}
      {post.poll && (
        <span className="flex items-start gap-1.5 text-muted-foreground">
          <ListChecks aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="line-clamp-2 wrap-anywhere">{post.poll.title}</span>
        </span>
      )}
      {post.voice && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Mic aria-hidden="true" className="size-4 shrink-0" /> Voice note
        </span>
      )}
      {post.gif && <img src={post.gif.url} alt={post.gif.title || "GIF"} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="max-h-52 max-w-full rounded-lg object-contain" />}
      <span className="flex items-center gap-4 pt-0.5 text-xs text-muted-foreground">
        <Count icon={Heart} value={post.likes} label="likes" />
        <Count icon={MessageCircle} value={post.replies} label="replies" />
        <Count icon={Repeat2} value={post.reposts} label="reposts" />
      </span>
    </span>
  ) : failed ? (
    <span className="flex items-center justify-between gap-2 px-3.5 py-3">
      <span>
        <span className="block font-semibold">View post</span>
        <span className="block text-xs text-muted-foreground">Preview unavailable</span>
      </span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </span>
  ) : (
    <span className="block space-y-2.5 px-3.5 py-3" aria-busy="true">
      <span className="flex items-center gap-2.5"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-3.5 w-32" /></span>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-2/3" />
    </span>
  );
  const label = post ? `Post by ${post.author.displayName || post.author.handle}` : "View post";
  return (
    <div ref={ref} className={cn(className, "group/post relative")}>
      {internal
        ? <Link to={target.pathname + target.search} aria-label={label} className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        : <a href={href} aria-label={label} className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" />}
      <div className="pointer-events-none relative z-10">{body}</div>
    </div>
  );
}

export function ProfileCard({ handle }: { handle: string }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const { card, failed } = useProfileCard(handle, visible);
  const profile = card?.profile;
  const name = profile?.displayName.trim();
  const bio = profile?.bio.trim();
  const loading = !profile && card !== null && !failed;

  return (
    <div ref={ref}>
      <Link
        to={`/@${handle}`}
        aria-busy={loading}
        className="block w-full max-w-md space-y-2 overflow-hidden rounded-xl border bg-card px-3.5 py-3 text-sm text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar className="size-10 shrink-0">
            {profile?.avatarUrl && (
              <AvatarImage src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback>{(name || handle).slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 leading-tight">
            {name && <bdi className="block truncate font-semibold">{name}</bdi>}
            <span className={cn("block truncate", name ? "text-xs text-muted-foreground" : "font-semibold")}>
              @{handle}
            </span>
            {(card === null || failed) && (
              <span className="block text-xs text-muted-foreground">Preview unavailable</span>
            )}
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </span>
        {bio && <span dir="auto" className="line-clamp-2 wrap-anywhere">{bio}</span>}
      </Link>
    </div>
  );
}

export function LinkCard({ href }: { href: string }) {
  const [ref, visible] = useVisible<HTMLDivElement>();
  const [preview, setPreview] = useState<LinkPreview | null | undefined>(undefined);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    dmApi.linkPreview(href, AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]))
      .then((result) => { if (!controller.signal.aborted) setPreview(result ?? null); })
      .catch(() => { if (!controller.signal.aborted) setPreview(null); });
    return () => controller.abort();
  }, [visible, href]);
  const host = new URL(href).hostname;
  if (preview === null) return <div ref={ref} />;
  if (preview === undefined) {
    return (
      <div ref={ref} className="w-full max-w-md overflow-hidden rounded-xl border bg-card" aria-busy="true">
        <Skeleton className="h-40 w-full rounded-none" />
        <div className="space-y-2 px-3.5 py-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-4/5" /></div>
      </div>
    );
  }
  const image = preview.imageKey && !imageFailed ? dmApi.linkPreviewAsset("image", href, preview.imageKey) : undefined;
  if (preview.kind === "image") {
    return image ? (
      <div ref={ref}>
        <ExternalLink href={preview.href} className="inline-block max-w-full overflow-hidden rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <img src={image} alt={preview.title} loading="lazy" decoding="async" onError={() => setImageFailed(true)} className="block max-h-80 max-w-full object-contain" />
        </ExternalLink>
      </div>
    ) : <div ref={ref} />;
  }
  const icon = preview.iconKey ? dmApi.linkPreviewAsset("icon", href, preview.iconKey) : undefined;
  return (
    <div ref={ref} className="w-full max-w-md">
      <ExternalLink
        href={preview.href}
        className="block overflow-hidden rounded-xl border bg-card text-sm text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {image && <img src={image} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} className="aspect-[1.91/1] w-full bg-muted object-cover" />}
        <span className="block space-y-1 px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {icon ? <img src={icon} alt="" width={14} height={14} className="size-3.5 rounded-sm" /> : <Globe aria-hidden="true" className="size-3.5" />}
            <span className="truncate">{preview.siteName || host}</span>
          </span>
          <span dir="auto" className="line-clamp-2 font-medium wrap-anywhere">{preview.title}</span>
          {preview.description && <span dir="auto" className={cn("line-clamp-2 text-muted-foreground")}>{preview.description}</span>}
        </span>
      </ExternalLink>
    </div>
  );
}
