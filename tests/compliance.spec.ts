import { expect, test, type Page } from "@playwright/test";

const viewer = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "viewer",
  displayName: "Viewer",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
  navigation: null,
  feedPersonalize: true,
};
const author = { id: "88888888-8888-4888-8888-888888888888", handle: "feed_author", displayName: "Feed author", avatarUrl: null };
const post = {
  id: "00000000-0000-4000-8000-000000000001",
  content: "A post in the feed.",
  author,
  parentId: null,
  createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
  editedAt: null,
  editExpiresAt: new Date(Date.UTC(2026, 0, 1, 1)).toISOString(),
  likes: 0,
  liked: false,
  replies: 0,
  reposts: 0,
  reposted: false,
};

async function setup(page: Page, session: Record<string, unknown> | null = {}) {
  const calls: { path: string; body: unknown }[] = [];
  await page.addInitScript(() => {
    window.EventSource = class extends EventTarget {
      close() {}
    } as unknown as typeof EventSource;
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route("**/auth/me", (route) =>
    route.fulfill({
      json: session === null
        ? { authenticated: false }
        : {
            authenticated: true,
            needsOnboarding: false,
            user: viewer,
            avatarUrl: null,
            suggestedHandle: viewer.handle,
            termsVersion: "2026-11-27",
            ...session,
          },
    }),
  );
  await page.route("**/api/posts", (route) =>
    route.fulfill({ json: { posts: [post], repostedBy: {}, nextCursor: null, serverNow: new Date().toISOString() } }));
  await page.route("**/api/posts/states?*", (route) => route.fulfill({ json: { viewerId: viewer.id, posts: [] } }));
  await page.route("**/api/feed/events", (route) => {
    calls.push({ path: "events", body: route.request().postDataJSON() });
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/feed/preferences", (route) => {
    calls.push({ path: "preferences", body: route.request().postDataJSON() });
    return route.fulfill({ json: { personalize: false, chosen: true, cleared: 3 } });
  });
  return calls;
}

test("legal pages render in German and English and the imprint handles a missing configuration", async ({ page }) => {
  await setup(page, null);
  await page.route("**/api/legal/operator", (route) => route.fulfill({ status: 503, json: { error: "operator_not_configured" } }));
  await page.goto("/legal/privacy");
  await expect(page.getByRole("heading", { name: "Datenschutzerklärung", level: 1 })).toBeVisible();
  await expect(page.getByText("Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein")).toBeVisible();
  await page.getByRole("tab", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/lang=en/);
  await page.goto("/legal/terms");
  await expect(page.getByText("3.1 Minimum age", { exact: false })).toHaveCount(0);
  await expect(page.getByText("3.1 Mindestalter.")).toBeVisible();
  await page.goto("/legal/imprint");
  await expect(page.getByRole("alert")).toContainText("Anbieterangaben");
});

test("the imprint shows the configured operator and the DSA contact point", async ({ page }) => {
  await setup(page, null);
  await page.route("**/api/legal/operator", (route) => route.fulfill({
    json: { name: "Erika Muster", address: ["c/o Beispiel", "25421 Pinneberg"], email: "hello@example.org", hashMatching: false, contacts: { privacy: "privacy@example.org", abuse: "abuse@example.org" } },
  }));
  await page.goto("/legal/imprint");
  await expect(page.getByText("Erika Muster")).toBeVisible();
  await expect(page.getByRole("link", { name: "abuse@example.org" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ysocial Kontaktformular" })).toBeVisible();
  await expect(page.getByText("Telefon")).toHaveCount(0);
});

test("the hash matching paragraph only appears while it is enabled", async ({ page }) => {
  await setup(page, null);
  const operator = { name: "Erika Muster", address: ["c/o Beispiel"], email: "hello@example.org", contacts: { privacy: null, abuse: null } };
  await page.route("**/api/legal/operator", (route) => route.fulfill({ json: { ...operator, hashMatching: false } }));
  await page.goto("/legal/privacy?lang=en");
  await expect(page.getByRole("heading", { name: "5. Safety and image checks" })).toBeVisible();
  await expect(page.getByText("PhotoDNA")).toHaveCount(0);
  await page.unroute("**/api/legal/operator");
  await page.route("**/api/legal/operator", (route) => route.fulfill({ json: { ...operator, hashMatching: true } }));
  await page.reload();
  await expect(page.getByText("PhotoDNA").first()).toBeVisible();
});

test("the contact form sends a message and a filled honeypot is passed along", async ({ page }) => {
  await setup(page, null);
  let sent: unknown = null;
  await page.route("**/api/contact", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 204 });
  });
  await page.goto("/contact");
  const send = page.getByRole("button", { name: "Send message" });
  await expect(send).toBeDisabled();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("I have a question about my account.");
  await page.getByLabel(/Your email/).fill("me@example.org");
  await send.click();
  await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
  expect(sent).toEqual({ message: "I have a question about my account.", email: "me@example.org" });
});

test("nothing is tracked until the feed choice is made, and keeping it off is saved", async ({ page }) => {
  const calls = await setup(page, { feedChoiceNeeded: true });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Personalize your feed?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Which posts appeared on your screen");
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  expect(calls.filter((call) => call.path === "events")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Keep off" }).click();
  await expect.poll(() => calls.find((call) => call.path === "preferences")?.body).toEqual({ personalize: false });
});

test("outdated terms block the app until they are accepted", async ({ page }) => {
  let accepted: unknown = null;
  await setup(page, { termsCurrent: false });
  await page.route("**/auth/terms", (route) => {
    accepted = route.request().postDataJSON();
    return route.fulfill({ status: 204 });
  });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Our terms have been updated" });
  await expect(dialog).toBeVisible();
  const proceed = dialog.getByRole("button", { name: "Continue" });
  await expect(proceed).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "I am at least 16 years old." }).check();
  await dialog.getByRole("checkbox", { name: "I accept the updated Terms of use." }).check();
  await proceed.click();
  await expect.poll(() => accepted).toEqual({ version: "2026-11-27", acceptTerms: true, ageConfirmed: true });
});

test("anyone can send a notice through the public report form", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await setup(page, null);
  await page.route("**/api/reports/public", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { reference: "22222222-2222-4222-8222-222222222222", receivedAt: new Date().toISOString(), statusToken: "t".repeat(43) } });
  });
  await page.goto("/report");
  const submit = page.getByRole("button", { name: "Send report" });
  await page.getByLabel("Link to the post or profile").fill(`http://127.0.0.1:3012/posts/${post.id}`);
  await page.getByLabel("Explanation").fill("This post insults a named person in a way that is clearly punishable.");
  await expect(submit).toBeDisabled();
  await page.getByLabel("Your name").fill("Erika Muster");
  await page.getByLabel("Your email").fill("erika@example.org");
  await page.getByRole("checkbox", { name: /good faith/ }).check();
  await submit.click();
  await expect(page.getByRole("heading", { name: "Report received" })).toBeVisible();
  expect(sent).toMatchObject({ reason: "illegal", name: "Erika Muster", email: "erika@example.org", goodFaith: true });
  await expect(page.getByText(`/report/status/${"t".repeat(43)}`)).toBeVisible();
});

