import assert from "node:assert/strict";
import test from "node:test";
import { resolveBranding, variationOn } from "../src/lib/branding.ts";

const on = (month, day) => variationOn(new Date(2027, month - 1, day))?.id ?? null;

test("each variation shows on its day or month and the main logo does the rest of the year", () => {
  assert.equal(on(2, 4), "world-cancer-day");
  assert.equal(on(4, 22), "earth-day");
  assert.equal(on(2, 1), "black-history-month");
  assert.equal(on(2, 28), "black-history-month");
  assert.equal(on(6, 1), "pride-month");
  assert.equal(on(6, 30), "pride-month");
  for (const [month, day] of [[1, 15], [3, 1], [4, 21], [5, 31], [7, 1], [11, 22], [12, 31]])
    assert.equal(on(month, day), null, `${month}/${day}`);
});

test("a single day beats the month it falls in", () => {
  assert.equal(on(2, 3), "black-history-month");
  assert.equal(on(2, 4), "world-cancer-day");
  assert.equal(on(2, 5), "black-history-month");
});

test("people can pin a variation, the main logo, or follow the calendar", () => {
  const november = new Date(2027, 10, 22);
  assert.equal(resolveBranding("auto", november), null);
  assert.equal(resolveBranding("pride-month", november)?.id, "pride-month");
  assert.equal(resolveBranding("default", new Date(2027, 5, 10)), null);
  assert.equal(resolveBranding("auto", new Date(2027, 5, 10))?.id, "pride-month");
});

test("every variation links to an https website and ships both artworks", () => {
  for (const month of Array.from({ length: 12 }, (_, index) => index)) {
    const variation = variationOn(new Date(2027, month, 4));
    if (!variation) continue;
    assert.match(variation.href, /^https:\/\//);
    assert.match(variation.wordmark.src, /^\/branding\/.+-wordmark\.png$/);
    assert.match(variation.logo.src, /^\/branding\/.+-logo\.png$/);
  }
});
