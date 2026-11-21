import { expect, test, type Page } from "@playwright/test";
import type { EncryptedMessage, Registration } from "../src/features/dms/dm-crypto";

const sender = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "sender",
  displayName: "Sender",
  avatarUrl: null,
  bannerUrl: null,
  bannerCrop: null,
};
const recipient = {
  ...sender,
  id: "22222222-2222-4222-8222-222222222222",
  handle: "recipient",
  displayName: "Recipient",
};
const profile = {
  ...sender,
  id: "33333333-3333-4333-8333-333333333333",
  handle: "shared_profile",
  displayName: "Shared profile",
  avatarUrl: "/api/test-avatar",
  bio: "A bio from the shared profile.",
  createdAt: new Date().toISOString(),
  followerCount: 4,
  followingCount: 5,
  postCount: 6,
};
const profilePath = `/@${profile.handle}`;
const conversationId = "44444444-4444-4444-8444-444444444444";

function rootDevice(registration: Registration) {
  return {
    ...registration,
    root: true,
    approvedBy: null,
    approval: null,
    revokedAt: null,
    revokedBy: null,
    revocation: null,
    label: "Test browser",
    createdAt: profile.createdAt,
  };
}

async function setupBrowser(page: Page, user: typeof sender) {
  await page.route("**/auth/me", (route) => route.fulfill({
    json: { authenticated: true, needsOnboarding: false, user, avatarUrl: null, suggestedHandle: user.handle },
  }));
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.routeWebSocket("**/api/dms/live", (socket) => {
    socket.send(JSON.stringify({ type: "ready" }));
  });
  await page.goto("/report");
  return page.evaluate(async ({ modulePath, userId }) => {
    const { createLocalDevice }: typeof import("../src/features/dms/dm-storage") = await import(modulePath);
    const { id, encryptionKey, signingKey, proof } = await createLocalDevice(userId);
    return { id, userId, encryptionKey, signingKey, proof };
  }, { modulePath: "/src/features/dms/dm-storage.ts", userId: user.id });
}

test("sharing a profile delivers a clickable profile card to the recipient", async ({ page, browser }) => {
  const recipientContext = await browser.newContext();
  try {
    const recipientPage = await recipientContext.newPage();
    const [sendingDevice, receivingDevice] = (await Promise.all([
      setupBrowser(page, sender),
      setupBrowser(recipientPage, recipient),
    ])).map(rootDevice);
    const invite = { inviteStatus: "accepted", invitedBy: null };
    let sent: EncryptedMessage | undefined;

    for (const [client, device, peer] of [
      [page, sendingDevice, recipient],
      [recipientPage, receivingDevice, sender],
    ] as const) {
      await client.route("**/api/dms/devices", (route) => route.fulfill({ json: { devices: [device] } }));
      await client.route("**/api/dms/preferences", (route) => route.fulfill({ json: { enabled: true } }));
      await client.route("**/api/dms/unread", (route) => route.fulfill({ json: { unread: 0, requests: 0 } }));
      await client.route("**/api/dms/conversations?*", (route) => route.fulfill({
        json: { conversations: [{ ...invite, id: conversationId, peer, lastMessageAt: null }] },
      }));
      await client.route(`**/api/dms/conversations/${conversationId}?*`, (route) => route.fulfill({
        json: { ...invite, members: [sender, recipient], devices: [sendingDevice, receivingDevice] },
      }));
      await client.route(`**/api/profiles/${profile.handle}`, (route) => route.fulfill({
        json: { profile, isFollowing: false, isFollowedBy: false, posts: [], replies: [], reposts: [], serverNow: profile.createdAt },
      }));
    }

    await page.route("**/api/dms/conversations", (route) => route.fulfill({
      json: { id: conversationId, peerId: recipient.id },
    }));
    await page.route(`**/api/dms/conversations/${conversationId}/messages`, (route) => {
      sent = route.request().postDataJSON();
      return route.fulfill({ status: 204 });
    });
    await recipientPage.route(`**/api/dms/conversations/${conversationId}/messages?*`, (route) => {
      const message = sent && {
        ...sent,
        senderId: sender.id,
        envelope: sent.envelopes[receivingDevice.id],
        sequence: "1",
        createdAt: profile.createdAt,
      };
      const latest = !new URL(route.request().url()).searchParams.has("after");
      return route.fulfill({ json: { messages: latest && message ? [message] : [], more: false } });
    });
    await recipientPage.route(`**/api/dms/conversations/${conversationId}/read`, (route) => route.fulfill({ status: 204 }));
    await recipientPage.route(`**/api/profiles/${profile.handle}/card`, (route) => route.fulfill({
      json: { profile, isFollowing: false, isFollowedBy: false, isSelf: false, signedIn: true },
    }));
    await recipientPage.route("**/api/test-avatar", (route) => route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
    }));

    await page.goto("/messages");
    await expect(page.getByRole("link", { name: /Recipient/ })).toBeVisible();
    await page.goto(profilePath);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const shareMenu = page.getByRole("dialog", { name: "Share profile" });
    await shareMenu.getByRole("button", { name: recipient.displayName }).click();
    await shareMenu.getByRole("button", { name: `Send to ${recipient.displayName}` }).click();
    await expect(shareMenu).toBeHidden();

    await recipientPage.goto(`/messages/${conversationId}`);
    const message = recipientPage.locator("[data-message-id]");
    const card = message.getByRole("link", { name: /Shared profile @shared_profile/ });
    await expect(card).toHaveAttribute("href", profilePath);
    await expect(card.getByText(profile.bio)).toBeVisible();
    await expect(card.locator("img")).toBeVisible();
    await expect(message.getByText(new URL(profilePath, page.url()).href, { exact: true })).toHaveCount(0);
    await card.click();
    await expect(recipientPage.getByRole("heading", { name: profile.displayName })).toBeVisible();
  } finally {
    await recipientContext.close();
  }
});
