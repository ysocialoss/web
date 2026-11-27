import { expect, test } from "@playwright/test";

for (const reply of [false, true]) {
  test(`a saved ${reply ? "reply" : "post"} stops looking pending before the send response`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.EventSource = class extends EventTarget {
        constructor() {
          super();
          window.addEventListener("test-new-post", (event) => {
            if (event instanceof CustomEvent) {
              this.dispatchEvent(
                new MessageEvent("post", {
                  data: JSON.stringify(event.detail),
                }),
              );
            }
          });
        }
        close() {}
      } as unknown as typeof EventSource;
    });

    const author = {
      id: "88888888-8888-4888-8888-888888888888",
      handle: "feed_tester",
      displayName: "Feed tester",
      avatarUrl: null,
    };
    const parent = {
      id: "00000000-0000-4000-8000-000000000001",
      content: "Parent post",
      author,
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
    const content = "Already saved by the server";
    let saved:
      | (Omit<typeof parent, "parentId"> & { parentId: string | null })
      | undefined;
    const sendResponse = Promise.withResolvers<void>();

    await page.route("**/auth/me", (route) =>
      route.fulfill({
        json: {
          authenticated: true,
          needsOnboarding: false,
          user: { ...author, bannerUrl: null, bannerCrop: null },
          avatarUrl: null,
          suggestedHandle: author.handle,
        },
      }),
    );
    await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
    await page.route(/\/api\/(posts|feed\/for-you)$/, async (route) => {
      if (route.request().method() === "POST") {
        saved = {
          ...parent,
          id: route.request().postDataJSON().clientId,
          content,
        };
        await sendResponse.promise;
        return route.fulfill({
          json: { post: saved, serverNow: new Date().toISOString() },
        });
      }
      return route.fulfill({
        json: {
          posts: saved ? [saved] : [],
          nextCursor: null,
          serverNow: new Date().toISOString(),
        },
      });
    });
    await page.route(/\/api\/posts\/[0-9a-f-]{36}$/, (route) =>
      saved && route.request().url().endsWith(saved.id)
        ? route.fulfill({ json: { post: saved, serverNow: new Date().toISOString() } })
        : route.fulfill({ status: 404, json: { error: "post_not_found" } }),
    );
    await page.route(`**/api/posts/${parent.id}/thread`, (route) =>
      route.fulfill({
        json: {
          post: parent,
          ancestors: [],
          replies: saved ? [saved] : [],
          truncated: false,
          serverNow: new Date().toISOString(),
        },
      }),
    );
    await page.route(`**/api/posts/${parent.id}/replies`, async (route) => {
      saved = {
        ...parent,
        id: route.request().postDataJSON().clientId,
        content,
        parentId: parent.id,
      };
      await sendResponse.promise;
      return route.fulfill({
        json: { post: saved, serverNow: new Date().toISOString() },
      });
    });

    try {
      await page.goto(reply ? `/posts/${parent.id}` : "/");
      await page
        .getByRole("textbox", {
          name: reply ? "Write a reply" : "What's on your mind?",
        })
        .fill(content);
      await page.getByRole("button", { name: "Publish post" }).click();
      const card = page.locator("article").filter({ hasText: content });
      const profile = card.getByLabel("View Feed tester's profile");
      await expect(card.getByText("Sending post…")).toBeAttached();
      await expect.poll(() => saved?.id).toBeDefined();
      await page.evaluate(
        (post) => {
          window.dispatchEvent(
            new CustomEvent("test-new-post", { detail: post }),
          );
        },
        {
          id: saved?.id,
          parentId: reply ? parent.id : null,
          authorId: author.id,
          topics: [],
        },
      );
      await expect(card.getByText("Sending post…")).toHaveCount(0);
      await expect(profile).toHaveCSS("opacity", "1");
      await expect(card).toHaveCSS("opacity", "1");
    } finally {
      sendResponse.resolve();
    }
  });
}
