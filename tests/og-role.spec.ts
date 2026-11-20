import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const [ogMember, newMember, adminMember, developer] = [
    { id: "11111111-1111-4111-8111-111111111111", handle: "og_member", displayName: "OG Member", avatarUrl: null, isOg: true },
    {
      id: "22222222-2222-4222-8222-222222222222",
      handle: "new_member",
      displayName: "New Member",
      avatarUrl: null,
      github: { login: "new-member", contributionCount: 0 },
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      handle: "admin_member",
      displayName: "Admin Member",
      avatarUrl: null,
      isAdmin: true,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      handle: "dev_user",
      displayName: "Dev User",
      avatarUrl: null,
      isOg: false,
      github: { login: "contributor-login", contributionCount: 23 },
      badges: [{ id: "55555555-5555-4555-8555-555555555555", icon: "terminal", tooltip: "Developed this" }],
    },
  ] as const;
  const members = [ogMember, newMember, adminMember, developer];
  const serverNow = new Date().toISOString();

  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/me", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/profiles/*", (route) => {
    const member = members.find(({ handle }) => route.request().url().endsWith("/" + handle));
    if (!member) return route.fallback();
    return route.fulfill({
      json: {
        profile: {
          ...member,
          bio: "",
          bannerUrl: null,
          bannerCrop: null,
          createdAt: serverNow,
          followerCount: 0,
          followingCount: 0,
        },
        isFollowing: false,
        isFollowedBy: false,
        posts: [],
        reposts: [],
        replies: [],
        serverNow,
      },
    });
  });
});

test("profiles show OG and explicitly assigned badges with tooltips", async ({ page }) => {
  await page.goto("/@og_member");
  await expect(page.getByRole("heading", { name: "OG Member" })).toBeVisible();
  const badge = page.getByRole("button", { name: "OG member" });
  const tooltip = page.getByRole("tooltip");
  await badge.hover();
  await expect(tooltip).toHaveText("Joined before the big migration");
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  await badge.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(badge).toBeFocused();
  await expect(tooltip).toHaveText("Joined before the big migration");

  await page.goto("/@new_member");
  await expect(page.getByRole("heading", { name: "New Member" })).toBeVisible();
  await expect(page.getByRole("link", { name: "@new-member on GitHub" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Contributor/ })).toHaveCount(0);
  await expect(badge).toHaveCount(0);
  const adminBadge = page.getByRole("button", { name: "Admin", exact: true });
  const developerBadge = page.getByRole("button", { name: "Developed this" });
  await expect(adminBadge).toHaveCount(0);

  await page.goto("/@admin_member");
  await expect(page.getByRole("heading", { name: "Admin Member" })).toBeVisible();
  await expect(adminBadge).toHaveCount(0);
  await expect(developerBadge).toHaveCount(0);

  await page.goto("/@dev_user");
  await expect(page.getByRole("heading", { name: "Dev User" })).toBeVisible();
  await expect(badge).toHaveCount(0);
  await expect(developerBadge.locator("span")).toHaveCSS("mask-image", /\/api\/profiles\/badge-icons\/terminal/);
  await developerBadge.hover();
  await expect(tooltip).toHaveText("Developed this");
  const githubLink = page.getByRole("link", { name: "@contributor-login on GitHub" });
  await expect(githubLink).toHaveAttribute("href", "https://github.com/contributor-login");
  await expect(githubLink).toHaveText("");
  await githubLink.hover();
  await expect(page.getByText("@contributor-login on GitHub", { exact: true })).toBeVisible();
  const contributorBadge = page.getByRole("button", { name: "Contributor · 23" });
  await expect(contributorBadge).toHaveText("23");
  await expect(developerBadge.or(contributorBadge).last()).toHaveAccessibleName("Contributor · 23");
  await contributorBadge.hover();
  await expect(page.getByRole("tooltip", { name: "Contributor · 23 public ysocialoss contributions" })).toBeVisible();

  const githubUrl = "https://github.com/contributor-login";
  await page.context().route(githubUrl, (route) => route.fulfill({ body: "GitHub profile" }));
  await githubLink.click();
  const confirmation = page.getByRole("alertdialog", { name: "Open external link?" });
  await expect(confirmation.getByText(githubUrl, { exact: true })).toBeVisible();
  const newTab = page.context().waitForEvent("page");
  await confirmation.getByRole("button", { name: "Open link" }).click();
  const githubPage = await newTab;
  await expect(githubPage).toHaveURL(githubUrl);
  await githubPage.close();
});

test.describe("profile badges on touch screens", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 } });

  test("badge descriptions toggle on tap and dismiss on outside tap", async ({ page }) => {
    await page.goto("/@og_member");

    const badge = page.getByRole("button", { name: "OG member" });
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeHidden();
    await badge.tap();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Joined before the big migration");
    await badge.tap();
    await expect(tooltip).toBeHidden();

    await page.goto("/@dev_user");
    await page.getByRole("button", { name: "Developed this" }).tap();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Developed this");
    await page.getByRole("heading", { name: "Dev User" }).tap();
    await expect(tooltip).toBeHidden();
  });
});
