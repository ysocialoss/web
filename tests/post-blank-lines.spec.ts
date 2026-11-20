import { expect, test } from "@playwright/test";

test("the composer silently limits blank lines when typing and pasting", async ({
  context,
  page,
}) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/posts", (route) =>
    route.fulfill({
      json: { posts: [], nextCursor: null, serverNow: new Date().toISOString() },
    }),
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: false,
        user: {
          id: "88888888-8888-4888-8888-888888888888",
          handle: "feed_tester",
          displayName: "Feed tester",
          avatarUrl: null,
          bannerUrl: null,
          bannerCrop: null,
        },
        avatarUrl: null,
        suggestedHandle: "feed_tester",
      },
    }),
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const draft = page.getByRole("textbox", { name: "What's on your mind?" });
  await expect(draft).toHaveCSS("font-size", "16px");
  await draft.fill("First");
  for (let i = 0; i < 5; i++) await draft.press("Enter");
  await expect(draft).toHaveValue("First\n\n\n");
  await draft.press("L");
  await expect(draft).toHaveValue("First\n\n\nL");

  await page.evaluate(() =>
    navigator.clipboard.writeText("One\r\n \r\n\t\r\n\r\nTwo\n\n\n\nThree"),
  );
  await draft.selectText();
  await draft.press("Control+V");
  await expect(draft).toHaveValue("One\n \n\t\nTwo\n\n\nThree");
  await expect(page.getByRole("button", { name: "Publish post" })).toBeEnabled();
});
