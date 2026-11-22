import { useEffect } from "react";
import { useDmUnread } from "@/features/dms/dm-unread";
import { useNotifications } from "@/features/notifications/notifications-context";
import { useBranding, type Variation } from "@/lib/branding";

const SIZE = 128;
const ART_WIDTH = 306;
const ART_HEIGHT = 189;
const DOT = { x: 241.5, y: 53.5, r: 40.5, color: "#0F8AD7" };

const composed = new Map<string, Promise<string>>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function compose(source: string, dot: boolean) {
  const key = `${source}|${dot}`;
  let result = composed.get(key);
  if (!result) {
    result = loadImage(source).then((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      const scale = SIZE / ART_WIDTH;
      const height = ART_HEIGHT * scale;
      context.drawImage(image, 0, (SIZE - height) / 2, SIZE, height);
      if (dot) {
        context.fillStyle = DOT.color;
        context.beginPath();
        context.arc(
          DOT.x * scale,
          (SIZE - height) / 2 + DOT.y * scale,
          DOT.r * scale,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      return canvas.toDataURL("image/png");
    });
    composed.set(key, result);
    result.catch(() => composed.delete(key));
  }
  return result;
}

let original: HTMLLinkElement[] | undefined;
let dynamic: HTMLLinkElement | undefined;

function showOriginal() {
  dynamic?.remove();
  dynamic = undefined;
  for (const link of original ?? []) if (!link.isConnected) document.head.append(link);
}

function showDynamic(href: string) {
  original ??= Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
  );
  for (const link of original) link.remove();
  if (!dynamic) {
    dynamic = document.createElement("link");
    dynamic.rel = "icon";
    dynamic.type = "image/png";
    dynamic.dataset.dynamicFavicon = "";
  }
  dynamic.href = href;
  if (!dynamic.isConnected) document.head.append(dynamic);
}

function artFor(variation: Variation | null, unread: boolean) {
  if (variation) return { source: variation.logo.src, dot: unread };
  return unread ? { source: "/favicon-unread.svg", dot: false } : null;
}

export function DynamicFavicon() {
  const { unreadCount } = useNotifications();
  const { unread } = useDmUnread();
  const { active } = useBranding();
  const hasUnread = unreadCount > 0 || unread > 0;
  useEffect(() => {
    const art = artFor(active, hasUnread);
    if (!art) {
      showOriginal();
      return;
    }
    let current = true;
    compose(art.source, art.dot).then(
      (href) => {
        if (current) showDynamic(href);
      },
      () => {
        if (current) showOriginal();
      },
    );
    return () => {
      current = false;
    };
  }, [active, hasUnread]);
  return null;
}
