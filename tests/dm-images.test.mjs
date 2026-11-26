import assert from "node:assert/strict";
import test from "node:test";
import { isAnimated, prepareImage, webpName } from "../src/features/dms/dm-images.ts";

const bytes = (...parts) => new Uint8Array(parts.flatMap((part) => typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part));

test("animated images are recognised so they are sent untouched", () => {
  const webp = (flags) => bytes("RIFF", [0, 0, 0, 0], "WEBPVP8X", [10, 0, 0, 0], [flags, 0, 0, 0]);
  assert.equal(isAnimated("image/webp", webp(0x02)), true);
  assert.equal(isAnimated("image/webp", webp(0x10)), false);
  assert.equal(isAnimated("image/webp", bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 ")), false);
  assert.equal(isAnimated("image/png", bytes([137], "PNG", [0, 0, 0, 0], "IHDR", [0, 0, 0, 8], "acTL", [0, 0, 0, 0], "IDAT")), true);
  assert.equal(isAnimated("image/png", bytes([137], "PNG", "IHDR", "IDAT", "acTL")), false);
  assert.equal(isAnimated("image/avif", bytes([0, 0, 0, 0], "ftypavis")), true);
  assert.equal(isAnimated("image/avif", bytes([0, 0, 0, 0], "ftypavif")), false);
  assert.equal(isAnimated("image/jpeg", bytes("acTL")), false);
});

test("converted photos keep their name with a .webp extension", () => {
  assert.equal(webpName("holiday.JPG"), "holiday.webp");
  assert.equal(webpName("scan.final.png"), "scan.final.webp");
  assert.equal(webpName("photo"), "photo.webp");
  assert.equal(webpName(".png"), "image.webp");
});

test("files that aren't convertible photos are passed through", async () => {
  for (const [name, type] of [["a.pdf", "application/pdf"], ["a.gif", "image/gif"], ["a.svg", "image/svg+xml"]]) {
    const file = new File(["x"], name, { type });
    assert.equal(await prepareImage(file), file);
  }
  // No decoder in Node: conversion fails and the original goes out instead of an error.
  const jpeg = new File(["not really a jpeg"], "a.jpg", { type: "image/jpeg" });
  assert.equal(await prepareImage(jpeg), jpeg);
});