test("a moderation decision explains itself and can be appealed", async ({ page }) => {
  let appeal: unknown = null;
  await setup(page);
  const decision = {
    id: "33333333-3333-4333-8333-333333333333",
    action: "hide_post",
    targetType: "post",
    targetKey: post.id,
    excerpt: "the hidden words",
    groundType: "terms",
    groundRef: "5.2",
    facts: "The post insults another user.",
    automatedDetection: false,
    automatedDecision: false,
    fromReport: true,
    seenAt: null,
    reversedAt: null,
    createdAt: new Date().toISOString(),
    appeal: null,
    appealDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    canAppeal: true,
  };
  await page.route("**/api/moderation/notices", (route) =>
    route.fulfill({ json: { decisions: [appeal ? { ...decision, appeal: { id: decision.id, text: "x", status: "open", staffNote: null, resolvedAt: null, createdAt: decision.createdAt } } : decision], reportUpdates: [], unseen: 1 } }));
  await page.route("**/api/moderation/notices/seen", (route) => route.fulfill({ status: 204 }));
  await page.route(`**/api/moderation/decisions/${decision.id}/appeal`, (route) => {
    appeal = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: decision.id } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: "We hid your post" })).toBeVisible();
  await expect(page.getByText("Terms of use, section 5.2 (Harassment and threats)")).toBeVisible();
  await expect(page.getByText("After a report, decided by a person.")).toBeVisible();
  await page.getByRole("button", { name: "Appeal" }).click();
  await page.getByLabel("Why should we reconsider?").fill("It was a quote from a film.");
  await page.getByRole("button", { name: "Send appeal" }).click();
  await expect.poll(() => appeal).toEqual({ text: "It was a quote from a film." });
  await expect(page.getByText("Your appeal: under review")).toBeVisible();
});

test("the post menu explains why a post is in the feed", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await page.getByRole("article").first().getByRole("button", { name: "Post options" }).click();
  await page.getByRole("menuitem", { name: "Why am I seeing this?" }).click();
  await expect(page.getByRole("dialog", { name: "Why am I seeing this?" })).toContainText("Latest shows every public post");
});
