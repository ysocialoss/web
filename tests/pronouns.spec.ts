import { expect, test, type Locator } from "@playwright/test";

async function popupResizeHeights(tab: Locator) {
  return tab.evaluate(async (element) => {
    const popup = element.closest<HTMLElement>('[role="dialog"]');
    const scrollport = element.closest<HTMLElement>(".overflow-y-auto");
    const tabList = element.closest<HTMLElement>('[role="tablist"]');
    if (!(element instanceof HTMLElement) || !popup || !scrollport || !tabList)
      throw new Error("Expected a tab inside a dialog");

    const heights = [popup.offsetHeight];
    const widths = [tabList.offsetWidth];
    let animated = false;
    let scrollbarDuringResize = false;
    element.click();
    const deadline = performance.now() + 350;
    do {
      await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      heights.push(popup.offsetHeight);
      widths.push(tabList.offsetWidth);
      if (popup.hasAttribute("data-resizing")) {
        scrollbarDuringResize ||= getComputedStyle(scrollport).overflowY !== "hidden";
      }
      animated ||= popup.getAnimations().some(
        ({ effect }) =>
          effect instanceof KeyframeEffect &&
          effect.getKeyframes().some((frame) => "height" in frame),
      );
    } while (performance.now() < deadline);
    return { heights, animated, widths, scrollbarDuringResize };
  });
}

test.use({ locale: "de-DE", reducedMotion: "reduce" });

