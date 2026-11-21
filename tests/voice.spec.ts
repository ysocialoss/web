import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "88888888-8888-4888-8888-888888888888",
  handle: "voice_tester",
  displayName: "Voice tester",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
};
const voice = {
  token: "signed-recording",
  url: "/api/voices/voice.m4a",
  durationMs: 3000,
  bytes: 18000,
};

async function openMicDialog(page: Page) {
  await page
    .getByRole("button", { name: "Record voice message", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Allow microphone access" });
}

async function requestMicrophone(page: Page) {
  const dialog = await openMicDialog(page);
  await dialog
    .getByRole("button", { name: "Allow microphone", exact: true })
    .click();
}

test.beforeEach(async ({ page }) => {
  // The fake device can report pre-granted access. Exercise the app prompt
  // through the fallback used by browsers without a microphone query.
  await page.addInitScript(() => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (descriptor) =>
      descriptor.name === "microphone"
        ? Promise.reject(
            new TypeError("Microphone permission query unavailable"),
          )
        : query(descriptor);
  });
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: false,
        user,
        avatarUrl: null,
        suggestedHandle: user.handle,
      },
    }),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/posts" && route.request().method() === "GET")
      await route.fulfill({
        json: {
          posts: [],
          nextCursor: null,
          serverNow: new Date().toISOString(),
        },
      });
    else if (path.includes("topics"))
      await route.fulfill({ json: { topics: [] } });
    else if (path.includes("notifications"))
      await route.fulfill({
        json: { notifications: [], unreadCount: 0, nextCursor: null },
      });
    else await route.fulfill({ json: {} });
  });
});

