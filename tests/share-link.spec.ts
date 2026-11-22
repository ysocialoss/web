import { expect, test } from "@playwright/test";

const author = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "share_tester",
  displayName: "Share tester",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
};
const now = new Date().toISOString();
const post = {
  id: "22222222-2222-4222-8222-222222222222",
  content: "A post to share",
  author,
  parentId: null,
  createdAt: now,
  editedAt: null,
  editExpiresAt: now,
  likes: 0,
  liked: false,
  replies: 0,
  reposts: 0,
  reposted: false,
};
const profilePath = `/@${author.handle}`;

for (const mobile of [false, true]) {
  test(`profiles and posts share links on ${mobile ? "mobile" : "desktop"}`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 740 } : { width: 1280, height: 800 },
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
    await page.route("**/auth/me", (route) =>
      route.fulfill({
        json: mobile
          ? {
              authenticated: true,
              needsOnboarding: false,
              user: author,
              avatarUrl: null,
              suggestedHandle: author.handle,
            }
          : { authenticated: false },
      }),
    );
    await page.route("**/api/posts", (route) =>
      route.fulfill({
        json: { posts: [post], nextCursor: null, serverNow: now },
      }),
    );
    await page.route(`**/api/profiles/${author.handle}`, (route) =>
      route.fulfill({
        json: {
          profile: {
            ...author,
            bio: "",
            createdAt: now,
            followerCount: 0,
            followingCount: 0,
          },
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

    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    const share = page.getByRole("button", { name: "Share", exact: true });
    for (const { pagePath, linkPath, kind } of [
      { pagePath: "/", linkPath: `/posts/${post.id}`, kind: "post" },
      { pagePath: `${profilePath}?ref=test`, linkPath: profilePath, kind: "profile" },
    ]) {
      await page.goto(pagePath);
      const link = new URL(linkPath, page.url()).href;
      const dialog = page.getByRole("dialog", { name: `Share ${kind}` });

      const openShare = async () => {
        if (kind === "post") return share.click();
        await page.getByRole("button", { name: "Profile options" }).click();
        await page.getByRole("menuitem", { name: "Share profile" }).click();
      };
      await openShare();
      await expect(dialog).toBeVisible();
      if (mobile) {
        await expect(dialog.getByRole("link", { name: "Open Messages" })).toBeVisible();
      } else {
        await expect(dialog.getByText(`Sign in to send ${kind}s in Messages.`)).toBeVisible();
      }
      await dialog.getByRole("button", { name: "Copy link" }).click();
      await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
      await expect.poll(clipboard).toBe(link);

      await page.reload();
      await page.evaluate(() => navigator.clipboard.writeText(""));
      if (kind === "post") {
        await share.click({ delay: 650 });
        await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
      } else {
        await page.getByRole("button", { name: "Profile options" }).click();
        await page.getByRole("menuitem", { name: "Copy profile link" }).click();
        await expect(page.getByText("Link copied")).toBeVisible();
      }
      await expect(dialog).toBeHidden();
      await expect.poll(clipboard).toBe(link);
    }
  });
}
