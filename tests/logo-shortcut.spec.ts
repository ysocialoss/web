import { expect, test } from "@playwright/test";

for (const mobile of [false, true]) {
  test(`only feed logo clicks count toward Settings on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 740 } : { width: 1280, height: 800 },
    );
    await page.emulateMedia({
      reducedMotion: mobile ? "reduce" : "no-preference",
    });
    await page.route("**/auth/me", (route) =>
      route.fulfill({ json: { authenticated: false } }),
    );
    await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
    await page.addInitScript(() => {
      document.addEventListener("transitionrun", (event) => {
        if (
          event.propertyName === "opacity" &&
          event.target instanceof Element &&
          event.target.classList.contains("site-wordmark-tint")
        ) {
          const root = document.documentElement;
          root.dataset.logoFades = String(
            Number(root.dataset.logoFades ?? 0) + 1,
          );
        }
      });
    });

    await page.goto("/report");
    const logo = page.getByRole("link", { name: "ysocial home" });
    const wordmark = logo.locator(".site-wordmark-tint");
    const opacity = () =>
      wordmark.evaluate(
        (element) => getComputedStyle(element).opacity,
      );
    const root = page.locator("html");
    const isShaking = () =>
      logo.evaluate((element) => element.getAnimations().length > 0);
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(opacity).toBe("0");
    await logo.click();
    expect(await isShaking()).toBe(false);
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
    expect(await isShaking()).toBe(!mobile);
    await logo.click();
    await expect(page).toHaveURL(/\/asettings$/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    if (mobile) {
      await expect(root).not.toHaveAttribute("data-logo-fades");
    } else {
      await expect(root).toHaveAttribute("data-logo-fades", "1");
    }
    await expect.poll(opacity).toBe("1");
    await logo.click();
    await expect(page).toHaveURL(/\/$/);
    if (!mobile) await expect(root).toHaveAttribute("data-logo-fades", "2");
    await expect.poll(opacity).toBe("0");

    if (!mobile) {
      await page.goto("/asettings");
      await expect(root).toHaveAttribute("data-logo-fades", "1");
      await expect.poll(opacity).toBe("1");
    }
  });
}