test("records compressed audio, previews, publishes voice-only posts and resets", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const observe = IntersectionObserver.prototype.observe;
    IntersectionObserver.prototype.observe = function (target) {
      // A play click must still start a download if viewport preloading did not run.
      if (target.querySelector('[aria-label^="Voice message, "]')) return;
      observe.call(this, target);
    };
  });
  let uploadedType = "";
  let recordedAudio: Buffer | null = null;
  let discarded = false;
  let downloads = 0;
  let resumeAudio = () => {};
  const recovered = new Promise<void>((resolve) => {
    resumeAudio = resolve;
  });
  await page.route("**/api/voices/voice.m4a", async (route) => {
    downloads++;
    if (downloads === 1) {
      await route.fulfill({ status: 503, body: "" });
      return;
    }
    await recovered;
    await route.fulfill({
      contentType: "application/octet-stream",
      path: fileURLToPath(new URL("./fixtures/voice-aac.m4a", import.meta.url)),
    });
  });
  await page.route("**/api/voices", async (route) => {
    if (route.request().method() === "DELETE") {
      discarded = true;
      await route.fulfill({ status: 204 });
      return;
    }
    uploadedType = route.request().headers()["content-type"];
    recordedAudio = route.request().postDataBuffer();
    await route.fulfill({ status: 201, json: voice });
  });
  let sent: unknown;
  await page.route("**/api/posts", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          posts: [],
          nextCursor: null,
          serverNow: new Date().toISOString(),
        },
      });
      return;
    }
    const body = route.request().postDataJSON();
    sent = body;
    await route.fulfill({
      status: 201,
      json: {
        post: {
          id: body.clientId,
          content: body.content,
          voice,
          gif: null,
          poll: null,
          parentId: null,
          author: user,
          createdAt: new Date().toISOString(),
          editedAt: null,
          editExpiresAt: new Date(Date.now() + 900000).toISOString(),
          likes: 0,
          liked: false,
          replies: 0,
          reposts: 0,
          reposted: false,
        },
        serverNow: new Date().toISOString(),
      },
    });
  });
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Publish post", exact: true }),
  ).toBeDisabled();
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  await expect(page.getByLabel("Voice message preview")).toBeVisible();
  expect(uploadedType).toMatch(/audio\/(webm|ogg|mp4)/);
  expect((recordedAudio ?? Buffer.alloc(0)).length).toBeGreaterThan(100);
  expect((recordedAudio ?? Buffer.alloc(0)).length).toBeLessThan(100000);
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await expect
    .poll(() => sent)
    .toMatchObject({ content: "", voiceToken: voice.token });
  await expect(page.getByLabel("Voice message preview")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
  const published = page.getByRole("group", {
    name: "Voice message, 3 seconds",
  });
  await expect(published).toBeVisible();
  await published.getByRole("button", { name: "Play voice message" }).click();
  await expect(
    published.getByRole("button", { name: "Cancel loading voice message" }),
  ).toBeVisible();
  await expect(published.getByRole("alert")).toHaveCount(0);
  await published.evaluate((player) => {
    player.addEventListener("transitionrun", (event) => {
      if (
        event instanceof TransitionEvent &&
        event.propertyName === "clip-path" &&
        event.target instanceof HTMLElement &&
        event.target.dataset.waveform === "visible"
      )
        player.setAttribute("data-wipe-started", "true");
    });
  });
  resumeAudio();
  await expect(
    published.getByRole("button", { name: "Pause voice message" }),
  ).toBeVisible();
  expect(downloads).toBe(2);
  const reveal = published.locator('[data-waveform="visible"]');
  await expect(published).toHaveAttribute("data-wipe-started", "true");
  await expect(reveal).toHaveCSS("opacity", "1");
  const waveform = reveal.locator("canvas");
  await expect
    .poll(() =>
      waveform.evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
          .getContext("2d")
          ?.getImageData(0, 0, canvas.width, canvas.height).data;
        return (
          pixels?.some(
            (channel, index) =>
              index % 4 === 1 &&
              channel > 100 &&
              channel > pixels[index - 1] &&
              pixels[index + 2] > 0,
          ) ?? false
        );
      }),
    )
    .toBe(true);
  const publishedAudio = published.locator("audio");
  const currentTime = () =>
    publishedAudio.evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await expect.poll(currentTime).toBeGreaterThan(0.15);
  await published.getByRole("button", { name: "Pause voice message" }).click();
  const seek = published.getByRole("slider", { name: "Seek voice message" });
  await seek.press("End");
  await expect.poll(currentTime).toBeGreaterThan(2.9);
  await seek.press("Home");
  await expect.poll(currentTime).toBeLessThan(0.05);
  await published.getByRole("button", { name: "Play voice message" }).click();
  await expect.poll(currentTime).toBeGreaterThan(0.15);
  expect(discarded).toBe(false);
});

test("cancel stops the microphone and does not upload", async ({ page }) => {
  let uploads = 0;
  await page.route("**/api/voices", (route) => {
    uploads++;
    return route.fulfill({ status: 201, json: voice });
  });
  await page.goto("/");
  await requestMicrophone(page);
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove voice message", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
  expect(uploads).toBe(0);
});

test("permission denial allows another attempt", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await requestMicrophone(page);
  await expect(
    page.getByRole("alert").filter({ hasText: "Microphone access was denied" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
});

test("a missing microphone shows connection guidance and allows another attempt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Requested device not found", "NotFoundError");
    };
  });
  await page.goto("/");
  await requestMicrophone(page);
  await expect(
    page.getByRole("alert").filter({
      hasText: "No microphone found. Connect a microphone and try again.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
});

test("automatically stops at the maximum and surfaces server length errors", async ({
  page,
}) => {
  await page.clock.install();
  await page.route("**/api/voices", (route) =>
    route.fulfill({ status: 400, json: { error: "voice_too_short" } }),
  );
  await page.goto("/");
  await requestMicrophone(page);
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(119500);
  await expect(
    page.getByRole("alert").filter({ hasText: "Record at least 2 seconds" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Publish post", exact: true }),
  ).toBeDisabled();
});

test("cancelling a pending permission request releases a late microphone stream", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTimeout(() => {
        document.documentElement.dataset.microphoneState =
          stream.getTracks()[0].readyState;
      }, 100);
      return stream;
    };
  });
  await page.goto("/");
  await requestMicrophone(page);
  await expect(page.getByText("Waiting for microphone…")).toBeVisible();
  await page
    .getByRole("button", { name: "Remove voice message", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-microphone-state",
    "ended",
  );
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
});

