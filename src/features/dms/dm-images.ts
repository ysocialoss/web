/**
 * Re-encodes still photos to WebP before they are encrypted: smaller uploads, a bounded size,
 * and no EXIF (GPS, camera, timestamps) leaking to the recipient. Anything that can't be
 * converted faithfully (animations, formats this browser can't decode or encode) is sent as is.
 */
const convertible = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/bmp", "image/heic", "image/heif"]);
const maxEdge = 2560;
const quality = 0.85;

const ascii = (bytes: Uint8Array, at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length));

function indexOf(bytes: Uint8Array, text: string) {
  outer: for (let at = 0; at <= bytes.length - text.length; at++) {
    for (let index = 0; index < text.length; index++) if (bytes[at + index] !== text.charCodeAt(index)) continue outer;
    return at;
  }
  return -1;
}

/** Animated WebP, APNG and AVIF sequences would lose every frame but the first. */
export function isAnimated(type: string, head: Uint8Array) {
  if (type === "image/webp") return head.length > 20 && ascii(head, 12, 4) === "VP8X" && (head[20] & 0x02) !== 0;
  if (type === "image/png") {
    const control = indexOf(head, "acTL");
    const data = indexOf(head, "IDAT");
    return control !== -1 && (data === -1 || control < data);
  }
  if (type === "image/avif") return indexOf(head.subarray(0, 64), "avis") !== -1;
  return false;
}

export function webpName(name: string) {
  const stem = name.replace(/\.[^./\\]*$/, "");
  return `${stem || "image"}.webp`;
}

async function encode(width: number, height: number, bitmap: ImageBitmap) {
  const offscreen = typeof OffscreenCanvas !== "undefined";
  const canvas = offscreen ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  if (canvas instanceof HTMLCanvasElement) return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  return canvas.convertToBlob({ type: "image/webp", quality });
}

export async function prepareImage(file: File): Promise<File> {
  if (!convertible.has(file.type)) return file;
  try {
    if (isAnimated(file.type, new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer()))) return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const blob = await encode(width, height, bitmap);
      // Browsers without a WebP encoder silently hand back PNG; keep the original then.
      if (blob?.type !== "image/webp") return file;
      if (file.type === "image/webp" && scale === 1 && blob.size >= file.size) return file;
      return new File([blob], webpName(file.name), { type: "image/webp", lastModified: file.lastModified });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
