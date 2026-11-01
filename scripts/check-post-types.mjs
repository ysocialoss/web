// Verify the composer contract against the API README and the rendered production UI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  acceptsPostMedia,
  canPublishPost,
  mediaAccepts,
  postTypeLabels,
} from "../src/lib/post-types.ts";
import render from "../.output/server/_chunks/ssr-renderer.mjs";

const readme = await readFile(
  new URL("../../api/README.md", import.meta.url),
  "utf8",
);
const typeDeclaration = readme.match(/"type":([^\n]+)/)?.[1];
assert.ok(typeDeclaration, "The API README must declare post types");
const documentedTypes = [...typeDeclaration.matchAll(/"([^"]+)"/g)].map(
  (match) => match[1],
);
assert.deepEqual(
  Object.keys(postTypeLabels).sort(),
  documentedTypes.sort(),
  "Composer types must exactly match the API README",
);

for (const [type, mime] of [
  ["image", "image/png"],
  ["gif", "image/gif"],
  ["video", "video/mp4"],
  ["voice", "audio/webm"],
]) {
  assert.ok(acceptsPostMedia(type, mime), `${type}: accepts matching media`);
  assert.ok(
    !acceptsPostMedia(type, "application/pdf"),
    `${type}: rejects generic files`,
  );
  assert.ok(
    !canPublishPost({ type, text: "Caption", mediaCount: 0 }),
    `${type}: requires media`,
  );
  assert.ok(
    canPublishPost({ type, text: "", mediaCount: 1 }),
    `${type}: allows an empty caption`,
  );
  assert.ok(mediaAccepts[type], `${type}: has a file-picker filter`);
}
assert.ok(
  !acceptsPostMedia("image", "image/gif"),
  "GIF posts use the GIF type",
);
assert.ok(!canPublishPost({ type: "text", text: "  ", mediaCount: 0 }));
assert.ok(canPublishPost({ type: "text", text: "Hello", mediaCount: 0 }));
for (const type of ["live", "streams"])
  assert.ok(canPublishPost({ type, text: "", mediaCount: 0 }));

const response = await render({ req: new Request("http://localhost/") });
const html = await response.text();
const toolbar =
  html.match(/<div[^>]*role="toolbar"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "";
const labels = [...toolbar.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(
  (match) => match[1],
);
assert.deepEqual(labels, [
  "Add images",
  "Add GIF",
  "Add video",
  "Add voice",
  "Live post",
  "Stream post",
]);
assert.ok(
  html.includes("Schedule post"),
  "Scheduling is documented by the API",
);
console.log(
  "API post types, media validation, submission rules, and rendered toolbar checks passed.",
);