test("keeps the recording and retries an empty proxy 502 after the API restarts", async ({
  page,
}) => {
  const uploads: Buffer[] = [];
  await page.route("**/api/voices", async (route) => {
    uploads.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
    if (uploads.length === 1)
      await route.fulfill({ status: 502, contentType: "text/plain", body: "" });
    else await route.fulfill({ status: 201, json: voice });
  });
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  await expect(page.getByLabel("Voice message preview")).toBeVisible({
    timeout: 10000,
  });
  expect(uploads).toHaveLength(2);
  expect(uploads[0].length).toBeGreaterThan(100);
  expect(uploads[1]).toEqual(uploads[0]);
  await expect(
    page.getByRole("button", { name: "Publish post", exact: true }),
  ).toBeEnabled();
});

test("cancelling an upload during API downtime stops background retries", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/voices", async (route) => {
    attempts++;
    await route.fulfill({ status: 502, contentType: "text/plain", body: "" });
  });
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  await expect.poll(() => attempts).toBe(1);
  await page
    .getByRole("button", { name: "Remove voice message", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
  await page.clock.install();
  await page.clock.fastForward(30000);
  expect(attempts).toBe(1);
  await expect(page.getByLabel("Voice message preview")).toHaveCount(0);
});

test("removing an uploaded recording explicitly deletes its server draft", async ({
  page,
}) => {
  const discarded: unknown[] = [];
  await page.route("**/api/voices", async (route) => {
    if (route.request().method() === "DELETE") {
      discarded.push(route.request().postDataJSON());
      await route.fulfill({ status: 204 });
    } else await route.fulfill({ status: 201, json: voice });
  });
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  await expect(page.getByLabel("Voice message preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Remove voice message", exact: true })
    .click();
  await expect.poll(() => discarded).toEqual([{ token: voice.token }]);
  await expect(page.getByLabel("Voice message preview")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Publish post", exact: true }),
  ).toBeDisabled();
});

test("removing audio during upload deletes the draft when its response arrives", async ({
  page,
}) => {
  let finishUpload = () => {};
  let uploading = false;
  let discarded = false;
  await page.route("**/api/voices", async (route) => {
    if (route.request().method() === "DELETE") {
      expect(route.request().postDataJSON()).toEqual({ token: voice.token });
      discarded = true;
      await route.fulfill({ status: 204 });
      return;
    }
    await new Promise<void>((resolve) => {
      finishUpload = resolve;
      uploading = true;
    });
    await route.fulfill({ status: 201, json: voice });
  });
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  await expect.poll(() => uploading).toBe(true);
  const recorder = page.getByRole("region", { name: "Voice recorder" });
  await expect(recorder.getByRole("status")).toHaveText("Processing");
  await expect(recorder.getByRole("timer")).toBeVisible();
  await expect(stop).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove voice message", exact: true })
    .click();
  finishUpload();
  await expect.poll(() => discarded).toBe(true);
  await expect(page.getByLabel("Voice message preview")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record voice message", exact: true }),
  ).toBeEnabled();
});

test("recording card fits mobile and previews with custom playback controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/voices", (route) =>
    route.fulfill({ status: 201, json: voice }),
  );
  await page.goto("/");
  await requestMicrophone(page);
  const card = page.getByRole("region", { name: "Voice recorder" });
  await expect(card).toBeVisible();
  const canvases = card.locator("canvas");
  const hasWaveform = (canvas: HTMLCanvasElement) =>
    canvas
      .getContext("2d")
      ?.getImageData(0, 0, canvas.width, canvas.height)
      .data.some((channel, index) => index % 4 === 3 && channel > 0) ?? false;
  await expect.poll(() => canvases.first().evaluate(hasWaveform)).toBe(true);
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  }
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  await expect(canvases).toHaveCount(2);
  await expect.poll(() => canvases.last().evaluate(hasWaveform)).toBe(true);
  await page
    .getByRole("button", { name: "Play voice preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause voice preview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause voice preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play voice preview", exact: true }),
  ).toBeVisible();
  const seek = page.getByRole("slider", { name: "Seek voice preview" });
  await expect(seek).toBeEnabled();
  await seek.press("Home");
  await seek.press("ArrowRight");
  await expect(seek).toHaveAttribute("aria-valuenow", "0.01");
});

