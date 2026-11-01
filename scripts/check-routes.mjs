// Run after the production build. Uses the actual SSR renderer without opening a port.
import assert from "node:assert/strict";
import render from "../.output/server/_chunks/ssr-renderer.mjs";

const cases = [
  { path: "/", active: "/", posts: 0, composer: true },
  { path: "/dms", active: "/dms", posts: 0, composer: false },
  { path: "/search", active: "/search", posts: 0, composer: false },
  { path: "/search?q=%20%20", active: "/search", posts: 0, composer: false },
  { path: "/search?q=cns", active: "/search", posts: 0, composer: false },
  {
    path: "/search?q=no-such-post",
    active: "/search",
    posts: 0,
    composer: false,
  },
  { path: "/tweak-feed", active: "/tweak-feed", posts: 0, composer: false },
  { path: "/communities", active: "/communities", posts: 0, composer: false },
  ...["about", "support", "terms", "privacy", "imprint"].map((page) => ({
    path: `/legal/${page}`,
    active: null,
    posts: 0,
    composer: false,
  })),
];

for (const test of cases) {
  const response = await render({
    req: new Request(`http://localhost${test.path}`),
  });
  assert.equal(response.status, 200, test.path);
  const html = await response.text();
  assert.equal(
    html.includes('id="profile"'),
    false,
    `${test.path}: profile visibility`,
  );
  assert.equal(
    html.includes("Trending Topics"),
    false,
    `${test.path}: trending visibility`,
  );
  if (test.active !== null)
    for (const page of ["about", "support", "terms", "privacy", "imprint"]) {
      assert.ok(
        html.includes(`href="/legal/${page}"`),
        `${test.path}: legal link ${page}`,
      );
    }
  const main = html.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? "";
  if (test.active !== "/" && test.active !== "/dms")
    assert.match(
      main,
      /^<main\b[^>]*>\s*(?:<!--.*?-->\s*)*<\/main>$/,
      `${test.path}: empty placeholder`,
    );
  if (test.active === "/dms") {
    assert.ok(main.includes("Search conversations"), "DM search is rendered");
    assert.ok(
      main.includes("New message"),
      "Empty inbox offers a new message action",
    );
    assert.ok(
      !main.includes("Select a conversation to start messaging."),
      "Empty thread has no placeholder message",
    );
    assert.ok(
      !main.includes('aria-label="Send message"'),
      "Composer requires a selected conversation",
    );
  }
  const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal(
    (main.match(/class="post"/g) ?? []).length,
    test.posts,
    `${test.path}: post count`,
  );
  assert.equal(
    main.includes("What's on your mind?"),
    test.composer,
    `${test.path}: composer visibility`,
  );
  if (test.composer) {
    assert.match(
      main,
      /class="composer-reveal" inert/,
      "Collapsed editor is inert",
    );
    assert.match(main, /aria-expanded="false"/, "Composer starts collapsed");
    assert.match(main, /<textarea[^>]*>/, "Composer has a real text input");
    assert.equal(
      (main.match(/type="file"/g) ?? []).length,
      1,
      "A typed media picker exists",
    );
    assert.match(
      main,
      /<button[^>]*type="submit"[^>]*disabled/,
      "Empty drafts cannot be posted",
    );
  }
  if (test.active === null) {
    assert.ok(
      !html.includes("left-sidebar") && !html.includes("right-sidebar"),
      `${test.path}: simplified layout`,
    );
    assert.equal(
      (nav.match(/<a\b/g) ?? []).length,
      1,
      `${test.path}: logo-only navigation`,
    );
    assert.ok(nav.includes('src="/logo.png"'), `${test.path}: logo asset`);
    assert.ok(!html.includes("New Post"), `${test.path}: no composer`);
  }
  const selected = [
    ...nav.matchAll(/<a\b[^>]*class="nav-link selected"[^>]*>/g),
  ];
  assert.equal(
    selected.length,
    test.active === null ? 0 : 1,
    `${test.path}: active navigation count`,
  );
  if (test.active !== null)
    assert.ok(
      selected[0][0].includes(`href="${test.active}"`),
      `${test.path}: active navigation target`,
    );
}
for (const path of ["/missing", "/some/missing/page", "/legal/missing"]) {
  const response = await render({
    req: new Request(`http://localhost${path}`),
  });
  assert.equal(response.status, 404, path);
  const html = await response.text();
  assert.ok(html.includes(">404</h1>"), `${path}: 404 message`);
  assert.ok(
    !html.includes("left-sidebar") && !html.includes("right-sidebar"),
    `${path}: standalone layout`,
  );
  assert.ok(!html.includes("New Post"), `${path}: no composer`);
  const nav = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal(
    (nav.match(/<a\b/g) ?? []).length,
    1,
    `${path}: logo-only navigation`,
  );
  assert.ok(nav.includes('src="/logo.png"'), `${path}: logo asset`);
}
console.log(
  "Route checks passed, including empty placeholders and standalone 404 pages with logo-only navigation.",
);
