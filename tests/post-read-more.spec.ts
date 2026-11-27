import { expect, test } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`long feed posts expand and collapse with motion set to ${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    const post = {
      id: "00000000-0000-4000-8000-000000000001",
      content: Array.from({ length: 10 }, (_, line) => `Line ${line + 1}`).join(
        "\n",
      ),
      author: {
        id: "88888888-8888-4888-8888-888888888888",
        handle: "feed_tester",
        displayName: "Feed tester",
        avatarUrl: null,
      },
      parentId: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      editExpiresAt: new Date().toISOString(),
      likes: 0,
      liked: false,
      replies: 0,
      reposts: 0,
      reposted: false,
    };
    await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
    await page.route("**/auth/me", (route) =>
      route.fulfill({ json: { authenticated: false } }),
    );
    await page.route(/\/api\/(posts|feed\/for-you)$/, (route) =>
      route.fulfill({
        json: { posts: [post], nextCursor: null, serverNow: post.createdAt },
      }),
    );
    await page.goto("/");

    const caption = page.locator("article p[data-selectable]");
    const isClipped = () =>
      caption.evaluate(
        (element) =>
          element.getBoundingClientRect().height >
          (element.parentElement?.clientHeight ?? 0) + 1,
      );
    const more = page.getByRole("button", { name: "Read more" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    expect(await isClipped()).toBe(true);
    const preview = caption.locator("..");
    if (reducedMotion === "no-preference") {
      await expect(preview).toHaveCSS(
        "transition-property",
        "max-height, mask-size",
      );
      await expect(preview).toHaveCSS("transition-duration", "0.3s");
    } else {
      const duration = await preview.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).transitionDuration),
      );
      expect(duration).toBeLessThan(0.001);
    }
    await more.click();
    const less = page.getByRole("button", { name: "Read less" });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    const lineHeight = await caption.evaluate(
      (element) => getComputedStyle(element).lineHeight,
    );
    await expect(preview).toHaveCSS(
      "mask-size",
      `100% calc(100% + ${lineHeight})`,
    );
    await expect.poll(isClipped).toBe(false);
    await less.click();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect.poll(isClipped).toBe(true);
  });
}
