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
const paint = {
  id: "sunset",
  name: "Sunset",
  definition: { kind: "linear", angle: 90, stops: [{ color: "#d04e0b", at: 0 }, { color: "#dd317d", at: 1 }] },
};
const session = {
  authenticated: true,
  needsOnboarding: false,
  pendingApproval: false,
  ban: null,
  user: viewer,
  avatarUrl: null,
  suggestedHandle: viewer.handle,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/domains", (route) =>
    route.fulfill({ json: { domains: [], max: 10 } }),
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({ json: session }),
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
  await page.route("**/api/notifications/preferences", (route) =>
    route.fulfill({ json: { mutedKinds: [] } }),
  );
});

test("notification switches save independently and survive a reload", async ({ page }) => {
  const muted = new Set(["dm_message"]);
  let finishLikesSave: () => void = () => {};
  const releaseLikesSave = new Promise<void>((resolve) => { finishLikesSave = resolve; });
  await page.route("**/api/notifications/preferences", async (route) => {
    if (route.request().method() !== "PATCH")
      return route.fulfill({ json: { mutedKinds: [...muted] } });

    const { kind, enabled } = route.request().postDataJSON();
    if (kind === "quote")
      return route.fulfill({ status: 503, json: { error: "unavailable" } });

    expect(enabled).toEqual(muted.has(kind));
    if (kind === "like" && !enabled) await releaseLikesSave;
    if (enabled) muted.delete(kind);
    else muted.add(kind);
    await route.fulfill({ json: { mutedKinds: [...muted] } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/account");
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Notifications", exact: true }).click();
  const preferences = page.getByRole("group", { name: "When to notify me" });
  const likes = preferences.getByRole("switch", { name: "Likes" });
  const messages = preferences.getByRole("switch", { name: "Messages" });
  const invites = preferences.getByRole("switch", { name: "Message invites" });
  const quotes = preferences.getByRole("switch", { name: "Quotes" });
  await expect(preferences.getByRole("switch")).toHaveCount(10);
  await expect(likes).toHaveAttribute("data-slot", "switch");
  await expect(likes).toBeChecked();
  await expect(messages).not.toBeChecked();
  await expect(invites).toBeChecked();
  await invites.click();
  await expect(invites).toHaveAttribute("aria-busy", "false");
  await expect(invites).not.toBeChecked();
  try {
    await preferences.getByText("Likes", { exact: true }).click();
    await expect(likes).not.toBeChecked();
    await expect(likes).toHaveAttribute("aria-busy", "true");
    await messages.press("Space");
    await expect(messages).toBeChecked();
    await expect(messages).toHaveAttribute("aria-busy", "false");
  } finally {
    finishLikesSave();
  }
  await expect(likes).toHaveAttribute("aria-busy", "false");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Notifications", exact: true }).click();
  await expect(likes).not.toBeChecked();
  await expect(messages).toBeChecked();
  await expect(invites).not.toBeChecked();
  await likes.click();
  await expect(likes).toHaveAttribute("aria-busy", "false");
  await expect(likes).toBeChecked();
  await quotes.click();
  await expect(preferences.getByRole("alert")).toBeVisible();
  await expect(quotes).toBeChecked();
});

test("account settings reuse the profile popups and keep the account menu entry", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Account settings" }).click();
  await expect(page).toHaveURL(/\/$/);
  const settings = page.getByRole("dialog", { name: "Account settings" });
  await expect(settings).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  await expect(page.getByText("Growing things.")).toBeVisible();

  await page.getByRole("button", { name: "Edit profile" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Edit profile" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "Connections" }).click();
  await expect(page.getByRole("button", { name: "Connect GitHub" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Discord" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Connect Twitch" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeFocused();
});

test("both display names in account settings animate the equipped paint", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/auth/me", (route) => route.fulfill({ json: { ...session, user: { ...viewer, paint } } }));

  await page.goto("/settings/account");
  const dialog = page.getByRole("dialog", { name: "Account settings" });
  const names = dialog.getByText(viewer.displayName, { exact: true });
  await expect(names).toHaveCount(2);
  for (const name of await names.all()) {
    await expect(name).toBeVisible();
    await expect(name).toHaveCSS("animation-name", "name-paint-sweep");
  }
  const handles = dialog.getByText(/^@viewer\b/);
  await expect(handles).toHaveCount(2);
  for (const handle of await handles.all()) {
    await expect(handle).toHaveCSS("animation-name", "none");
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const name of await names.all()) {
    await expect(name).toHaveCSS("animation-name", "none");
    await expect(name).toHaveCSS("background-image", /^linear-gradient/);
  }
});

test("disabling name paints hides every paint and persists through the account API", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let namePaintsDisabled = false;
  let failSave = true;
  await page.route("**/auth/me", (route) => route.fulfill({ json: { ...session, user: { ...viewer, paint, namePaintsDisabled } } }));
  await page.route("**/auth/name-paints", (route) => {
    expect(route.request().method()).toBe("PUT");
    const { userId, disabled } = route.request().postDataJSON();
    expect(userId).toBe(viewer.id);
    expect(disabled).toBe(!namePaintsDisabled);
    if (failSave) return route.fulfill({ status: 500, json: { error: "unavailable" } });
    namePaintsDisabled = disabled;
    return route.fulfill({ status: 204 });
  });

  const other = { ...viewer, id: "22222222-2222-4222-8222-222222222222", handle: "other", displayName: "Other Ollie" };
  for (const user of [viewer, other]) {
    await page.route(`**/api/profiles/${user.handle}`, (route) => route.fulfill({ json: {
      profile: { ...user, paint, bio: "", createdAt: now, followerCount: 0, followingCount: 0, postCount: 0 },
      isFollowing: false,
      isFollowedBy: false,
      posts: [],
      replies: [],
      reposts: [],
      repostedBy: {},
      serverNow: now,
    } }));
  }
  await page.route("**/api/paints", (route) => route.fulfill({ json: { paints: [{ ...paint, isFree: true, owned: true }] } }));

  const settings = page.getByRole("dialog", { name: "Account settings" });
  const disablePaints = settings.getByRole("switch", { name: "Disable name paints" });
  async function openAppearance() {
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("button", { name: "Account settings" }).click();
    await settings.getByRole("button", { name: "Appearance" }).click();
  }

  await page.goto(`/@${other.handle}`);
  const otherName = page.getByRole("heading", { name: other.displayName }).getByText(other.displayName, { exact: true });
  await expect(otherName).toHaveCSS("animation-name", "name-paint-sweep");
  await openAppearance();
  await expect(disablePaints).not.toBeChecked();
  await disablePaints.click();
  await expect(settings.getByRole("alert")).toBeVisible();
  await expect(disablePaints).not.toBeChecked();
  failSave = false;
  await disablePaints.click();
  await expect(disablePaints).toBeChecked();
  await expect(settings.getByText(viewer.displayName, { exact: true }).filter({ visible: true })).toHaveCSS("background-image", "none");
  await settings.getByRole("button", { name: "Close account settings" }).click();
  await expect(otherName).toHaveCSS("background-image", "none");
  await expect(otherName).toHaveCSS("animation-name", "none");
  await page.reload();
  await expect(otherName).toHaveCSS("background-image", "none");

  await page.goto(`/@${viewer.handle}`);
  const ownName = page.getByRole("heading", { name: viewer.displayName }).getByText(viewer.displayName, { exact: true });
  await expect(ownName).toHaveCSS("background-image", "none");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("tab", { name: "Paint", exact: true }).click();
  const preview = page.getByRole("radio", { name: /Sunset/ }).getByText(viewer.displayName, { exact: true });
  await expect(preview).toHaveCSS("background-image", "none");

  await page.goto(`/@${other.handle}`);
  await openAppearance();
  await expect(disablePaints).toBeChecked();
  await disablePaints.click();
  await expect(disablePaints).not.toBeChecked();
  await settings.getByRole("button", { name: "Close account settings" }).click();
  await expect(otherName).toHaveCSS("animation-name", "name-paint-sweep");
  await page.goto(`/@${viewer.handle}`);
  await expect(ownName).toHaveCSS("animation-name", "name-paint-sweep");
});

test("the logo can be pinned to a variation and links to its occasion", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Automatic/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /Earth Day/ }).click();
  await page.getByRole("button", { name: "Close account settings" }).click();
  const logo = page.getByRole("link", { name: /Earth Day, opens in a new tab/ });
  await expect(logo).toHaveAttribute("href", "https://www.earthday.org/");
  await logo.hover();
  await expect(page.locator("[data-slot=tooltip-content]", { hasText: "Earth Day" })).toBeVisible();
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("radio", { name: /Main logo/ }).click();
  await page.getByRole("button", { name: "Close account settings" }).click();
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
  await page.getByRole("button", { name: "Connections" }).click();
  await page.getByRole("button", { name: "Connect Discord" }).click();
  await expect.poll(() => body).toEqual({ returnTo: "settings" });
  await expect(page).toHaveURL(/discord\.com\/oauth2\/authorize/);

  await page.goto("/settings/account?connection=discord&result=invalid_state");
  const error = page.getByRole("alertdialog", { name: "Something went wrong" });
  await expect(error.getByText("The connection request expired. Try connecting again.")).toBeVisible();
  await error.getByRole("button", { name: "OK" }).click();
  const settings = page.getByRole("dialog", { name: "Account settings" });
  await expect(settings.getByRole("region", { name: "Connections" })).toBeVisible();
});

test("connection cards count linked accounts and save profile visibility", async ({ page }) => {
  const spotify = {
    provider: "spotify",
    username: "listener",
    displayName: "Listener",
    profileUrl: "https://open.spotify.com/user/listener",
    displayOnProfile: true,
  };
  const domain = {
    id: "domain-id",
    domain: "example.com",
    verified: true,
    record: null,
    displayOnProfile: false,
  };
  let linked = false;
  await page.route("**/api/connections", (route) => route.fulfill({
    json: { providers: [{ provider: "spotify", configured: true, connection: linked ? spotify : null }] },
  }));
  await page.route("**/api/connections/spotify/link", (route) => {
    expect(route.request().postDataJSON()).toEqual({ url: spotify.profileUrl });
    linked = true;
    return route.fulfill({ status: 201, json: { connection: spotify } });
  });
  await page.route("**/api/connections/spotify", (route) => {
    if (route.request().method() === "DELETE") {
      linked = false;
      return route.fulfill({ status: 204 });
    }
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({ displayOnProfile: false });
    spotify.displayOnProfile = false;
    return route.fulfill({ json: { connection: spotify } });
  });
  await page.route("**/api/domains", (route) => route.fulfill({ json: { domains: [domain], max: 10 } }));
  await page.goto("/settings/account");
  await page.getByRole("button", { name: "Connections" }).click();
  await expect(page.getByRole("heading", { name: "1 connection" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Display example.com on profile" })).not.toBeChecked();
  await page.getByRole("button", { name: "Connect Spotify" }).click();
  const add = page.getByRole("dialog", { name: "Connect Spotify" });
  await add.getByRole("textbox", { name: "Spotify profile link" }).fill(spotify.profileUrl);
  await add.getByRole("button", { name: "Add connection" }).click();
  await expect(add).toBeHidden();
  await expect(page.getByRole("heading", { name: "2 connections" })).toBeVisible();
  const visibility = page.getByRole("switch", { name: "Display listener on profile" });
  await expect(visibility).toBeChecked();
  await visibility.click();
  await expect(visibility).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Connections" }).click();
  await expect(visibility).not.toBeChecked();
  await page.getByRole("button", { name: "Disconnect listener" }).click();
  await page.getByRole("dialog", { name: "Disconnect Spotify?" })
    .getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.getByRole("heading", { name: "1 connection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Spotify" })).toBeEnabled();
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
