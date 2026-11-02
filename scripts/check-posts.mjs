import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";

// Exercise the built web server, its proxy, Express, and PostgreSQL together.
const origin = "http://localhost:3300";
process.env.APP_ORIGIN = origin;
const { pool } = await import("../../api/src/db/index.ts");
const { hash, encrypt } = await import("../../api/src/auth/secrets.ts");
const users = [],
  identities = [],
  children = [];
let browser;
let logs = "";
function start(file, env) {
  const child = spawn(process.execPath, [file], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  children.push(child);
  return child;
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    if (children.some((child) => child.exitCode !== null))
      throw new Error(`Test server exited.\n${logs}`);
    await delay(100);
  }
  throw new Error(`Test server did not start.\n${logs}`);
}
async function account() {
  const id = randomUUID(),
    identity = randomUUID(),
    token = randomUUID();
  const handle = `browser_${id.replaceAll("-", "").slice(0, 16)}`;
  await pool.query(
    "INSERT INTO users(id,handle,display_name) VALUES ($1,$2,'Browser tester')",
    [id, handle],
  );
  users.push(id);
  await pool.query(
    "INSERT INTO auth_identities(id,issuer,subject,user_id) VALUES ($1::uuid,'browser-tests',$1::text,$2)",
    [identity, id],
  );
  identities.push(identity);
  await pool.query(
    "INSERT INTO auth_sessions(token_hash,identity_id,encrypted_tokens,refresh_after,expires_at) VALUES ($1,$2,$3,now()+interval '1 day',now()+interval '2 days')",
    [
      hash(token),
      identity,
      encrypt({
        access_token: "test",
        refresh_token: "test",
        token_type: "Bearer",
        expires_in: 86400,
      }),
    ],
  );
  return { id, token, handle };
}
try {
  const existing = await pool.query(
    "SELECT EXISTS (SELECT 1 FROM posts) AS present",
  );
  if (existing.rows[0].present)
    throw new Error(
      "Browser checks require an empty, migrated disposable database. Set DATABASE_URL before running check:posts.",
    );
  const alice = await account(),
    bob = await account();
  for (let i = 0; i < 45; i++) {
    await pool.query(
      "INSERT INTO posts(author_id,content,created_at) VALUES ($1,$2,now()-interval '1 hour'-$3*interval '1 second')",
      [bob.id, `Browser feed fixture ${i}\nA simple text post.`, i],
    );
  }
  start(new URL("../../api/src/app.ts", import.meta.url).pathname, {
    PORT: "3310",
  });
  start(new URL("../.output/server/index.mjs", import.meta.url).pathname, {
    PORT: "3300",
    HOST: "127.0.0.1",
    API_URL: "http://127.0.0.1:3310",
  });
  await Promise.all([ready("http://127.0.0.1:3310/"), ready(origin)]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addCookies([
    { name: "session", value: alice.token, url: origin },
  ]);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let failRead = true,
    failPublish = true;
  await page.route("**/api/posts**", async (route) => {
    const request = route.request();
    if (
      (request.method() === "GET" && failRead) ||
      (request.method() === "POST" && failPublish)
    ) {
      if (request.method() === "GET") failRead = false;
      else failPublish = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"backend_unavailable"}',
      });
    } else await route.continue();
  });
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Retry loading posts" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry loading posts" }).click();
  await expect(page.locator("[data-post]")).toHaveCount(20);
  await expect(
    page
      .locator("[data-post]")
      .first()
      .locator(`[href="/profile/${bob.handle}"]`),
  ).toBeVisible();
  const firstPost = page.locator("[data-post]").first();
  for (const name of [
    "Like post",
    "Reply to post",
    "Repost",
    "Share post",
    "Post options",
  ]) {
    await expect(
      firstPost.getByRole("button", { name, exact: true }),
    ).toBeVisible();
    await firstPost.getByRole("button", { name, exact: true }).click();
    await expect(page).toHaveURL(origin + "/");
  }
  await expect(
    firstPost.getByRole("button", { name: "Like post", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const likeButton = firstPost.getByRole("button", {
    name: "Like post",
    exact: true,
  });
  await expect(likeButton).toBeEnabled();
  await page.reload();
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await firstPost.locator(`[href="/profile/${bob.handle}"]`).click();
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await firstPost
    .getByRole("link", { name: `View post by @${bob.handle}` })
    .click();
  await expect(page.locator("[data-post]")).toHaveCount(1);
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await page.goto(origin);
  await expect(page.locator("[data-post]")).toHaveCount(20);
  await likeButton.click();
  await expect(likeButton).toBeEnabled();
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await page.route(
    "**/api/posts/*/like",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"backend_unavailable"}',
      }),
    { times: 1 },
  );
  await likeButton.click();
  await expect(likeButton).toBeEnabled();
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(firstPost.getByRole("alert")).toContainText("Please retry");
  await likeButton.click();
  await expect(likeButton).toBeEnabled();
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await likeButton.click();
  await expect(likeButton).toBeEnabled();

  const design = await firstPost.evaluate((el) => ({
    paddingTop: getComputedStyle(el).paddingTop,
    paddingBottom: getComputedStyle(el).paddingBottom,
    textBottomMargin: getComputedStyle(el.querySelector("p")).marginBottom,
    actionGap: getComputedStyle(
      el.querySelector('[aria-label="Like post"]').parentElement,
    ).columnGap,
  }));
  assert.deepEqual(design, {
    paddingTop: "30px",
    paddingBottom: "29px",
    textBottomMargin: "24px",
    actionGap: "27px",
  });
  await page.locator("main").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator("[data-post]")).toHaveCount(40);
  await page.locator("main").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(
    page.getByText("You're all caught up.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-post]")).toHaveCount(45);
  assert.equal(
    await page
      .locator("[data-post]")
      .evaluateAll((els) => new Set(els.map((el) => el.textContent)).size),
    45,
  );
  await page.getByRole("button", { name: "New Post", exact: true }).click();
  await expect(page.getByRole("toolbar", { name: "Post types" })).toBeVisible();
  for (const name of [
    "Add images",
    "Add GIF",
    "Add video",
    "Add voice",
    "Live post",
    "Stream post",
    "Schedule post",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(
    page.getByRole("button", { name: "Post", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "/tmp/ysocial-restored-composer-desktop.png" });

  await page
    .getByRole("textbox", { name: "Write a post" })
    .fill("Browser published\n<script>window.untrusted = true</script>");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please retry");
  await expect(page.getByRole("textbox", { name: "Write a post" })).toHaveValue(
    "Browser published\n<script>window.untrusted = true</script>",
  );
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.locator("[data-post]").first()).toContainText(
    "Browser published",
  );
  await expect(
    page
      .locator("[data-post]")
      .first()
      .locator(`[href="/profile/${alice.handle}"]`),
  ).toBeVisible();
  assert.equal(await page.evaluate(() => window.untrusted), undefined);
  await page.reload();
  await expect(page.locator("[data-post]").first()).toContainText(
    "Browser published",
  );
  const postUrl = await page
    .locator("[data-post]")
    .first()
    .getByRole("link", { name: `View post by @${alice.handle}` })
    .getAttribute("href");
  assert.match(postUrl, /^\/post\/[a-f0-9-]+$/);
  await page.locator("[data-post]").first().locator("p").first().click();
  await expect(page).toHaveURL(origin + postUrl);
  await expect(page.locator("[data-post]")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("[data-post]").first()).toContainText(
    "Browser published",
  );
  await page.getByRole("link", { name: "Back to feed" }).click();
  const permalink = page
    .locator("[data-post]")
    .first()
    .getByRole("link", { name: `View post by @${alice.handle}` });
  await permalink.focus();
  await permalink.press("Enter");
  await expect(page).toHaveURL(origin + postUrl);
  await expect(page.locator("[data-post]")).toHaveCount(1);
  let ownPost = page.locator("[data-post]").first();
  await ownPost.getByRole("button", { name: "Post options" }).click();
  await ownPost.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(ownPost.getByText(/Editing closes in/)).toBeVisible();
  await ownPost
    .getByRole("textbox", { name: "Edit post" })
    .fill("Browser edited");
  await ownPost.getByRole("button", { name: "Save", exact: true }).click();
  await expect(ownPost.getByText("Edited", { exact: true })).toBeVisible();
  const saved = await pool.query(
    "SELECT id,content FROM posts WHERE author_id=$1",
    [alice.id],
  );
  assert.equal(saved.rows[0].content, "Browser edited");
  await pool.query(
    "UPDATE posts SET created_at=clock_timestamp()-interval '15 minutes'+interval '5 seconds' WHERE id=$1",
    [saved.rows[0].id],
  );
  await page.reload();
  ownPost = page.locator("[data-post]").first();
  await ownPost.getByRole("button", { name: "Post options" }).click();
  await ownPost.getByRole("button", { name: "Edit", exact: true }).click();
  await ownPost
    .getByRole("textbox", { name: "Edit post" })
    .fill("Keep this expired draft");
  await expect(
    ownPost.getByText("The 15-minute editing window has closed."),
  ).toBeVisible({ timeout: 8000 });
  await expect(
    ownPost.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await expect(ownPost.getByRole("textbox", { name: "Edit post" })).toHaveValue(
    "Keep this expired draft",
  );
  await ownPost.getByRole("button", { name: "Cancel", exact: true }).click();
  await ownPost.getByRole("button", { name: "Post options" }).click();
  await expect(
    ownPost.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept());
  await ownPost.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Browser edited", { exact: true })).toHaveCount(
    0,
  );
  assert.equal(
    (await pool.query("SELECT id FROM posts WHERE id=$1", [saved.rows[0].id]))
      .rowCount,
    0,
  );
  await expect(page.getByText("Post deleted.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Post not found" }),
  ).toBeVisible();
  await page.goto(origin + "/post/invalid");
  await expect(
    page.getByRole("heading", { name: "Post not found" }),
  ).toBeVisible();
  await page.route(
    `**/api/posts/${saved.rows[0].id}`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"backend_unavailable"}',
      }),
    { times: 1 },
  );
  await page.goto(origin + postUrl);
  await page
    .getByRole("button", { name: "Retry loading post", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Post not found" }),
  ).toBeVisible();
  await page.goto(origin);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("[data-post]")).toHaveCount(20);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("main").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator("[data-post]")).toHaveCount(40);
  await page.screenshot({ path: "/tmp/ysocial-posts-mobile.png" });
  await page.getByRole("button", { name: "New Post", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Write a post" })
    .fill("x".repeat(2000));
  await expect(
    page.getByRole("button", { name: "Post", exact: true }),
  ).toBeEnabled();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "/tmp/ysocial-restored-composer-mobile.png" });

  // A tall viewport must load additional pages without another scroll event.
  await page.setViewportSize({ width: 1400, height: 6000 });
  await page.reload();
  await expect
    .poll(() => page.locator("[data-post]").count())
    .toBeGreaterThan(20);
  const anonymous = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const publicPage = await anonymous.newPage();
  await publicPage.goto(origin);
  await expect(publicPage.locator("[data-post]")).toHaveCount(20);
  await publicPage
    .getByRole("button", { name: "Open composer", exact: true })
    .click();
  await expect(
    publicPage.getByRole("link", { name: "Sign in with CNS to post" }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("button", { name: "Post options" }),
  ).toHaveCount(20);
  let anonymousWrites = 0;
  publicPage.on("request", (request) => {
    if (
      new URL(request.url()).pathname.includes("/like") &&
      request.method() !== "GET"
    )
      anonymousWrites++;
  });
  const publicPost = publicPage.locator("[data-post]").first();
  for (const name of [
    "Like post",
    "Reply to post",
    "Repost",
    "Share post",
    "Post options",
  ]) {
    const button = publicPost.getByRole("button", { name, exact: true });
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await button.click({ force: true });
    const popup = publicPost.getByRole("dialog", { name: "Login required" });
    await expect(popup).toContainText("Log in to interact with this post.");
    await expect(
      popup.getByRole("link", { name: "Log in with CNS" }),
    ).toHaveAttribute("href", "/auth/login");
    await popup
      .getByText("Log in to interact with this post.", { exact: true })
      .click();
    await expect(publicPage).toHaveURL(origin + "/");
    await expect(popup).toBeVisible();
    await publicPage.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(button).toBeFocused();
  }
  await publicPost
    .getByRole("button", { name: "Like post", exact: true })
    .click({ force: true });
  await publicPage.screenshot({ path: "/tmp/ysocial-login-popup-desktop.png" });
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await expect(
    publicPost.getByRole("dialog", { name: "Login required" }),
  ).toBeVisible();
  assert.equal(
    await publicPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await publicPage.screenshot({ path: "/tmp/ysocial-login-popup-mobile.png" });
  await publicPost.getByRole("button", { name: "Close login popup" }).click();
  assert.equal(anonymousWrites, 0);
  await expect(
    publicPost.getByRole("button", { name: "Like post", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    publicPage.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  const publicLink = publicPage
    .locator("[data-post]")
    .first()
    .getByRole("link", { name: `View post by @${bob.handle}` });
  await publicLink.click();
  await expect(publicPage.locator("[data-post]")).toHaveCount(1);
  await publicPage.reload();
  await expect(publicPage.locator("[data-post]")).toHaveCount(1);
  // Public author links and direct profile URLs show only that author's recent posts.
  await publicPage.locator(`[href="/profile/${bob.handle}"]`).first().click();
  await expect(publicPage).toHaveURL(`${origin}/profile/${bob.handle}`);
  await expect(
    publicPage.getByRole("heading", { name: "Browser tester", exact: true }),
  ).toBeVisible();
  await expect(publicPage.locator("[data-post]")).toHaveCount(20);
  await publicPage.reload();
  await expect(publicPage.locator("[data-post]")).toHaveCount(20);
  await page.goto(`${origin}/profile/${alice.handle}`);
  await expect(page.getByText("No posts yet.", { exact: true })).toBeVisible();
  await page.goto(`${origin}/profile/does_not_exist`);
  await expect(
    page.getByRole("heading", { name: "Profile not found" }),
  ).toBeVisible();
  await page.route(
    `**/api/profiles/${bob.handle}`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"backend_unavailable"}',
      }),
    { times: 1 },
  );
  await page.goto(`${origin}/profile/${bob.handle}`);
  await page.getByRole("button", { name: "Retry loading profile" }).click();
  await expect(page.locator("[data-post]")).toHaveCount(20);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Browser tester", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "/tmp/ysocial-profile-mobile.png" });
  // A session can expire after the UI has loaded; the server still rejects the like.
  await page.goto(origin);
  await expect(page.locator("[data-post]")).toHaveCount(20);
  const expiredLike = page
    .locator("[data-post]")
    .first()
    .getByRole("button", { name: "Like post", exact: true });
  await expect(expiredLike).toHaveAttribute("aria-disabled", "false");
  await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
    hash(alice.token),
  ]);
  await expiredLike.click();
  await expect(
    page.getByRole("dialog", { name: "Login required" }),
  ).toContainText("Log in to interact with this post.");
  await expect(expiredLike).toHaveAttribute("aria-pressed", "false");
  assert.deepEqual(pageErrors, []);
  console.log(
    "Posts browser checks passed: real proxy/API/database, pagination, retry, plain text, persistence, editing, countdown expiry, deletion, mobile, short-page loading, public browsing, and standalone post URLs, public profiles, and the original post/composer controls, persistent likes, and login prompts.",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  await browser?.close();
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) =>
          child.exitCode !== null ? resolve() : child.once("exit", resolve),
        ),
    ),
  );
  await pool.query("DELETE FROM auth_identities WHERE id=ANY($1::uuid[])", [
    identities,
  ]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [users]);
  await pool.end();
}