test("microphone consent waits for Allow and skips the dialog after a successful request", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = (constraints) => {
      document.documentElement.dataset.micRequested = "true";
      return getUserMedia(constraints);
    };
  });
  await page.goto("/");
  const dialog = await openMicDialog(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mic-requested",
    "true",
  );
  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-mic-requested",
    "true",
  );

  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeVisible();
  await page
    .getByRole("button", { name: "Remove voice message", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record voice message", exact: true })
    .click();
  await expect(stop).toBeVisible();
  await expect(dialog).toBeHidden();
});

test("reuses the upload ID across proxy and capacity failures, then polls a queued voice job", async ({
  page,
}) => {
  const submittedIds: string[] = [];
  let polls = 0;
  await page.route("**/api/voices/jobs/*", async (route) => {
    expect(route.request().method()).toBe("GET");
    expect((await route.request().allHeaders()).origin).toBeUndefined();
    expect(new URL(route.request().url()).pathname).toBe(
      `/api/voices/jobs/${submittedIds[0]}`,
    );
    polls++;
    if (polls === 1)
      await route.fulfill({ status: 503, json: { error: "starting" } });
    else if (polls === 2)
      await route.fulfill({ status: 202, json: { pending: true } });
    else await route.fulfill({ status: 200, json: voice });
  });
  await page.route("**/api/voices", async (route) => {
    const id = route.request().headers()["idempotency-key"];
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    submittedIds.push(id);
    if (submittedIds.length === 1)
      await route.fulfill({ status: 502, body: "" });
    else if (submittedIds.length === 2)
      await route.fulfill({
        status: 429,
        json: { error: "voice_processing_busy" },
      });
    else
      await route.fulfill({ status: 202, json: { pending: true, jobId: id } });
  });
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  const banner = page.getByText("There’s a connection issue with ysocial.", {
    exact: true,
  });
  await expect(banner).toBeVisible();
  await expect.poll(() => submittedIds.length).toBeGreaterThanOrEqual(2);
  await expect(banner).toBeHidden();
  await expect.poll(() => polls, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
  await expect(banner).toBeVisible();
  await expect.poll(() => polls).toBeGreaterThanOrEqual(2);
  await expect(banner).toBeHidden();
  await expect(page.getByLabel("Voice message preview")).toBeVisible({
    timeout: 15_000,
  });
  expect(submittedIds).toHaveLength(3);
  expect(new Set(submittedIds).size).toBe(1);
  expect(polls).toBe(3);
});

test("the draft waveform appears even when browser audio decoding hangs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    AudioContext.prototype.decodeAudioData = () =>
      new Promise<AudioBuffer>(() => {});
  });
  await page.route("**/api/voices", (route) =>
    route.fulfill({
      status: 201,
      json: {
        ...voice,
        waveform: Array.from({ length: 48 }, (_, index) =>
          index % 3 === 0 ? 85 : 25,
        ),
      },
    }),
  );
  await page.goto("/");
  await requestMicrophone(page);
  const stop = page.getByRole("button", {
    name: "Stop recording",
    exact: true,
  });
  await expect(stop).toBeEnabled({ timeout: 5000 });
  await stop.click();
  const waveform = page
    .getByLabel("Voice message preview")
    .locator('[data-waveform="visible"]');
  await expect(waveform).toHaveCSS("opacity", "1");
  await expect(waveform.locator("canvas")).toBeVisible();
});
