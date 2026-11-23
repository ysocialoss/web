import { expect, test } from "@playwright/test";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "viewer",
  displayName: "Viewer",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
};

test.beforeEach(async ({ page }) => {
  let navigation: string[] | null = null;
  await page.setViewportSize({ width: 850, height: 650 });
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/domains", (route) =>
    route.fulfill({ json: { domains: [], max: 10 } }),
  );
  await page.route("**/api/github", (route) =>
    route.fulfill({ json: { configured: false, github: null } }),
  );
  await page.route("**/api/connections", (route) =>
    route.fulfill({ json: { providers: [] } }),
  );
  await page.route("**/api/dms/unread", (route) =>
    route.fulfill({ json: { unread: 3, requests: 0 } }),
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: false,
        user: { ...user, navigation },
        avatarUrl: null,
        suggestedHandle: user.handle,
      },
    }),
  );
  await page.route("**/auth/navigation", (route) => {
    navigation = route.request().postDataJSON().items;
    return route.fulfill({ status: 204 });
  });
});

test("keyboard edits retain focus and survive a switch to the mobile layout", async ({
  page,
}) => {
  await page.goto("/settings/account");
  const trigger = page.getByRole("button", {
    name: "Customize navigation",
    exact: true,
  });
  const editor = page.getByRole("dialog", {
    name: "Customize navigation",
  });
  await trigger.press("Enter");

  const moveSearch = editor.getByRole("button", { name: "Move Search up" });
  await moveSearch.press("Enter");
  await expect(moveSearch).toBeDisabled();
  await expect(moveSearch).toBeFocused();
  await expect(editor.getByRole("listitem").first()).toContainText("Search");

  await editor.getByRole("button", { name: "Hide Messages" }).press("Enter");
  await expect(
    editor.getByRole("button", { name: "Hide Activity" }),
  ).toBeFocused();
  await editor.getByRole("button", { name: "Show Saved posts" }).press("Enter");
  await expect(
    editor.getByRole("button", { name: "Hide Saved posts" }),
  ).toBeFocused();

  await page.setViewportSize({ width: 767, height: 650 });
  await expect(editor.getByRole("listitem").first()).toContainText("Search");
  await page.setViewportSize({ width: 850, height: 650 });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("listitem").first()).toContainText("Search");
  await expect(
    editor.getByRole("button", { name: "Show Messages" }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Hide Saved posts" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await expect(editor.getByRole("listitem").first()).toContainText("Feed");
  await expect(
    editor.getByRole("button", { name: "Hide Messages" }),
  ).toBeVisible();
});

test("hidden Messages stays reachable from navigation and the account menu", async ({
  page,
}) => {
  await page.goto("/");
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  const editor = page.getByRole("dialog", {
    name: "Customize navigation",
  });
  const trigger = page.getByRole("button", { name: "Customize navigation" });
  await expect(trigger).toHaveCount(0);
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await expect(trigger).toHaveCount(0);
  await account.getByRole("link", { name: "Account settings" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await page
    .getByRole("region", { name: "Appearance" })
    .getByRole("button", {
      name: "Customize navigation",
    })
    .press("Enter");
  await expect(editor).toBeVisible();
  await expect(account).toBeHidden();
  await editor.getByRole("button", { name: "Hide Messages" }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor).toBeHidden();

  const desktopNav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(desktopNav.getByRole("link", { name: /Messages/ })).toHaveCount(
    0,
  );
  const inlineHidden = desktopNav.getByRole("list", {
    name: "Hidden shortcuts",
  });
  await desktopNav.getByRole("button", { name: "Show hidden" }).click();
  await expect(
    desktopNav.getByRole("button", { name: "Show fewer" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    inlineHidden.getByRole("link", { name: "Messages, 3 unread" }),
  ).toHaveAttribute("href", "/messages");
  await desktopNav.getByRole("button", { name: "Show fewer" }).click();
  await expect(inlineHidden).toBeHidden();
  const accountWithUnread = page.getByRole("button", {
    name: "Account menu, 3 unread messages",
  });
  await accountWithUnread.click();
  await account
    .getByRole("link", { name: "Messages, 3 unread messages" })
    .click();
  await expect(page).toHaveURL(/\/messages$/);

  await page.goto("/settings/account");
  await trigger.click();
  await expect(
    editor.getByRole("button", { name: "Show Messages" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 390, height: 720 });
  await expect(trigger).toBeVisible();
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(mobileNav.getByRole("link", { name: /Messages/ })).toHaveCount(
    0,
  );
  await mobileNav.getByRole("button", { name: "Show hidden" }).click();
  const hidden = page.getByRole("dialog", { name: "Hidden shortcuts" });
  await expect(hidden).toHaveAttribute("data-slot", "drawer-popup");
  await expect(hidden.getByRole("button", { name: "Close" })).toHaveAttribute(
    "data-slot",
    "drawer-close",
  );
  await expect(
    hidden.getByRole("link", { name: "Messages, 3 unread" }),
  ).toHaveAttribute("href", "/messages");
  await hidden.getByRole("button", { name: "Close" }).click();
  await expect(hidden).toBeHidden();
  await page
    .getByRole("button", {
      name: "Account menu, 3 unread messages",
      exact: true,
    })
    .click();
  await expect(
    account.getByRole("link", { name: "Messages, 3 unread messages" }),
  ).toHaveAttribute("href", "/messages");
});

test("shortcuts can be dragged with a mouse", async ({ page }) => {
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Customize navigation" }).click();
  const editor = page.getByRole("dialog", {
    name: "Customize navigation",
  });
  const shortcuts = editor.getByRole("listitem");
  const handle = shortcuts
    .filter({ hasText: "Messages" })
    .locator("[data-navigation-drag-handle]");
  const source = await handle.boundingBox();
  const firstRow = await shortcuts.first().boundingBox();
  if (!source || !firstRow) throw new Error("The shortcut list is missing");
  const x = source.x + source.width / 2;
  await page.mouse.move(x, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, firstRow.y + 4, { steps: 16 });
  await page.mouse.up();

  await expect(shortcuts.first()).toContainText("Messages");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link")
      .first(),
  ).toHaveAccessibleName(/Messages/);
});

test("all shortcuts fit in a scrollable mobile bar on narrow screens", async ({
  page,
}) => {
  await page.goto("/settings/account");
  const trigger = page.getByRole("button", { name: "Customize navigation" });
  const editor = page.getByRole("dialog", { name: "Customize navigation" });
  await trigger.click();
  await editor.getByRole("button", { name: "Show Saved posts" }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor).toBeHidden();
  await page.setViewportSize({ width: 320, height: 568 });

  const bar = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(bar.getByRole("link")).toHaveCount(6);
  await expect(bar.getByRole("button", { name: "Show hidden" })).toHaveCount(0);
  await expect(bar.getByRole("button", { name: "Communities" })).toBeDisabled();
  const saved = bar.getByRole("link", { name: "Saved posts" });
  await saved.scrollIntoViewIfNeeded();
  await expect(saved).toBeInViewport();
  await saved.click();
  await expect(page).toHaveURL(/\/saved$/);
});

test("the mobile bar stays compact with one visible shortcut and reachable with none", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/settings/account");
  const customize = page.getByRole("button", { name: "Customize navigation" });
  await customize.click();
  const editor = page.getByRole("dialog", { name: "Customize navigation" });
  for (const name of [
    "Search",
    "Messages",
    "Activity",
    "Communities",
    "Profile",
  ]) {
    await editor
      .getByRole("button", { name: `Hide ${name}`, exact: true })
      .click();
  }
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor).toBeHidden();

  const bar = page.getByRole("navigation", { name: "Mobile navigation" });
  const feed = bar.getByRole("link", { name: "Feed", exact: true });
  await expect(bar.getByRole("link")).toHaveCount(1);
  await expect(feed).toHaveCSS("width", "48px");
  await expect(feed).toHaveCSS("height", "48px");
  const showHidden = bar.getByRole("button", { name: "Show hidden" });
  await expect(showHidden).toHaveText("");
  await expect(showHidden).toHaveCSS("width", "48px");
  await expect(
    bar.locator('[data-slot="floating-navigation-indicator"]'),
  ).toHaveCSS("width", "48px");
  expect((await bar.boundingBox())?.width).toBeLessThan(120);

  await customize.click();
  await editor.getByRole("button", { name: "Hide Feed", exact: true }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(editor).toBeHidden();
  await expect(bar.getByRole("link")).toHaveCount(0);
  await bar.getByRole("button", { name: "Show hidden" }).click();
  const hidden = page.getByRole("dialog", { name: "Hidden shortcuts" });
  await expect(hidden).toHaveAttribute("data-slot", "drawer-popup");
  await expect(hidden.getByRole("link")).toHaveCount(6);
  await hidden.getByRole("link", { name: "Feed", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(hidden).toBeHidden();
  await expect(bar.getByRole("button", { name: "Show hidden" })).toBeVisible();
});

test.describe("touch navigation editor", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("phone controls can be tapped to show and save shortcuts", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/settings/account");
    await page.getByRole("button", { name: "Customize navigation" }).tap();
    const editor = page.getByRole("dialog", { name: "Customize navigation" });
    await expect(editor).toHaveAttribute("data-slot", "drawer-popup");
    await editor.getByRole("button", { name: "Show Saved posts" }).tap();
    await expect(
      editor.getByRole("button", { name: "Hide Saved posts" }),
    ).toBeVisible();
    await editor.getByRole("button", { name: "Save changes" }).tap();
    await expect(editor).toBeHidden();
  });

  test("touch dragging updates the shared saved order", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/settings/account");
    await page.getByRole("button", { name: "Customize navigation" }).tap();
    const editor = page.getByRole("dialog", {
      name: "Customize navigation",
    });
    const shortcuts = editor.getByRole("listitem");
    const handle = shortcuts
      .filter({ hasText: "Feed" })
      .locator("[data-navigation-drag-handle]");
    await expect(editor).toBeVisible();
    await handle.scrollIntoViewIfNeeded();
    const source = await handle.boundingBox();
    const thirdRow = await shortcuts.nth(2).boundingBox();
    if (!source || !thirdRow) throw new Error("The shortcut list is missing");
    const x = source.x + source.width / 2;
    const startY = source.y + source.height / 2;
    const endY = thirdRow.y + thirdRow.height - 4;
    const cdp = await context.newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: startY }],
      });
      for (let step = 1; step <= 16; step++) {
        const y = startY + ((endY - startY) * step) / 16;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await cdp.detach();
    }

    await expect(editor).toBeVisible();
    await expect(shortcuts.nth(2)).toContainText("Feed");
    // Cover touch activation separately from the raw CDP drag gesture.
    await editor.getByRole("button", { name: "Save changes" }).click();
    await expect(editor).toBeHidden();
    const mobileNav = page.getByRole("navigation", {
      name: "Mobile navigation",
    });
    await expect(mobileNav.getByRole("link").nth(2)).toHaveAccessibleName(
      "Feed",
    );
    await page.reload();
    await expect(mobileNav.getByRole("link").nth(2)).toHaveAccessibleName(
      "Feed",
    );
    await page.getByRole("button", { name: "Customize navigation" }).tap();
    await expect(shortcuts.nth(2)).toContainText("Feed");
  });
});
