import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const emojis = require("emojibase-data/en/compact.json");
const shortcodes = require("emojibase-data/en/shortcodes/github.json");

const groups = new Map();
for (const emoji of emojis) {
  if (emoji.group === 2) continue;
  const raw = shortcodes[emoji.hexcode];
  if (!raw) continue;
  const names = (Array.isArray(raw) ? raw : [raw]).map((name) => name.toLowerCase());
  const primary = names.find((name) => /^[a-z]/.test(name)) ?? names[0];
  const ordered = [primary, ...names.filter((name) => name !== primary)];
  const keywords = [...new Set([...(emoji.tags ?? []), ...emoji.label.toLowerCase().split(/[^a-z0-9]+/)])]
    .filter((word) => word && !ordered.includes(word));
  const group = emoji.group ?? 9;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push([emoji.unicode, ordered, keywords]);
}

const body = [...groups].map(([group, rows]) => `[${group},[\n${rows.map((row) => JSON.stringify(row)).join(",\n")}\n]]`).join(",\n");
writeFileSync(new URL("../src/lib/emoji-data.json", import.meta.url), `[\n${body}\n]\n`);
console.log(`${[...groups.values()].reduce((total, rows) => total + rows.length, 0)} emojis`);
