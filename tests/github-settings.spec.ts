import { expect, test } from "@playwright/test";

for (const entry of ["settings", "profile"] as const) {
  test(`GitHub controls in ${entry} launch authorization and let users disconnect`, async ({
    page,
  }) => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      handle: "github_user",
      displayName: "GitHub User",
      avatarUrl: null,
      bannerUrl: null,
      bannerCrop: null,
    };
    const authorizeUrl =
      "https://github.com/login/oauth/authorize?client_id=test&state=state";
    const profilePath = `/@${user.handle}`;
    const returnPath = entry === "profile" ? profilePath : "/asettings";
    let github: { login: string; contributionCount: number | null } | null = null;
    await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/connections", (route) =>
      route.fulfill({ json: { providers: [] } }),
    );
    await page.route("**/api/domains", (route) =>
      route.fulfill({ json: { domains: [], max: 10 } }),
    );
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
    await page.route(`**/api/profiles/${user.handle}`, (route) =>
      route.fulfill({
        json: {
          profile: {
            ...user,
            github,
            bio: "",
            createdAt: new Date().toISOString(),
            followerCount: 0,
            followingCount: 0,
          },
          isFollowing: false,
          isFollowedBy: false,
          posts: [],
          replies: [],
          reposts: [],
          repostedBy: {},
          serverNow: new Date().toISOString(),
        },
      }),
    );
    await page.route("**/api/github", (route) => {
      if (route.request().method() === "DELETE") {
        github = null;
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ json: { configured: true, github } });
    });
    await page.route("**/api/github/connect", (route) => {
      expect(route.request().method()).toBe("POST");
      if (entry === "profile")
        expect(route.request().postDataJSON()).toEqual({ returnTo: "profile" });
      else expect(route.request().postData()).toBeNull();
      return route.fulfill({ json: { url: authorizeUrl } });
    });
    await page.route(authorizeUrl, (route) =>
      route.fulfill({ body: "GitHub authorization" }),
    );

    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    async function openConnections() {
      await page.getByRole("button", { name: "Edit profile", exact: true }).click();
      await dialog.getByRole("tab", { name: "Connections" }).click();
    }
    await page.goto(returnPath);
    if (entry === "profile") await openConnections();
    await page.getByRole("button", { name: "Connect GitHub" }).click();
    await expect(page).toHaveURL(authorizeUrl);

    await page.clock.install();
    github = { login: "github-login", contributionCount: null };
    await page.goto(returnPath + "?github=connected");
    if (entry === "profile") {
      await expect(
        dialog.getByRole("tab", { name: "Connections" }),
      ).toHaveAttribute("aria-selected", "true");
    }
    const settings = page.getByRole("region", { name: "GitHub" });
    await expect(
      settings.getByText("GitHub account connected.", { exact: true }),
    ).toBeVisible();
    await expect(
      settings.getByRole("link", { name: "@github-login" }),
    ).toHaveAttribute("href", "https://github.com/github-login");
    await settings.getByRole("link", { name: "@github-login" }).click();
    const externalLinkDialog = page.getByRole("alertdialog", {
      name: "Open external link?",
    });
    await expect(
      externalLinkDialog.getByText("https://github.com/github-login"),
    ).toBeVisible();
    await externalLinkDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(externalLinkDialog).toBeHidden();
    await expect(settings.getByText("Connected", { exact: true })).toHaveCount(
      0,
    );
    await expect(settings.getByText("ysocialoss contributions")).toBeVisible();
    await expect(settings.getByText("Pending", { exact: true })).toBeVisible();
    github = { ...github, contributionCount: 5 };
    await page.clock.runFor(15_000);
    await expect(settings.getByText("5", { exact: true })).toBeVisible();
    const disconnect = settings.getByRole("button", {
      name: "Disconnect",
      exact: true,
    });
    if (entry === "profile") {
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Contributor · 5" }),
      ).toBeVisible();
      await openConnections();
    }
    await disconnect.click();
    const confirmation = page.getByRole("alertdialog", {
      name: "Disconnect GitHub?",
    });
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(
      settings.getByRole("link", { name: "@github-login" }),
    ).toBeVisible();
    await disconnect.click();
    await confirmation
      .getByRole("button", { name: "Disconnect", exact: true })
      .click();
    await expect(
      settings.getByRole("button", { name: "Connect GitHub" }),
    ).toBeVisible();
    await expect(settings.getByRole("link")).toHaveCount(0);
    if (entry === "profile") {
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("link", { name: "@github-login on GitHub" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^Contributor/ }),
      ).toHaveCount(0);
    }
  });
}
