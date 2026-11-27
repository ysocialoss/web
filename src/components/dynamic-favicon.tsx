import { useEffect } from "react";
import { useBranding, type Variation } from "@/lib/branding";
import { useCelebrations } from "@/lib/celebrations";

const SIZE = 128;
const ART_WIDTH = 306;
const ART_HEIGHT = 189;

type Art = { source: string; square?: boolean };

const composed = new Map<string, Promise<string>>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function compose({ source, square = false }: Art) {
  const key = `${source}|${square}`;
  let result = composed.get(key);
  if (!result) {
    result = loadImage(source).then((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      if (square) {
        context.drawImage(image, 0, 0, SIZE, SIZE);
      } else {
        const height = (ART_HEIGHT * SIZE) / ART_WIDTH;
        context.drawImage(image, 0, (SIZE - height) / 2, SIZE, height);
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

function artFor(variation: Variation | null, christmas: boolean): Art | null {
  if (variation && variation.id !== "anniversary") return { source: variation.logo.src, square: variation.logo.width === variation.logo.height };
  if (christmas) return { source: "/favicon-christmas.png", square: true };
  return null;
}

export function DynamicFavicon() {
  const { active } = useBranding();
  const { christmasSeason: christmas } = useCelebrations();
  useEffect(() => {
    const art = artFor(active, christmas);
    if (!art) {
      showOriginal();
      return;
    }
    let current = true;
    compose(art).then(
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
  }, [active, christmas]);
  return null;
}
