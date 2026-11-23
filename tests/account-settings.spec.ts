import { expect, test } from "@playwright/test";

const viewer = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "viewer",
  displayName: "Viewer Vic",
  avatarUrl: null,
  pronouns: "they/them",
  bannerUrl: null,
  bannerCrop: null,
};
const now = "2026-01-01T00:00:00.000Z";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/domains", (route) =>
    route.fulfill({ json: { domains: [], max: 10 } }),
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: false,
        pendingApproval: false,
        ban: null,
        user: viewer,
        avatarUrl: null,
        suggestedHandle: viewer.handle,
      },
    }),
  );
  await page.route("**/api/profiles/viewer", (route) =>
    route.fulfill({
      json: {
        profile: { ...viewer, bio: "Growing things.", createdAt: now, followerCount: 1, followingCount: 2, postCount: 3 },
        isFollowing: false,
        isFollowedBy: false,
        posts: [],
        replies: [],
        reposts: [],
        repostedBy: {},
        serverNow: now,
      },
    }),
  );
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: {
        providers: ["discord", "twitch"].map((provider) => ({
          provider,
          configured: true,
          connection: null,
        })),
      },
    }),
  );
  await page.route("**/api/github", (route) =>
    route.fulfill({ json: { configured: true, github: null } }),
  );
  await page.route("**/api/notifications/push*", (route) =>
    route.fulfill({
      json: { publicKey: null, subscribed: false, promptDismissed: true, hideContent: false, mutedUntil: null, mutedForever: false },
    }),
  );
});

test("account settings reuse the profile popups and keep the account menu entry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("link", { name: "Account settings" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  await expect(page.getByText("Growing things.")).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit profile" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: "Connect GitHub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Discord" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Connect Twitch" })).toBeEnabled();
});

test("the logo can be pinned to a variation and links to its occasion", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings/account");
  await expect(page.getByRole("radio", { name: /Automatic/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /Earth Day/ }).click();
  const logo = page.getByRole("link", { name: /Earth Day, opens in a new tab/ });
  await expect(logo).toHaveAttribute("href", "https://www.earthday.org/");
  await logo.hover();
  await expect(page.locator("[data-slot=tooltip-content]", { hasText: "Earth Day" })).toBeVisible();
  await page.getByRole("radio", { name: /Main logo/ }).click();
  await expect(page.getByRole("link", { name: "ysocial home" })).toHaveAttribute("href", "/");
});

test("deleting the account needs the handle typed and calls the API", async ({ page }) => {
  let deleted: unknown;
  await page.route("**/api/profiles/me", (route) => {
    deleted = route.request().postDataJSON();
    return route.fulfill({ status: 204, body: "" });
  });
  await page.route("**/auth/logout", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Delete account" }).last();
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Type/).fill("@someone_else");
  await expect(confirm).toBeDisabled();
  await page.getByLabel(/Type/).fill("@viewer");
  await confirm.click();
  await expect.poll(() => deleted).toEqual({ handle: "viewer" });
  await expect(page).toHaveURL(/\/$/);
});

test("connecting a provider sends you to its authorize page", async ({ page }) => {
  let body: unknown;
  await page.route("**/api/connections/discord/connect", (route) => {
    body = route.request().postDataJSON();
    return route.fulfill({ json: { url: "https://discord.com/oauth2/authorize?client_id=x" } });
  });
  await page.route("https://discord.com/**", (route) => route.fulfill({ body: "ok" }));
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Connect Discord" }).click();
  await expect.poll(() => body).toEqual({ returnTo: "settings" });
  await expect(page).toHaveURL(/discord\.com\/oauth2\/authorize/);
});

test("santa hats show in the week before Christmas, on profiles but not in posts", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-20T12:00:00"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Account menu" }).locator("img[src='/santa-hat.svg']")).toBeAttached();
  await expect(page.locator("article img[src='/santa-hat.svg']")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00"));
  await page.reload();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
  await expect(page.locator("img[src='/santa-hat.svg']")).toHaveCount(0);
});

test("a streaming Twitch user gets a live icon that links to the stream", async ({ page }) => {
  const author = { id: "88888888-8888-4888-8888-888888888888", handle: "streamer", displayName: "Streamer", avatarUrl: null };
  await page.route("**/api/posts", (route) =>
    route.fulfill({
      json: {
        posts: [{
          id: "00000000-0000-4000-8000-000000000001", parentId: null, content: "hello", createdAt: now, editedAt: null,
          editExpiresAt: now, author, likes: 0, liked: false, replies: 0, reposts: 0, reposted: false,
        }],
        repostedBy: {}, nextCursor: null, serverNow: now,
      },
    }),
  );
  await page.route("**/api/connections/twitch/live?*", (route) =>
    route.fulfill({ json: { live: { streamer: { login: "streamer_tv" } } } }),
  );
  await page.goto("/");
  const live = page.getByRole("link", { name: /streamer_tv is live on Twitch/ });
  await expect(live).toHaveAttribute("href", "https://www.twitch.tv/streamer_tv");
});
