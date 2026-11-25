import { expect, test, type Page } from "@playwright/test";

const viewer = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "viewer",
  displayName: "Viewer",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
  navigation: null,
};
const author = {
  id: "88888888-8888-4888-8888-888888888888",
  handle: "feed_author",
  displayName: "Feed author",
  avatarUrl: null,
};
const posts = Array.from({ length: 3 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  content: `Tracked post ${index}.`,
  author,
  parentId: null,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, 10 - index)).toISOString(),
  editedAt: null,
  editExpiresAt: new Date(Date.UTC(2026, 0, 1, 2)).toISOString(),
  likes: 0,
  liked: false,
  replies: 0,
  reposts: 0,
  reposted: false,
}));

type Batch = {
  sessionId: string;
  client: string;
  events: { type: string; postId?: string; surface: string; position?: number; value?: number }[];
};

async function setup(page: Page, { signedIn = true, personalize = true } = {}) {
  const batches: Batch[] = [];
  const feedRequests: string[] = [];
  const likeHeaders: (string | undefined)[] = [];
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    } as unknown as typeof EventSource;
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: signedIn
        ? {
            authenticated: true,
            needsOnboarding: false,
            user: { ...viewer, feedPersonalize: personalize },
            avatarUrl: null,
            suggestedHandle: viewer.handle,
          }
        : { authenticated: false },
    }),
  );
  const page1 = { posts, repostedBy: {}, nextCursor: null, serverNow: new Date().toISOString() };
  await page.route("**/api/posts", (route) => {
    feedRequests.push("latest");
    return route.fulfill({ json: page1 });
  });
  await page.route("**/api/feed/following", (route) => {
    feedRequests.push("following");
    return route.fulfill({ json: { ...page1, posts: posts.slice(0, 1) } });
  });
  await page.route("**/api/posts/states?*", (route) =>
    route.fulfill({ json: { viewerId: signedIn ? viewer.id : null, posts: [] } }),
  );
  await page.route("**/api/feed/events", (route) => {
    batches.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  await page.route(`**/api/posts/${posts[0].id}/like`, (route) => {
    likeHeaders.push(route.request().headers()["x-feed-context"]);
    return route.fulfill({ json: { likes: 1, liked: true } });
  });
  return { batches, feedRequests, likeHeaders };
}

async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

const events = (batches: Batch[]) => batches.flatMap((batch) => batch.events);

test("visible posts are recorded as impressions with dwell, and actions carry the feed context", async ({ page }) => {
  const { batches, likeHeaders } = await setup(page);
  await page.goto("/");
  const first = page.locator(`#post-${posts[0].id}`);
  await expect(first).toContainText(posts[0].content);
  await page.waitForTimeout(900);
  await first.getByRole("button", { name: /like/i }).first().click();
  await expect.poll(() => likeHeaders.length).toBe(1);
  expect(likeHeaders[0]).toBe("latest 0 -");
  await hideTab(page);
  await expect.poll(() => events(batches).length).toBeGreaterThan(1);
  const logged = events(batches);
  const impression = logged.find((event) => event.type === "impression" && event.postId === posts[0].id);
  expect(impression).toMatchObject({ surface: "latest", position: 0 });
  const dwell = logged.find((event) => event.type === "dwell" && event.postId === posts[0].id);
  expect(dwell?.value).toBeGreaterThanOrEqual(500);
  expect(batches[0].client).toMatch(/^(mobile|desktop)$/);
  expect(batches[0].sessionId).toMatch(/^[0-9a-f-]{36}$/);
});

test("opening a post records an open event", async ({ page }) => {
  const { batches } = await setup(page);
  await page.route(`**/api/posts/${posts[1].id}/thread`, (route) =>
    route.fulfill({
      json: { post: posts[1], ancestors: [], replies: [], truncated: false, serverNow: new Date().toISOString() },
    }),
  );
  await page.goto("/");
  await page.locator(`#post-${posts[1].id}`).getByText(posts[1].content).click();
  await expect(page).toHaveURL(new RegExp(`/posts/${posts[1].id}$`));
  await hideTab(page);
  await expect.poll(() => events(batches).some((event) => event.type === "open" && event.postId === posts[1].id)).toBe(true);
});

test("nothing is recorded when personalization is off", async ({ page }) => {
  const { batches, likeHeaders } = await setup(page, { personalize: false });
  await page.goto("/");
  const first = page.locator(`#post-${posts[0].id}`);
  await expect(first).toContainText(posts[0].content);
  await page.waitForTimeout(900);
  await first.getByRole("button", { name: /like/i }).first().click();
  await expect.poll(() => likeHeaders.length).toBe(1);
  expect(likeHeaders[0]).toBeUndefined();
  await hideTab(page);
  await page.waitForTimeout(300);
  expect(batches).toHaveLength(0);
});

test("signed-in readers switch between Latest and Following", async ({ page }) => {
  const { feedRequests, batches } = await setup(page);
  await page.goto("/");
  await expect(page.locator(`#post-${posts[2].id}`)).toBeVisible();
  await page.getByRole("tab", { name: "Following" }).click();
  await expect(page).toHaveURL(/\?feed=following$/);
  await expect(page.locator(`#post-${posts[2].id}`)).toHaveCount(0);
  expect(feedRequests).toContain("following");
  await page.waitForTimeout(900);
  await hideTab(page);
  await expect.poll(() => events(batches).some((event) => event.type === "impression" && event.surface === "following")).toBe(true);
  await page.getByRole("tab", { name: "Latest" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(`#post-${posts[2].id}`)).toBeVisible();
});

test("signed-out visitors see no feed tabs and send no events", async ({ page }) => {
  const { batches } = await setup(page, { signedIn: false });
  await page.goto("/");
  await expect(page.locator(`#post-${posts[0].id}`)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Following" })).toHaveCount(0);
  await page.waitForTimeout(900);
  await hideTab(page);
  await page.waitForTimeout(300);
  expect(batches).toHaveLength(0);
});
