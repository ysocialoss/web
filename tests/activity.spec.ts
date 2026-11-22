import { expect, test } from "@playwright/test";

const actor = { id: "88888888-8888-4888-8888-888888888888", handle: "garden_gail", displayName: "Gardener Gail", avatarUrl: null };
const viewer = { ...actor, id: "11111111-1111-4111-8111-111111111111", handle: "viewer", displayName: "Viewer", bannerUrl: null, bannerCrop: null };
const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const rows = [
  { id: "reply", kind: "reply", actor, postId: null, preview: "Nice!", imageIds: [], createdAt: at(1), readAt: null },
  { id: "follow", kind: "follow", actor, postId: null, preview: null, imageIds: [], createdAt: at(2), readAt: null },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `old-${index}`, kind: "follow", actor, postId: null, preview: null, imageIds: [],
    createdAt: at(60 * 24 * (index + 2)), readAt: at(1),
  })),
];

test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 700 } });

test("the Activity page reads what you see, keeps rows in place and scrolls", async ({ page }) => {
  const read: string[] = [];
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: { authenticated: true, needsOnboarding: false, user: viewer, avatarUrl: null, suggestedHandle: "viewer" },
    }),
  );
  await page.route("**/api/notifications?*", (route) =>
    route.fulfill({ json: { notifications: rows, unreadCount: 2, nextCursor: null } }),
  );
  await page.route("**/api/notifications/*/read", (route) => {
    read.push(route.request().url().split("/").slice(-2)[0]);
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/activity");
  await expect(page.getByRole("heading", { name: "Priority" })).toBeVisible();
  await expect.poll(() => read.sort()).toEqual(["follow", "reply"]);
  await expect(page.getByRole("region", { name: "Priority" }).getByRole("listitem")).toHaveCount(2);

  const scroller = page.locator(".content-scroll");
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
});
