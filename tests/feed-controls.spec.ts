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
const ann = { id: "22222222-2222-4222-8222-222222222222", handle: "ann", displayName: "Ann", avatarUrl: null };
const ben = { id: "33333333-3333-4333-8333-333333333333", handle: "ben", displayName: "Ben", avatarUrl: null };
const post = (index: number, author: typeof ann, topics: string[] = []) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  content: `Ranked post ${index}${topics.map((topic) => ` #${topic}`).join("")}`,
  topics,
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
});
const posts = [post(0, ann, ["cats"]), post(1, ben), post(2, ann), post(3, ben)];
const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Call = { method: string; url: string; body: unknown };

async function setup(page: Page, { personalize = true, why = "ok" as "ok" | "missing" } = {}) {
  const calls: Call[] = [];
  const state = {
    sliders: { discovery: 0, freshness: 0, replies: 0 },
    topics: [] as { id: string; topic: string; direction: number }[],
    snoozed: [{ id: "snooze-1", user: ben, expiresAt: new Date(Date.now() + 10 * 86_400_000).toISOString() }],
  };
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    } as unknown as typeof EventSource;
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: false,
        user: {
          ...viewer,
          feedPersonalize: personalize,
          feedDiscovery: state.sliders.discovery,
          feedFreshness: state.sliders.freshness,
          feedReplies: state.sliders.replies,
        },
        avatarUrl: null,
        suggestedHandle: viewer.handle,
        feedChoiceNeeded: false,
      },
    }),
  );
  await page.route("**/api/posts/states?*", (route) => route.fulfill({ json: { viewerId: viewer.id, posts: [] } }));
  await page.route("**/api/feed/events", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/feed/for-you", (route) =>
    route.fulfill({
      json: {
        posts,
        repostedBy: {},
        nextCursor: null,
        serverNow: new Date().toISOString(),
        requestId,
        placements: Object.fromEntries(posts.map((entry, position) => [entry.id, { requestId, position, reason: position ? "recent" : "topic" }])),
        caughtUp: false,
        fallback: false,
      },
    }),
  );
  await page.route("**/api/feed/following", (route) =>
    route.fulfill({ json: { posts: posts.slice(0, 1), repostedBy: {}, nextCursor: null, serverNow: new Date().toISOString() } }),
  );
  await page.route("**/api/feed/preferences", (route) => {
    const body = route.request().postDataJSON();
    calls.push({ method: "PATCH", url: "/api/feed/preferences", body });
    Object.assign(state.sliders, body);
    return route.fulfill({ json: { personalize, chosen: true, ...state.sliders } });
  });
  await page.route(/\/api\/feed\/feedback(\?.*)?$/, (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({
        json: {
          snoozed: state.snoozed,
          authors: [],
          topics: state.topics,
          posts: { interested: 0, notInterested: 2 },
          suggestedTopics: ["dogs"],
        },
      });
    if (request.method() === "DELETE") {
      calls.push({ method: "DELETE", url: request.url(), body: null });
      return route.fulfill({ json: { removed: 2 } });
    }
    const body = request.postDataJSON();
    calls.push({ method: "POST", url: "/api/feed/feedback", body });
    if (body.kind === "topic") state.topics.push({ id: `topic-${state.topics.length}`, topic: body.topic, direction: body.direction });
    return route.fulfill({ status: 201, json: { id: `feedback-${calls.length}`, direction: body.direction ?? -1, expiresAt: null } });
  });
  await page.route(/\/api\/feed\/feedback\/[^/?]+$/, (route) => {
    calls.push({ method: route.request().method(), url: route.request().url(), body: null });
    const id = route.request().url().split("/").pop();
    state.topics = state.topics.filter((entry) => entry.id !== id);
    state.snoozed = state.snoozed.filter((entry) => entry.id !== id);
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/feed/why/**", (route) =>
    why === "ok"
      ? route.fulfill({
          json: {
            postId: posts[0].id,
            requestId,
            reason: "topic",
            explore: false,
            surface: "for_you",
            position: 0,
            factors: [{ kind: "affinity", strength: "high" }, { kind: "popular", strength: "low" }],
            controls: { author: null, topics: [{ topic: "cats", direction: "more" }], sliders: { discovery: 1, freshness: 0, replies: 0 } },
          },
        })
      : route.fulfill({ status: 404, json: { error: "feed_explanation_unavailable" } }),
  );
  return { calls, state };
}

const card = (page: Page, index: number) => page.locator(`#post-${posts[index].id}`);
async function openMenu(page: Page, index: number) {
  await card(page, index).getByRole("button", { name: "Post options" }).click();
}

test("Not interested removes the post, and Undo restores it and deletes the rating", async ({ page }) => {
  const { calls } = await setup(page);
  await page.goto("/");
  await expect(card(page, 0)).toBeVisible();
  await openMenu(page, 0);
  await page.getByRole("menuitem", { name: "Not interested" }).click();
  await expect(card(page, 0)).toHaveCount(0);
  await expect.poll(() => calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
    { kind: "post", postId: posts[0].id, direction: -1 },
  ]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, 0)).toBeVisible();
  await expect.poll(() => calls.some((call) => call.method === "DELETE" && call.url.endsWith("/api/feed/feedback/feedback-1"))).toBe(true);
});

test("snoozing removes every post by the author and topic entries come from the post", async ({ page }) => {
  const { calls } = await setup(page);
  await page.goto("/");
  await expect(card(page, 1)).toBeVisible();
  await openMenu(page, 0);
  await expect(page.getByRole("menuitem", { name: "Fewer about #cats" })).toBeVisible();
  await page.keyboard.press("Escape");
  await openMenu(page, 1);
  await expect(page.getByRole("menuitem", { name: /Fewer about/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Snooze @ben for 30 days" }).click();
  await expect(card(page, 1)).toHaveCount(0);
  await expect(card(page, 3)).toHaveCount(0);
  await expect(card(page, 0)).toBeVisible();
  await expect.poll(() => calls.find((call) => call.method === "POST")?.body).toEqual({ kind: "snooze", authorId: ben.id });
});

test("the why dialog shows ranking factors and the controls that applied", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await openMenu(page, 0);
  await page.getByRole("menuitem", { name: "Why am I seeing this?" }).click();
  const dialog = page.getByRole("dialog", { name: "Why am I seeing this?" });
  await expect(dialog).toContainText("It is about a topic you asked to see more of.");
  await expect(dialog.getByRole("list", { name: "What ranked this post" })).toContainText("You often interact with @ann");
  await expect(dialog).toContainText("More about #cats");
  await expect(dialog).toContainText("Discovery: more");
  await expect(dialog.getByRole("link", { name: "Feed settings" })).toHaveAttribute("href", "/settings/feed");
});

test("the why dialog falls back to the placement reason when no explanation exists", async ({ page }) => {
  await setup(page, { why: "missing" });
  await page.goto("/");
  await openMenu(page, 0);
  await page.getByRole("menuitem", { name: "Why am I seeing this?" }).click();
  const dialog = page.getByRole("dialog", { name: "Why am I seeing this?" });
  await expect(dialog).toContainText("It is about a topic you asked to see more of.");
  await expect(dialog.getByRole("list", { name: "What ranked this post" })).toHaveCount(0);
});

test("Feed settings save sliders, topics and snoozes", async ({ page }) => {
  const { calls } = await setup(page);
  await page.goto("/settings/feed");
  const section = page.getByRole("region", { name: "Feed" });
  await expect(section.getByText("How your Feed is ranked")).toBeVisible();
  await section.getByRole("slider", { name: "Discovery" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => calls.filter((call) => call.method === "PATCH").map((call) => call.body)).toEqual([{ discovery: 1 }]);
  await expect(section.getByText("More new people")).toBeVisible();

  await section.getByRole("textbox", { name: "Topic" }).fill("#Birds");
  await section.getByRole("button", { name: "Fewer" }).click();
  await expect(section.getByRole("list", { name: "Fewer about" })).toContainText("#birds");
  await section.getByRole("button", { name: "Remove #birds" }).click();
  await expect(section.getByRole("list", { name: "Fewer about" })).toHaveCount(0);
  await section.getByRole("button", { name: "More #dogs" }).click();
  await expect(section.getByRole("list", { name: "More about" })).toContainText("#dogs");

  await expect(section).toContainText("@ben");
  await section.getByRole("button", { name: "Unsnooze" }).click();
  await expect(section).toContainText("No snoozed accounts.");
  await section.getByRole("button", { name: "Clear" }).first().click();

  expect(calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
    { kind: "topic", topic: "birds", direction: -1 },
    { kind: "topic", topic: "dogs", direction: 1 },
  ]);
  await expect.poll(() => calls.filter((call) => call.method === "DELETE").map((call) => new URL(call.url).pathname + new URL(call.url).search)).toEqual([
    "/api/feed/feedback/topic-0",
    "/api/feed/feedback/snooze-1",
    "/api/feed/feedback?kind=post",
  ]);
});

test("opted-out users can open Feed settings and see that controls apply later", async ({ page }) => {
  await setup(page, { personalize: false });
  await page.goto("/settings/feed");
  const section = page.getByRole("region", { name: "Feed" });
  await expect(section.getByText("These apply when your Feed is on.")).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/feed$/);
});

test("Undo after changing a rating puts the earlier rating back", async ({ page }) => {
  const { calls } = await setup(page);
  await page.route(/\/api\/feed\/feedback$/, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const body = route.request().postDataJSON();
    calls.push({ method: "POST", url: "/api/feed/feedback", body });
    return route.fulfill({ status: 201, json: { id: "rating-1", direction: body.direction, previousDirection: body.direction === -1 ? 1 : null, expiresAt: null } });
  });
  await page.goto("/");
  await openMenu(page, 0);
  await page.getByRole("menuitem", { name: "Not interested" }).click();
  await expect(card(page, 0)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, 0)).toBeVisible();
  await expect.poll(() => calls.filter((call) => call.method === "POST").map((call) => call.body)).toEqual([
    { kind: "post", postId: posts[0].id, direction: -1 },
    { kind: "post", postId: posts[0].id, direction: 1 },
  ]);
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);
});

test("clearing feed activity reloads the ranked feed instead of reusing the cached one", async ({ page }) => {
  await setup(page);
  let rankings = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/feed/for-you") rankings++;
  });
  await page.route("**/api/feed/reset", (route) => route.fulfill({ json: { cleared: 3 } }));
  await page.goto("/");
  await expect(card(page, 0)).toBeVisible();
  await openMenu(page, 0);
  await page.getByRole("menuitem", { name: "Why am I seeing this?" }).click();
  await page.getByRole("dialog", { name: "Why am I seeing this?" }).getByRole("link", { name: "Feed settings" }).click();
  await expect(page.getByText("Clear feed activity", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  const before = rankings;
  await page.getByRole("button", { name: "Clear", exact: true }).last().click();
  await page.getByRole("button", { name: "Clear activity" }).click();
  await expect(page.getByText("Your feed activity was cleared.")).toBeVisible();
  await expect.poll(() => rankings).toBeGreaterThan(before);
});
