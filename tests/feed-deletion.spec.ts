import { expect, test } from "@playwright/test";

test("live refresh removes a deleted post without inserting an older post at the top", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      private readonly controller = new AbortController();

      constructor() {
        super();
        window.addEventListener(
          "test-live-event",
          (event) => {
            const { type, data } = (event as CustomEvent).detail;
            this.dispatchEvent(
              new MessageEvent(type, { data: JSON.stringify(data) }),
            );
          },
          { signal: this.controller.signal },
        );
      }
      close() {
        this.controller.abort();
      }
    } as unknown as typeof EventSource;
  });

  const author = {
    id: "88888888-8888-4888-8888-888888888888",
    handle: "feed_tester",
    displayName: "Feed tester",
    avatarUrl: null,
  };
  const posts = Array.from({ length: 22 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    content: `Fixture post ${index}.`,
    author,
    parentId: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 22 - index)).toISOString(),
    editedAt: null,
    editExpiresAt: new Date(Date.UTC(2026, 0, 1, 2)).toISOString(),
    likes: 0,
    liked: false,
    replies: 0,
    reposts: 0,
    reposted: false,
  }));
  const [deleted, firstRemaining, ...rest] = posts;
  const older = posts[20];
  const published = {
    ...posts[21],
    content: "Newly published post.",
    createdAt: new Date(Date.UTC(2026, 0, 1, 1)).toISOString(),
  };
  let current = posts.slice(0, 20);
  let feedRequests = 0;

  const viewer = {
    id: "11111111-1111-4111-8111-111111111111",
    handle: "viewer",
    displayName: "Viewer",
    avatarUrl: null,
    bannerUrl: null,
    bannerCrop: null,
    navigation: null,
    feedPersonalize: false,
  };
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: false,
        user: viewer,
        avatarUrl: null,
        suggestedHandle: viewer.handle,
      },
    }),
  );
  await page.route("**/api/feed/following", (route) => {
    feedRequests++;
    return route.fulfill({
      json: {
        posts: current,
        nextCursor: "next",
        serverNow: new Date().toISOString(),
      },
    });
  });
  await page.route("**/api/feed/following?cursor=next", (route) =>
    route.fulfill({
      json: {
        posts: [older],
        nextCursor: null,
        serverNow: new Date().toISOString(),
      },
    }),
  );
  await page.route("**/api/posts/states?*", (route) => {
    const ids =
      new URL(route.request().url()).searchParams.get("ids")?.split(",") ?? [];
    return route.fulfill({
      json: {
        viewerId: viewer.id,
        posts: current.filter((post) => ids.includes(post.id)),
      },
    });
  });

  await page.goto("/following");
  await expect(
    page.getByRole("textbox", { name: "What's on your mind?" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  const feed = page.locator("article[id^='post-']");
  await expect(feed.first()).toContainText(deleted.content);
  current = [firstRemaining, ...rest].slice(0, 20);
  await page.evaluate((id) => {
    window.dispatchEvent(
      new CustomEvent("test-live-event", {
        detail: { type: "change", data: { ids: [id] } },
      }),
    );
  }, deleted.id);
  await expect(page.getByText(deleted.content, { exact: true })).toHaveCount(0);
  const beforeResync = feedRequests;
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("test-live-event", { detail: { type: "resync" } }),
    );
  });
  await expect.poll(() => feedRequests).toBeGreaterThan(beforeResync);

  // Let the same live refresh run with a genuinely new post as well as an older
  // entry filling out the server page after the deletion.
  current = [published, ...current].slice(0, 20);
  await page.evaluate(
    (post) => {
      window.dispatchEvent(
        new CustomEvent("test-live-event", {
          detail: { type: "post", data: post },
        }),
      );
    },
    { id: published.id, parentId: null, authorId: author.id, topics: [] },
  );
  await expect(feed.first()).toContainText(published.content);
  await expect(feed.nth(1)).toContainText(firstRemaining.content);
  await expect(page.getByText(older.content, { exact: true })).toHaveCount(0);
  await feed.last().scrollIntoViewIfNeeded();
  await expect(feed.last()).toContainText(older.content);
});
