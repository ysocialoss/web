const marker = "\u0001";
const identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type MessageGif = { url: string; previewUrl?: string; title: string; width?: number; height?: number };
export type MessagePoll = { title: string; options: string[] };
export type MessageVoice = { id: string; key: string; iv: string; mime: string; seconds: number; wave?: number[] };
/** An end-to-end encrypted file; its ciphertext is bound to the conversation and id (see `fileBinding`). */
export type MessageFile = { id: string; key: string; iv: string; mime: string; name: string; size: number };
export type MessagePayload = { text: string; reply?: string; gif?: MessageGif; poll?: MessagePoll; voice?: MessageVoice; file?: MessageFile };

export const fileLimits = { name: 200, size: 25 * 1024 * 1024 };

export const pollLimits = { title: 140, option: 60, options: 6 };

export function encodePayload({ text, reply, gif, poll, voice, file }: MessagePayload) {
  if (!reply && !gif && !poll && !voice && !file) return text;
  return marker + JSON.stringify({ r: reply, t: text || undefined, g: gif, p: poll, v: voice, f: file });
}

const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const compact = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, part]) => part !== undefined)) as T;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";

function readGif(value: unknown): MessageGif | undefined {
  if (!object(value) || !text(value.url, 2048) || !text(value.title, 200)) return;
  if (!/^https:\/\//.test(value.url as string)) return;
  const previewUrl = text(value.previewUrl, 2048) && /^https:\/\//.test(value.previewUrl as string) ? value.previewUrl as string : undefined;
  return compact({
    url: value.url as string, previewUrl, title: value.title as string,
    width: number(value.width) ? value.width as number : undefined, height: number(value.height) ? value.height as number : undefined,
  });
}

function readPoll(value: unknown): MessagePoll | undefined {
  if (!object(value) || !text(value.title, pollLimits.title) || !Array.isArray(value.options)) return;
  const options = value.options;
  if (options.length < 2 || options.length > pollLimits.options || !options.every((option) => text(option, pollLimits.option))) return;
  return { title: value.title as string, options: options as string[] };
}

function readVoice(value: unknown): MessageVoice | undefined {
  if (!object(value) || !identifier.test(String(value.id)) || !text(value.key, 64) || !text(value.iv, 32) || !text(value.mime, 80) || !number(value.seconds)) return;
  const wave = Array.isArray(value.wave) && value.wave.length <= 128 && value.wave.every(number) ? value.wave as number[] : undefined;
  return { id: value.id as string, key: value.key as string, iv: value.iv as string, mime: value.mime as string, seconds: value.seconds as number, wave };
}

/** Keeps a display-safe file name: no paths, control or bidi characters. */
export function cleanFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/\p{Cc}|\p{Cf}/gu, "").trim().slice(0, fileLimits.name);
  return clean && clean !== "." && clean !== ".." ? clean : "file";
}

const mimeType = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

function readFile(value: unknown): MessageFile | undefined {
  if (!object(value) || !identifier.test(String(value.id)) || !text(value.key, 64) || !text(value.iv, 32)) return;
  if (!text(value.mime, 80) || !mimeType.test(value.mime as string) || !text(value.name, fileLimits.name)) return;
  if (!Number.isSafeInteger(value.size) || (value.size as number) < 0 || (value.size as number) > fileLimits.size) return;
  return {
    id: value.id as string, key: value.key as string, iv: value.iv as string, mime: (value.mime as string).toLowerCase(),
    name: cleanFileName(value.name as string), size: value.size as number,
  };
}

export function decodePayload(raw: string): MessagePayload {
  if (!raw.startsWith(marker)) return { text: raw };
  try {
    const value: unknown = JSON.parse(raw.slice(1));
    if (object(value) && (value.t === undefined || typeof value.t === "string")) {
      const reply = value.r === undefined ? undefined : typeof value.r === "string" && identifier.test(value.r) ? value.r : null;
      if (reply !== null) {
        return compact({ text: (value.t as string | undefined) ?? "", reply, gif: readGif(value.g), poll: readPoll(value.p), voice: readVoice(value.v), file: readFile(value.f) });
      }
    }
  } catch {
    return { text: raw.slice(1) };
  }
  return { text: raw.slice(1) };
}

export function notificationLabel({ text, gif, poll, voice, file }: MessagePayload) {
  if (text.trim()) return text;
  if (file) return file.mime.startsWith("image/") ? "Photo" : `File: ${file.name}`;
  if (voice) return "Voice message";
  if (poll) return `Poll: ${poll.title}`;
  if (gif) return "GIF";
  return "";
}

export function payloadSummary({ text, gif, poll, voice, file }: MessagePayload) {
  const parts = [text];
  if (gif) parts.push(`GIF ${gif.title}`);
  if (poll) parts.push(`Poll ${poll.title} ${poll.options.join(" ")}`);
  if (voice) parts.push("Voice message");
  if (file) parts.push(`File ${file.name}`);
  return parts.filter(Boolean).join(" ");
}