test.describe("mobile onboarding", () => {
  test.use({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 700 },
  });

  test("keeps both pronoun step actions in view", async ({ page }) => {
    await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
    await page.route("**/api/profiles/*/availability", (route) =>
      route.fulfill({ json: { available: true } }),
    );
    await page.route("**/auth/me", (route) =>
      route.fulfill({
        json: {
          authenticated: true,
          needsOnboarding: true,
          user: null,
          avatarUrl: null,
          suggestedHandle: "pronouns_user",
        },
      }),
    );

    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Continue", exact: true }).tap();
    await expect(
      page.getByRole("heading", { name: "What are your pronouns?" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeInViewport({
      ratio: 1,
    });
    await expect(
      page.getByRole("button", { name: "Create profile" }),
    ).toBeInViewport({ ratio: 1 });
  });
});

test("onboarding and profile editing save suggested and custom pronouns", async ({
  page,
}) => {
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    handle: "pronouns_user",
    displayName: "Pronouns User",
    avatarUrl: null,
    bannerUrl: null,
    bannerCrop: null,
  };
  let onboarded = false;
  let pronouns = "";
  let profileCreations = 0;
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/github", (route) =>
    route.fulfill({ json: { configured: true, github: null } }),
  );
  await page.route("**/api/profiles/*/availability", (route) =>
    route.fulfill({
      json: { available: !route.request().url().includes("/taken_handle/") },
    }),
  );
  await page.route("**/api/profiles/pronouns/recommendations", (route) =>
    route.fulfill({
      json: {
        languages: { de: ["sie/ihr", "er/ihm"], fi: ["hän"] },
        general: ["Use my name", "Any pronouns"],
        maxLength: 80,
      },
    }),
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        needsOnboarding: !onboarded,
        user: onboarded ? { ...user, pronouns } : null,
        avatarUrl: null,
        suggestedHandle: user.handle,
      },
    }),
  );
  await page.route("**/auth/profile", (route) => {
    profileCreations++;
    expect(route.request().postDataJSON()).toEqual({
      handle: user.handle,
      pronouns: "hän",
    });
    onboarded = true;
    pronouns = "hän";
    return route.fulfill({
      status: 201,
      json: { user: { ...user, pronouns } },
    });
  });
  await page.route(`**/api/profiles/${user.handle}`, (route) =>
    route.fulfill({
      json: {
        profile: {
          ...user,
          bio: "",
          pronouns,
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
  const updates: unknown[] = [];
  await page.route("**/api/profiles/me", (route) => {
    const body = route.request().postDataJSON();
    updates.push(body);
    pronouns = body.pronouns;
    return route.fulfill({ json: { ...user, bio: "", pronouns } });
  });

  await page.goto("/onboarding");
  const next = page.getByRole("button", { name: "Continue", exact: true });
  const handle = page.getByRole("textbox", { name: "Handle" });
  await expect(
    page.getByRole("heading", { name: "Choose your handle" }),
  ).toBeVisible();
  await handle.fill("taken_handle");
  await expect(page.getByText("That handle is already taken.")).toBeVisible();
  await expect(next).toBeDisabled();
  await handle.fill(user.handle);
  await next.click();
  await expect(
    page.getByRole("heading", { name: "What are your pronouns?" }),
  ).toBeFocused();
  expect(profileCreations).toBe(0);

  const create = page.getByRole("button", { name: "Create profile" });
  await expect(create).toBeDisabled();
  const skip = page.getByRole("checkbox", {
    name: "Leave pronouns off my profile",
  });
  await skip.check();
  await expect(create).toBeEnabled();
  await skip.uncheck();

  const field = page.getByRole("combobox", { name: "Pronouns" });
  const createPosition = await create.boundingBox();
  await field.click();
  await expect(page.getByRole("option", { name: "sie/ihr" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Use my name" })).toBeVisible();
  expect(await create.boundingBox()).toEqual(createPosition);
  const suggestions = page.getByRole("listbox", { name: "Pronoun suggestions" });
  await page.getByRole("option", { name: "sie/ihr" }).click();
  await expect(field).toHaveValue("sie/ihr");
  await expect(suggestions).toBeHidden();
  await field.fill("hä");
  await expect(page.getByRole("option", { name: "hän" })).toBeVisible();
  await expect(page.getByRole("option", { name: "sie/ihr" })).toBeHidden();
  await field.press("ArrowDown");
  await field.press("Enter");
  await expect(field).toHaveValue("hän");
  await expect(suggestions).toBeHidden();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(handle).toHaveValue(user.handle);
  await next.click();
  await expect(field).toHaveValue("hän");
  expect(profileCreations).toBe(0);
  await create.click();
  await expect(create).toBeHidden();
  expect(profileCreations).toBe(1);

  await page.waitForURL(`**/@${user.handle}`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("hän", { exact: true })).toBeVisible();
  const edit = page.getByRole("button", { name: "Edit profile", exact: true });
  const done = page.getByRole("button", { name: "Done", exact: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await edit.click();
  await field.fill("  ze/zir, 她  ");
  const dialog = page.getByRole("dialog", { name: "Edit profile" });
  const fieldGaps = await dialog.locator("form label").evaluateAll((labels) =>
    labels.map((label) => {
      const field = label.nextElementSibling;
      if (!field) throw new Error("Expected a field after its label");
      return Math.round(
        field.getBoundingClientRect().top - label.getBoundingClientRect().bottom,
      );
    }),
  );
  expect(fieldGaps).toHaveLength(4);
  expect(new Set(fieldGaps).size).toBe(1);
  const profileTab = dialog.getByRole("tab", { name: "Profile", exact: true });
  const connectionsTab = dialog.getByRole("tab", { name: "Connections" });
  await expect(profileTab).toHaveAttribute("aria-selected", "true");
  const desktopResize = await popupResizeHeights(connectionsTab);
  expect(desktopResize.heights.at(-1)).toBeLessThan(desktopResize.heights[0]);
  expect(new Set(desktopResize.heights).size).toBeGreaterThan(2);
  expect(desktopResize.animated).toBe(true);
  expect(desktopResize.scrollbarDuringResize).toBe(false);
  expect(new Set(desktopResize.widths).size).toBe(1);
  await expect(connectionsTab).toHaveAttribute("aria-selected", "true");
  await expect(
    dialog.getByRole("tabpanel", { name: "Connections" }),
  ).toContainText("GitHub");
  await expect(field).toBeHidden();
  await expect(done).toBeHidden();
  expect(updates).toHaveLength(0);
  const desktopGrowth = await popupResizeHeights(profileTab);
  expect(desktopGrowth.heights.at(-1)).toBeGreaterThan(desktopGrowth.heights[0]);
  expect(desktopGrowth.animated).toBe(true);
  expect(desktopGrowth.scrollbarDuringResize).toBe(false);
  expect(new Set(desktopGrowth.widths).size).toBe(1);
  await expect(field).toHaveValue("  ze/zir, 她  ");
  await done.click();
  await expect(page.getByText("ze/zir, 她", { exact: true })).toBeVisible();
  await edit.click();
  await field.clear();
  await done.click();
  await expect(page.getByText("ze/zir, 她", { exact: true })).toBeHidden();
  expect(updates).toEqual([{ pronouns: "ze/zir, 她" }, { pronouns: "" }]);

  await page.goto("/");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await connectionsTab.click();
  await expect(
    dialog.getByRole("tabpanel", { name: "Connections" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto(`/@${user.handle}`);
  await edit.click();
  const mobileResize = await popupResizeHeights(connectionsTab);
  expect(mobileResize.heights.at(-1)).toBeLessThan(mobileResize.heights[0]);
  expect(new Set(mobileResize.heights).size).toBeGreaterThan(2);
  expect(mobileResize.animated).toBe(true);
  expect(mobileResize.scrollbarDuringResize).toBe(false);
  expect(new Set(mobileResize.widths).size).toBe(1);
  await expect(
    dialog.getByRole("tabpanel", { name: "Connections" }),
  ).toBeVisible();
  const mobileGrowth = await popupResizeHeights(profileTab);
  expect(mobileGrowth.heights.at(-1)).toBeGreaterThan(mobileGrowth.heights[0]);
  expect(mobileGrowth.animated).toBe(true);
  expect(mobileGrowth.scrollbarDuringResize).toBe(false);
  expect(new Set(mobileGrowth.widths).size).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionResize = await popupResizeHeights(connectionsTab);
  expect(reducedMotionResize.heights.at(-1)).toBeLessThan(
    reducedMotionResize.heights[0],
  );
  expect(reducedMotionResize.animated).toBe(false);

  await page.setViewportSize({ width: 390, height: 500 });
  await profileTab.click();
  const scrollport = dialog.locator(".overflow-y-auto");
  await expect(scrollport).toHaveCSS("overflow-y", "auto");
  expect(
    await scrollport.evaluate((element) => element.scrollHeight - element.clientHeight),
  ).toBeGreaterThan(0);
});
