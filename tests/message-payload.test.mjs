import assert from "node:assert/strict";
import test from "node:test";
import { decodePayload, encodePayload, notificationLabel } from "../src/features/dms/message-payload.ts";

const reply = "6b3f2c9e-1d44-4c8a-9a3b-0f1e2d3c4b5a";

test("plain messages are unchanged and replies round-trip", () => {
  assert.equal(encodePayload({ text: "hello" }), "hello");
  assert.deepEqual(decodePayload("hello"), { text: "hello" });
  assert.deepEqual(decodePayload(encodePayload({ text: "yes\nreally", reply })), { text: "yes\nreally", reply });
});

test("malformed reply wrappers fall back to text", () => {
  assert.deepEqual(decodePayload("\u0001not json"), { text: "not json" });
  assert.deepEqual(decodePayload('\u0001{"r":"nope","t":"x"}'), { text: '{"r":"nope","t":"x"}' });
});

test("gifs, polls and voice notes survive the round trip and hostile shapes are dropped", () => {
  const gif = { url: "https://media.example/g.gif", title: "wave" };
  const poll = { title: "Lunch?", options: ["Pizza", "Sushi"] };
  const voice = { id: reply, key: "a", iv: "b", mime: "audio/webm", seconds: 4, wave: [0.1, 0.5] };
  const decoded = decodePayload(encodePayload({ text: "", gif, poll, voice }));
  assert.equal(decoded.text, "");
  assert.deepEqual(decoded.gif, gif);
  assert.deepEqual(decoded.poll, poll);
  assert.deepEqual(decoded.voice, voice);
  const hostile = decodePayload('\u0001' + JSON.stringify({ g: { url: "javascript:alert(1)", title: "x" }, p: { title: "t", options: ["only one"] } }));
  assert.equal(hostile.gif, undefined);
  assert.equal(hostile.poll, undefined);
});

test("files survive the round trip with a cleaned name and hostile shapes are dropped", () => {
  const file = { id: reply, key: "a", iv: "b", mime: "application/pdf", name: "report.pdf", size: 1234 };
  assert.deepEqual(decodePayload(encodePayload({ text: "here", file })), { text: "here", file });
  assert.equal(notificationLabel({ text: "", file }), "File: report.pdf");
  assert.equal(notificationLabel({ text: "", file: { ...file, mime: "image/png" } }), "Photo");
  const decode = (f) => decodePayload("\u0001" + JSON.stringify({ t: "x", f })).file;
  assert.equal(decode({ ...file, name: "../../etc/passwd" }).name, "passwd");
  assert.equal(decode({ ...file, name: "evil‮fdp.exe" }).name, "evilfdp.exe");
  assert.equal(decode({ ...file, name: "\u0000" }).name, "file");
  assert.equal(decode({ ...file, mime: "TEXT/PLAIN" }).mime, "text/plain");
  for (const hostile of [
    { ...file, id: "nope" }, { ...file, size: -1 }, { ...file, size: 25 * 1024 * 1024 + 1 }, { ...file, size: 1.5 },
    { ...file, mime: "text/html; charset=utf-8" }, { ...file, mime: "nonsense" }, { ...file, name: "x".repeat(201) },
    { ...file, key: 5 }, "file",
  ]) assert.equal(decode(hostile), undefined, JSON.stringify(hostile));
});
