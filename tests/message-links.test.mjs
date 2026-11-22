import assert from "node:assert/strict";
import test from "node:test";
import { messageLinks, readPreviewHtml } from "../src/features/dms/message-links.ts";

test("message links retain their surrounding text and produce distinct, bounded previews", () => {
  const text = "Look https://youtu.be/M7lc1UVf-VE!\nhttps://youtu.be/M7lc1UVf-VE https://example.com/a.png?v=1 https://example.org/article https://example.net/extra";
  const { parts, embeds } = messageLinks(text);
  assert.equal(parts.map(({ text }) => text).join(""), text);
  assert.deepEqual(embeds.map(({ kind }) => kind), ["youtube", "image", "website"]);
  assert.equal(embeds[0].videoId, "M7lc1UVf-VE");
});

test("only recognized public post, video, and image destinations get rich embeds", () => {
  const [post] = messageLinks("http://localhost:3000/posts/48f92b83-4320-4d53-a84d-67fd1cc23fa0", true).embeds;
  assert.equal(post.kind, "post");
  assert.equal(post.link.postId, "48f92b83-4320-4d53-a84d-67fd1cc23fa0");
  assert.equal(messageLinks("https://social.example/posts/48f92b83-4320-4d53-a84d-67fd1cc23fa0", false, "https://social.example").embeds[0].kind, "post");
  assert.equal(messageLinks("https://www.youtube.com/shorts/M7lc1UVf-VE").embeds[0].kind, "youtube");
  assert.equal(messageLinks("https://www.youtube.com.evil.example/watch?v=M7lc1UVf-VE").embeds[0].kind, "website");
  assert.equal(messageLinks("https://example.com/image.svg").embeds[0].kind, "website");
  assert.equal(messageLinks("http://example.com/image.png").embeds[0].kind, "link");
  assert.equal(messageLinks("https://127.0.0.1/image.png").embeds[0].kind, "link");
  assert.equal(messageLinks("https://team.internal/image.png").embeds[0].kind, "link");
});

test("only same-origin profile links resolve to profile cards", () => {
  const origin = "https://ysocial.cc";
  const text = "Meet https://ysocial.cc/@profile_tester?ref=chat.";
  const { parts, embeds } = messageLinks(text, false, origin);
  assert.equal(parts.map(({ text }) => text).join(""), text);
  assert.deepEqual(embeds, [{
    kind: "profile",
    href: "https://ysocial.cc/@profile_tester?ref=chat",
    hostname: "ysocial.cc",
    handle: "profile_tester",
  }]);

  assert.equal(messageLinks("http://localhost:3000/@profile_tester", true, "http://localhost:3000").embeds[0].kind, "profile");
  assert.equal(messageLinks("https://ysocial.cns-preview.de/@profile_tester", false, origin).embeds[0].kind, "link");
  assert.equal(messageLinks("https://example.org/@profile_tester", false, origin).embeds[0].kind, "website");
  assert.equal(messageLinks("https://ysocial.cc/@profile_tester/posts", false, origin).embeds[0].kind, "link");
});

test("website metadata reads use credentialless requests, reject redirects, and cap the HTML read", async (t) => {
  const href = "https://example.org/article";
  const signal = new AbortController().signal;
  const options = { signal, mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" };
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("x".repeat(70_000), {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
  assert.equal((await readPreviewHtml(href, signal)).length, 65_536);
  assert.deepEqual(fetch.mock.calls[0].arguments, [href, options]);
  fetch.mock.mockImplementation(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
  assert.equal(await readPreviewHtml(href, signal), "");
});
