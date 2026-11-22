import { expect, test } from "@playwright/test";

const actor = {
  id: "88888888-8888-4888-8888-888888888888",
  handle: "garden_gail",
  displayName: "Gardener Gail",
  avatarUrl: null,
};
const viewer = {
  ...actor,
  id: "11111111-1111-4111-8111-111111111111",
  handle: "viewer",
  displayName: "Viewer",
  bannerUrl: null,
  bannerCrop: null,
};
const createdAt = "2026-01-01T00:00:00.000Z";
const postId = "00000000-0000-4000-8000-000000000001";
const like = {
  id: "like-notification",
  kind: "like",
  actor,
  postId,
  preview: "Planting tomatoes in the garden today.",
  createdAt,
  readAt: null,
};
const follow = {
  ...like,
  id: "follow-notification",
  kind: "follow",
  actor: { ...actor, displayName: "" },
  postId: null,
  preview: null,
  readAt: createdAt,
};

test.beforeEach(async ({ page }) => {
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
});

test("notification profile links preserve post navigation and read state", async ({
  page,
}) => {
  const readIds: string[] = [];
  await page.route("**/api/notifications?*", (route) =>
    route.fulfill({
      json: {
        notifications: [
          { ...like, readAt: readIds.includes(like.id) ? createdAt : null },
          follow,
        ],
        unreadCount: readIds.includes(like.id) ? 0 : 1,
        nextCursor: null,
      },
    }),
  );
  await page.route(`**/api/notifications/${like.id}/read`, (route) => {
    readIds.push(like.id);
    return route.fulfill({ status: 204 });
  });
  await page.route(`**/api/profiles/${actor.handle}`, (route) =>
    route.fulfill({
      json: {
        profile: {
          ...actor,
          bannerUrl: null,
          bannerCrop: null,
          bio: "Grows vegetables.",
          createdAt,
          followerCount: 0,
          followingCount: 0,
        },
        isFollowing: false,
        isFollowedBy: false,
        posts: [],
        replies: [],
        reposts: [],
        repostedBy: {},
        serverNow: createdAt,
      },
    }),
  );

  await page.goto("/notifications");
  const likeRow = page
    .getByRole("listitem")
    .filter({ hasText: "liked your post" });
  await likeRow
    .getByRole("link", { name: actor.displayName, exact: true })
    .press("Enter");
  await expect(page).toHaveURL(`/@${actor.handle}`);
  await expect(page.getByText("Grows vegetables.")).toBeVisible();
  await expect.poll(() => readIds).toEqual([like.id]);

  await page.goto("/notifications");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const popover = page.getByRole("dialog", { name: "Notifications" });
  await popover
    .getByRole("listitem")
    .filter({ hasText: "liked your post" })
    .getByRole("link", { name: `View @${actor.handle}'s profile` })
    .click();
  await expect(popover).toBeHidden();
  await expect(page).toHaveURL(`/@${actor.handle}`);

  await page.goto("/notifications");
  const followRow = page
    .getByRole("listitem")
    .filter({ hasText: "followed you" });
  await expect(
    followRow.getByRole("link", { name: actor.handle, exact: true }),
  ).toHaveAttribute("href", `/@${actor.handle}`);
  const preview = await likeRow.getByText(like.preview).boundingBox();
  if (!preview)
    throw new Error("Expected the notification preview to be visible");
  await page.mouse.click(preview.x + 10, preview.y + preview.height / 2);
  await expect(page).toHaveURL(`/posts/${postId}`);
  expect(readIds).toEqual([like.id]);
});

test("the bell panel marks notifications read as they come into view", async ({
  page,
}) => {
  const notifications = Array.from({ length: 30 }, (_, index) => ({
    ...like,
    id: `like-${index}`,
    preview: `Activity ${index + 1}`,
  }));
  const readIds: string[] = [];
  await page.route("**/api/notifications?*", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    const items = cursor ? notifications.slice(20) : notifications.slice(0, 20);
    return route.fulfill({
      json: {
        notifications: items.map((item) => ({
          ...item,
          readAt: readIds.includes(item.id) ? createdAt : null,
        })),
        unreadCount: notifications.length - new Set(readIds).size,
        nextCursor: cursor ? null : "next-page",
      },
    });
  });
  await page.route("**/api/notifications/*/read", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2);
    if (id) readIds.push(id);
    return route.fulfill({ status: 204 });
  });

  await page.goto("/notifications");
  const bell = page
    .getByRole("button", { name: /^Notifications, \d+ unread$/ })
    .filter({ visible: true })
    .first();
  await expect(bell).toHaveAccessibleName("Notifications, 30 unread");
  expect(readIds).toEqual([]);
  await bell.click();

  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect
    .poll(() => readIds)
    .toEqual(expect.arrayContaining(["like-0", "like-1"]));
  expect(readIds).not.toContain("like-10");
  expect(readIds).not.toContain("like-19");

  await panel
    .getByText("Activity 20", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect.poll(() => readIds).toContain("like-19");
  expect(readIds).not.toContain("like-10");
  await expect(panel.getByRole("button", { name: "Load more" })).toHaveCount(0);
  await panel
    .getByText("Activity 30", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect.poll(() => readIds).toContain("like-29");
  await expect(panel.getByText("Activity 1", { exact: true })).toBeAttached();
  expect(readIds).toHaveLength(new Set(readIds).size);
  await expect
    .poll(async () => {
      const label = await bell.getAttribute("aria-label");
      return label === `Notifications, ${notifications.length - readIds.length} unread`;
    })
    .toBe(true);
});
