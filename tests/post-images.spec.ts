import { expect, test } from "@playwright/test";

const user = {
  id: "88888888-8888-4888-8888-888888888888",
  handle: "image_tester",
  displayName: "Image tester",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
};
const draftIds = [
  "ba8754c0-e0bc-4725-903f-c9cee4dfd624",
  "cfb282ba-4fa9-4311-a6a8-7e49f5e9437c",
];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jKDsAAAAASUVORK5CYII=",
  "base64",
);

test("removes image drafts and publishes a screened image without a caption", async ({ page }) => {
  await page.route("**/auth/me", (route) => route.fulfill({
    json: { authenticated: true, needsOnboarding: false, user, avatarUrl: null, suggestedHandle: user.handle },
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("topics")) return route.fulfill({ json: { topics: [] } });
    if (path.includes("notifications")) return route.fulfill({
      json: { notifications: [], unreadCount: 0, nextCursor: null },
    });
    return route.fulfill({ json: {} });
  });
  const deleted: string[] = [];
  const firstScreen = Promise.withResolvers<void>();
  const secondScreen = Promise.withResolvers<void>();
  const screens = [firstScreen, secondScreen];
  let uploads = 0;
  await page.route("**/api/post-images", async (route) => {
    expect(route.request().headers()["content-type"]).toBe("application/octet-stream");
    expect(route.request().postDataBuffer()).toEqual(png);
    const index = uploads++;
    expect(route.request().headers()["x-post-image-name"]).toBe(["first.png", "second.png", "rejected.png"][index]);
    const id = draftIds[index];
    await screens[index]?.promise;
    return id
      ? route.fulfill({ status: 201, json: { id } })
      : route.fulfill({ status: 422, json: { error: "post_image_rejected" } });
  });
  await page.route("**/api/post-images/*", (route) => {
    if (route.request().method() === "DELETE") {
      deleted.push(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ contentType: "image/png", body: png });
  });
  let published;
  await page.route("**/api/posts", (route) => {
    const now = new Date().toISOString();
    if (route.request().method() === "GET")
      return route.fulfill({ json: { posts: [], nextCursor: null, serverNow: now } });
    published = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        serverNow: now,
        post: {
          id: published.clientId, content: published.content, imageIds: published.attachmentIds,
          parentId: null, author: user, createdAt: now, editedAt: null, editExpiresAt: now,
          likes: 0, liked: false, reposts: 0, reposted: false, replies: 0,
        },
      },
    });
  });

  await page.goto("/");
  const attach = page.getByRole("button", { name: "Attach images", exact: true });
  const choose = page.waitForEvent("filechooser");
  await attach.click();
  await (await choose).setFiles([
    { name: "first.png", mimeType: "image/png", buffer: png },
    { name: "second.png", mimeType: "image/png", buffer: png },
    { name: "rejected.png", mimeType: "image/png", buffer: png },
  ]);
  const composer = page.getByRole("form", { name: "Post composer" });
  const firstPreview = composer.getByRole("img", { name: "Attached image 1" });
  const firstSpinner = composer.getByRole("status", { name: "Checking image 1" });
  const secondSpinner = composer.getByRole("status", { name: "Checking image 2" });
  const publish = composer.getByRole("button", { name: "Publish post" });
  await expect.poll(() => firstPreview.evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth)).toBe(1);
  await expect(firstSpinner).toBeVisible();
  await expect(secondSpinner).toBeVisible();
  await expect(composer.getByText("Checking images…", { exact: true })).toHaveCount(0);
  firstScreen.resolve();
  await expect(firstSpinner).toHaveCount(0);
  await expect(firstPreview).toBeVisible();
  await expect(secondSpinner).toBeVisible();
  await expect(publish).toBeDisabled();
  secondScreen.resolve();
  await expect(secondSpinner).toHaveCount(0);
  await expect(composer.getByRole("alert")).toContainText("flagged as NSFW");
  await expect(composer.getByRole("img", { name: "Attached image 2" })).toBeVisible();
  await composer.getByRole("button", { name: "Remove image 1" }).click();
  await expect.poll(() => deleted).toEqual([draftIds[0]]);
  await publish.click();
  await expect.poll(() => published).toMatchObject({ content: "", attachmentIds: [draftIds[1]] });
  await expect(composer.getByRole("button", { name: "Remove image 1" })).toHaveCount(0);
  const attachment = page.getByRole("img", { name: "Attached image", exact: true });
  await expect(attachment).toBeVisible();
  await expect.poll(() => attachment.evaluate((image) => image instanceof HTMLImageElement && image.naturalWidth)).toBe(1);
});

test("pasting an image into the composer attaches it", async ({ page }) => {
  await page.route("**/auth/me", (route) => route.fulfill({
    json: { authenticated: true, needsOnboarding: false, user, avatarUrl: null, suggestedHandle: user.handle },
  }));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("topics")) return route.fulfill({ json: { topics: [] } });
    if (path.includes("notifications")) return route.fulfill({
      json: { notifications: [], unreadCount: 0, nextCursor: null },
    });
    return route.fulfill({ json: {} });
  });
  await page.route("**/api/posts", (route) => route.fulfill({
    json: { posts: [], nextCursor: null, serverNow: new Date().toISOString() },
  }));
  const names: (string | undefined)[] = [];
  await page.route("**/api/post-images", (route) => {
    names.push(route.request().headers()["x-post-image-name"]);
    expect(route.request().postDataBuffer()).toEqual(png);
    return route.fulfill({ status: 201, json: { id: draftIds[0] } });
  });

  await page.goto("/");
  const composer = page.getByRole("form", { name: "Post composer" });
  const textbox = composer.getByRole("textbox").first();
  await textbox.click();
  await textbox.evaluate((element, bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, [...png]);
  await expect(composer.getByRole("img", { name: "Attached image 1" })).toBeVisible();
  await expect(composer.getByRole("button", { name: "Remove image 1" })).toBeVisible();
  expect(names).toEqual(["pasted.png"]);
  await expect(textbox).toHaveValue("");
});
