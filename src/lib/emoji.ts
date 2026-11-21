export type EmojiEntry = {
  emoji: string;
  name: string;
  aliases: string[];
  keywords: string[];
  group: number;
};

export type EmojiIndex = {
  entries: EmojiEntry[];
  byName: Map<string, string>;
  byEmoji: Map<string, string>;
};

export type EmojiMatch = { emoji: string; name: string };
export type EmojiSpan = {
  start: number;
  end: number;
  emoji: string;
  name: string;
};
export type ShortcodeQuery = { start: number; end: number; query: string };

type Row = [string, string[], string[]];
type Group = [number, Row[]];

export const MIN_QUERY_LENGTH = 2;
export const MAX_SUGGESTIONS = 40;
export const JUMBO_MAX = 27;

const NAME = "[a-z0-9_+-]";
const TOKEN = `(?<!\\d):(${NAME}{1,32})(?=:)`;

export function buildEmojiIndex(groups: readonly Group[]): EmojiIndex {
  const entries: EmojiEntry[] = [];
  const byName = new Map<string, string>();
  const byEmoji = new Map<string, string>();
  for (const [group, rows] of groups) {
    for (const [emoji, [name, ...aliases], keywords] of rows) {
      entries.push({ emoji, name, aliases, keywords, group });
      byEmoji.set(emoji, name);
      for (const alias of [name, ...aliases])
        if (!byName.has(alias)) byName.set(alias, emoji);
    }
  }
  return { entries, byName, byEmoji };
}

let loaded: EmojiIndex | null = null;
let loading: Promise<EmojiIndex> | null = null;

export const peekEmojiIndex = () => loaded;

export function loadEmojiIndex() {
  loading ??= import("./emoji-data.json")
    .then((module) => {
      loaded = buildEmojiIndex(module.default as Group[]);
      return loaded;
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

export function findShortcodes(text: string, index: EmojiIndex) {
  const found: EmojiSpan[] = [];
  if (!text.includes(":")) return found;
  const pattern = new RegExp(TOKEN, "gi");
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const name = match[1].toLowerCase();
    const emoji = index.byName.get(name);
    if (!emoji) continue;
    const end = match.index + match[0].length + 1;
    found.push({ start: match.index, end, emoji, name });
    pattern.lastIndex = end;
  }
  return found;
}

export function renderShortcodes(text: string, index: EmojiIndex) {
  let out = "";
  let last = 0;
  for (const span of findShortcodes(text, index)) {
    out += text.slice(last, span.start) + span.emoji;
    last = span.end;
  }
  return out + text.slice(last);
}

const EMOJI_UNIT =
  "(?:\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3|(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)\\p{Emoji_Modifier}?(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F?)\\p{Emoji_Modifier}?\\uFE0F?)*[\\u{E0020}-\\u{E007F}]*)";
const EMOJI_ONLY = new RegExp(`^\\s*(?:${EMOJI_UNIT}\\s*)+$`, "u");

export function emojiOnlyCount(text: string) {
  if (!EMOJI_ONLY.test(text)) return 0;
  return text.match(new RegExp(EMOJI_UNIT, "gu"))?.length ?? 0;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function findEmojis(text: string, index: EmojiIndex) {
  const found: EmojiSpan[] = [];
  if (!/[^ -~\s]/.test(text)) return found;
  for (const { segment, index: start } of segmenter.segment(text)) {
    const name = index.byEmoji.get(segment);
    if (name)
      found.push({ start, end: start + segment.length, emoji: segment, name });
  }
  return found;
}

export function toShortcodes(text: string, index: EmojiIndex) {
  let out = "";
  let last = 0;
  for (const span of findEmojis(text, index)) {
    out += `${text.slice(last, span.start)}:${span.name}:`;
    last = span.end;
  }
  return out + text.slice(last);
}

export function shortcodeQueryAt(
  text: string,
  caret: number,
): ShortcodeQuery | null {
  const before = new RegExp(
    `(?<!\\d):(${NAME}{${MIN_QUERY_LENGTH},32})$`,
    "i",
  ).exec(text.slice(0, caret));
  if (!before) return null;
  const next = text[caret] ?? "";
  if (new RegExp(NAME, "i").test(next)) return null;
  return {
    start: caret - before[0].length,
    end: next === ":" ? caret + 1 : caret,
    query: before[1].toLowerCase(),
  };
}

function rank(entry: EmojiEntry, query: string) {
  let best = Infinity;
  const names = [entry.name, ...entry.aliases];
  for (const name of names) {
    let score = Infinity;
    if (name === query) score = 0;
    else if (name.startsWith(query)) score = 1;
    else if (name.split(/[_-]/).some((word) => word.startsWith(query)))
      score = 2;
    else if (name.includes(query)) score = 3;
    if (score < best) best = score;
  }
  if (
    best === Infinity &&
    entry.keywords.some((word) => word.startsWith(query))
  )
    best = 4;
  return best;
}

export function searchEmojis(
  index: EmojiIndex,
  query: string,
  limit = MAX_SUGGESTIONS,
): EmojiMatch[] {
  const needle = query.toLowerCase();
  const scored: { entry: EmojiEntry; score: number }[] = [];
  for (const entry of index.entries) {
    const score = rank(entry, needle);
    if (score !== Infinity) scored.push({ entry, score });
  }
  scored.sort(
    (a, b) => a.score - b.score || a.entry.name.length - b.entry.name.length,
  );
  return scored.slice(0, limit).map(({ entry }) => ({
    emoji: entry.emoji,
    name:
      [entry.name, ...entry.aliases].find((name) => name.startsWith(needle)) ??
      entry.name,
  }));
}
