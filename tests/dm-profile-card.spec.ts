import { expect, test, type Page } from "@playwright/test";
import type { WireMessage } from "../src/features/dms/dm-api";
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
    await page.getByRole("button", { name: "Profile options" }).click();
    await page.getByRole("menuitem", { name: "Share profile" }).click();
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

test("the thread stays responsive through sending, navigation, reconnect and incoming messages", async ({ page, browser }) => {
  await page.setViewportSize({ width: 412, height: 860 });
  const otherPage = await browser.newPage();
  try {
    const [self, peer] = (await Promise.all([setupBrowser(page, sender), setupBrowser(otherPage, recipient)])).map(rootDevice);
    const invite = { inviteStatus: "accepted", invitedBy: null };
    const threadPath = `/api/dms/conversations/${conversationId}`;
    const contextStarted = Promise.withResolvers<void>();
    const historyStarted = Promise.withResolvers<void>();
    const releaseContext = Promise.withResolvers<void>();
    const releaseFailure = Promise.withResolvers<void>();
    const releaseRetry = Promise.withResolvers<void>();
    const releaseOlder = Promise.withResolvers<void>();
    const attempts: EncryptedMessage[] = [];
    let incoming: WireMessage[] = [];
    let sent: EncryptedMessage | undefined;
    let historyRequests = 0;
    let failHistory = false;
    let connection: import("@playwright/test").WebSocketRoute | undefined;
    await page.routeWebSocket("**/api/dms/live", (socket) => {
      connection = socket;
      socket.send(JSON.stringify({ type: "ready" }));
    });
    await page.route("**/api/dms/devices", (route) => route.fulfill({ json: { devices: [self] } }));
    await page.route("**/api/dms/preferences", (route) => route.fulfill({ json: { enabled: true } }));
    await page.route("**/api/dms/unread", (route) => route.fulfill({ json: { unread: 0, requests: 0 } }));
    await page.route("**/api/dms/conversations?*", (route) => route.fulfill({
      json: { conversations: [{ ...invite, id: conversationId, peer: recipient, lastMessageAt: null }] },
    }));
    await page.route(`**${threadPath}?*`, async (route) => {
      contextStarted.resolve();
      await releaseContext.promise;
      await route.fulfill({ json: { ...invite, members: [sender, recipient], devices: [self, peer] } });
    });
    await page.route(`**${threadPath}/messages?*`, async (route) => {
      historyRequests++;
      historyStarted.resolve();
      if (failHistory) return route.fulfill({ status: 503, json: { error: "network_unavailable" } });
      const query = new URL(route.request().url()).searchParams;
      const after = query.get("after");
      const before = query.get("before");
      const outgoing = sent && {
        ...sent, senderId: sender.id, envelope: sent.envelopes[self.id], sequence: "1", createdAt: profile.createdAt,
      };
      const messages = outgoing ? [outgoing, ...incoming] : incoming;
      const filtered = after ? messages.filter(({ sequence }) => BigInt(sequence) > BigInt(after))
        : before ? messages.filter(({ sequence }) => BigInt(sequence) < BigInt(before)) : messages;
      if (before) await releaseOlder.promise;
      return route.fulfill({ json: { messages: after ? filtered.slice(0, 40) : filtered.slice(-40), more: filtered.length > 40 } });
    });
    await page.route(`**${threadPath}/read`, (route) => route.fulfill({ status: 204 }));
    await page.route(`**${threadPath}/messages`, async (route) => {
      const attempt: EncryptedMessage = route.request().postDataJSON();
      attempts.push(attempt);
      if (attempts.length === 1) {
        await releaseFailure.promise;
        return route.fulfill({ status: 503, json: { error: "network_unavailable" } });
      }
      await releaseRetry.promise;
      sent = attempt;
      return route.fulfill({ status: 204 });
    });
    const conversationLink = page.locator(`a[href="/messages/${conversationId}"]`);

    await page.goto(`/messages/${conversationId}`);
    await Promise.all([contextStarted.promise, historyStarted.promise]);
    releaseContext.resolve();
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await composer.fill("First draft");
    await composer.press("Enter");
    const row = page.locator("[data-message-id]").filter({ hasText: "First draft" });
    await expect(row).toHaveAttribute("data-delivery", "sending");
    await expect(row.locator("[data-message-body] > div")).toHaveCSS("opacity", "0.65");
    await expect(composer).toBeEditable();
    await composer.fill("I can type the next message");
    await page.getByRole("link", { name: "Back to conversations" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    releaseFailure.resolve();
    await conversationLink.click();
    await expect(composer).toHaveValue("I can type the next message");
    await row.getByRole("button", { name: "Retry" }).click();
    await expect(row).toHaveAttribute("data-delivery", "sending");
    const pendingPosition = await row.boundingBox();
    releaseRetry.resolve();
    await expect(row.getByRole("button", { name: "Edit" })).toBeAttached();
    const confirmedPosition = await row.boundingBox();
    expect(confirmedPosition?.height).toBe(pendingPosition?.height);
    expect(confirmedPosition?.y).toBe(pendingPosition?.y);
    await expect(row).toHaveCount(1);
    await expect(composer).toHaveValue("I can type the next message");
    expect(attempts).toHaveLength(2);
    expect(attempts[0].id).toBe(attempts[1].id);
    expect(JSON.stringify(attempts)).not.toContain("First draft");

    const count = historyRequests;
    const inboxRefresh = page.waitForRequest("**/api/dms/conversations?*");
    connection?.send(JSON.stringify({ type: "conversation", id: conversationId, roster: false, read: true }));
    await inboxRefresh;
    expect(historyRequests).toBe(count);

    sent = undefined;
    connection?.send(JSON.stringify({ type: "ready" }));
    await expect(row).toHaveCount(0);

    const received = await otherPage.evaluate(async ({ storagePath, cryptoPath, conversationId, self, peer, createdAt }) => {
      const { readLocalDevice }: typeof import("../src/features/dms/dm-storage") = await import(storagePath);
      const { encryptMessage }: typeof import("../src/features/dms/dm-crypto") = await import(cryptoPath);
      const device = await readLocalDevice(peer.userId);
      if (!device) throw new Error("Peer device missing");
      return Promise.all(Array.from({ length: 44 }, async (_, index): Promise<WireMessage> => {
        const body = await encryptMessage(conversationId, crypto.randomUUID(), device, [self], `Received message ${index + 1}`);
        return {
          ...body, senderId: peer.userId, envelope: body.envelopes[self.id], sequence: String(index + 2),
          createdAt, editedAt: null, reactions: [], votes: [],
        };
      }));
    }, {
      storagePath: "/src/features/dms/dm-storage.ts", cryptoPath: "/src/features/dms/dm-crypto.ts",
      conversationId, self, peer, createdAt: profile.createdAt,
    });
    incoming = received.slice(0, 35);
    const newMessage = JSON.stringify({ type: "conversation", id: conversationId, roster: false });
    connection?.send(newMessage);
    await expect(page.getByText("Received message 35", { exact: true })).toBeInViewport();
    const history = page.getByLabel("Message history");
    await history.evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    incoming = received.slice(0, 36);
    connection?.send(newMessage);
    const jump = page.getByRole("button", { name: "1 new message", exact: true });
    await expect(jump).toBeVisible();
    await expect(page.getByText("Received message 1", { exact: true })).toBeInViewport();
    await jump.click();
    await expect(page.getByText("Received message 36", { exact: true })).toBeInViewport();
    await expect(jump).toHaveCount(0);

    incoming = received;
    await page.getByRole("link", { name: "Back to conversations" }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await conversationLink.click();
    await expect(page.getByText("Received message 44", { exact: true })).toBeInViewport();
    const olderRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.has("before"));
    await history.evaluate((element) => { element.scrollTop = 0; });
    await olderRequest;
    const earlier = page.getByRole("status").filter({ hasText: "Fetching earlier messages" });
    const placeholders = history.locator("[data-older-placeholder]");
    await expect(placeholders.locator('[data-slot="skeleton"]').first()).toBeInViewport();
    await expect(page.getByRole("button", { name: "Load earlier messages" })).toHaveCount(0);
    await expect(page.getByText("Loading earlier messages…")).toHaveCount(0);
    const firstLoaded = page.getByText("Received message 5", { exact: true });
    const position = await firstLoaded.boundingBox();
    const fade = page.waitForFunction((id) => {
      const row = document.querySelector(`[data-virtual-message="${CSS.escape(id)}"]`);
      return row?.getAnimations().some((animation) => animation.playState === "running");
    }, received[3].id);
    releaseOlder.resolve();
    await fade;
    await expect(page.getByText("Received message 1", { exact: true })).toBeAttached();
    await expect(earlier).toHaveCount(0);
    await expect(placeholders).toHaveCount(0);
    const afterPrepend = await firstLoaded.boundingBox();
    expect(Math.abs(afterPrepend!.y - position!.y)).toBeLessThan(2);

    failHistory = true;
    await page.getByRole("button", { name: "Search this conversation" }).click();
    await page.getByRole("searchbox", { name: "Search this conversation" }).fill("Received message 2");
    const searchResults = page.getByRole("region", { name: "Search results" });
    const retrySearch = searchResults.getByRole("button", { name: "Retry search" });
    await expect(retrySearch).toBeVisible();
    failHistory = false;
    await retrySearch.click();
    await expect(searchResults.getByRole("button", { name: /Received message 2$/ })).toBeVisible();

    const gifRequests: Array<{ query: string; page: number }> = [];
    let failNextGifPage = true;
    await page.route("**/api/banners/gifs/search", (route) => {
      const request: { query: string; page: number } = route.request().postDataJSON();
      gifRequests.push(request);
      if (request.page === 2 && failNextGifPage) return route.fulfill({ status: 400, json: { error: "invalid_input" } });
      const names = request.query ? ["Cat result"] : request.page === 1
        ? Array.from({ length: 24 }, (_, index) => `GIF ${index + 1}`)
        : ["GIF 24", "GIF result on page two"];
      const thumbnail = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      return route.fulfill({ json: {
        items: names.map((title) => ({ id: title, title, previewUrl: thumbnail, url: thumbnail, width: 200, height: 160, token: title })),
        hasNext: !request.query && request.page === 1,
      } });
    });
    await page.getByRole("button", { name: "Close search" }).click();
    await page.getByRole("button", { name: "Add to message" }).click();
    await page.getByRole("button", { name: "GIF", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Choose a GIF" });
    const gifs = picker.getByRole("region", { name: "GIF results" });
    const grid = gifs.locator("[data-gif-count]");
    await expect(gifs.getByRole("button", { name: "GIF 1", exact: true })).toBeInViewport();
    await expect(picker.getByRole("button", { name: /^(Next|Previous)$/ })).toHaveCount(0);
    expect(gifRequests.length).toBeGreaterThan(0);
    expect(gifRequests.every(({ page }) => page === 1)).toBe(true);
    await gifs.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const retryGifs = gifs.getByRole("button", { name: "Retry" });
    await expect(retryGifs).toBeVisible();
    await expect(grid).toHaveAttribute("data-gif-count", "24");
    failNextGifPage = false;
    await retryGifs.click();
    await expect(grid).toHaveAttribute("data-gif-count", "25");
    await expect(gifs.getByRole("button", { name: "GIF result on page two" })).toBeAttached();
    expect(gifRequests.filter(({ page }) => page > 1)).toEqual([{ query: "", page: 2 }, { query: "", page: 2 }]);
    await picker.getByRole("searchbox", { name: "Search KLIPY" }).fill("cats");
    await picker.getByRole("button", { name: "Search", exact: true }).click();
    await expect(gifs.getByRole("button", { name: "Cat result" })).toBeInViewport();
    await expect(grid).toHaveAttribute("data-gif-count", "1");
    expect(gifRequests.at(-1)).toEqual({ query: "cats", page: 1 });
  } finally {
    await otherPage.close();
  }
});

test("long conversations mount a window and preserve position when a row above it grows", async ({ page, browser }) => {
  await page.setViewportSize({ width: 412, height: 860 });
  const otherPage = await browser.newPage();
  try {
    const [self, peer] = (await Promise.all([setupBrowser(page, sender), setupBrowser(otherPage, recipient)])).map(rootDevice);
    const threadPath = `/api/dms/conversations/${conversationId}`;
    const invite = { inviteStatus: "accepted", invitedBy: null };
    let connection: import("@playwright/test").WebSocketRoute | undefined;
    await page.routeWebSocket("**/api/dms/live", (socket) => {
      connection = socket;
      socket.send(JSON.stringify({ type: "ready" }));
    });
    await page.route("**/api/dms/devices", (route) => route.fulfill({ json: { devices: [self] } }));
    await page.route("**/api/dms/preferences", (route) => route.fulfill({ json: { enabled: true } }));
    await page.route("**/api/dms/unread", (route) => route.fulfill({ json: { unread: 0, requests: 0 } }));
    await page.route("**/api/dms/conversations?*", (route) => route.fulfill({ json: { conversations: [] } }));
    await page.route(`**${threadPath}?*`, (route) => route.fulfill({ json: { ...invite, members: [sender, recipient], devices: [self, peer] } }));
    const reads = new Set<string>();
    await page.route(`**${threadPath}/read`, (route) => {
      const { messageIds }: { messageIds: string[] } = route.request().postDataJSON();
      messageIds.forEach((id) => reads.add(id));
      return route.fulfill({ status: 204 });
    });

    const { received, attachment, voiceId } = await otherPage.evaluate(async ({ storagePath, cryptoPath, payloadPath, filesPath, conversationId, self, peer, createdAt }) => {
      const { readLocalDevice }: typeof import("../src/features/dms/dm-storage") = await import(storagePath);
      const { encryptMessage }: typeof import("../src/features/dms/dm-crypto") = await import(cryptoPath);
      const { encodePayload }: typeof import("../src/features/dms/message-payload") = await import(payloadPath);
      const { encryptFile }: typeof import("../src/features/dms/dm-files") = await import(filesPath);
      const device = await readLocalDevice(peer.userId);
      if (!device) throw new Error("Peer device missing");
      const seconds = 12;
      const sampleRate = 8_000;
      const bytes = new Uint8Array(44 + seconds * sampleRate * 2);
      const header = new DataView(bytes.buffer);
      const encoder = new TextEncoder();
      bytes.set(encoder.encode("RIFF"));
      header.setUint32(4, bytes.length - 8, true);
      bytes.set(encoder.encode("WAVEfmt "), 8);
      header.setUint32(16, 16, true);
      header.setUint16(20, 1, true);
      header.setUint16(22, 1, true);
      header.setUint32(24, sampleRate, true);
      header.setUint32(28, sampleRate * 2, true);
      header.setUint16(32, 2, true);
      header.setUint16(34, 16, true);
      bytes.set(encoder.encode("data"), 36);
      header.setUint32(40, bytes.length - 44, true);
      const mime = "audio/wav";
      const { data, key, iv } = await encryptFile(new Blob([bytes], { type: mime }));
      const voiceId = crypto.randomUUID();
      const ids = Array.from({ length: 280 }, () => crypto.randomUUID());
      const received = await Promise.all(ids.map(async (id, index): Promise<WireMessage> => {
        const text = `History message ${index + 1}`;
        const payload = encodePayload({
          text,
          reply: index === ids.length - 1 ? ids[99] : undefined,
          voice: index === 99 ? { id: voiceId, key, iv, mime, seconds } : undefined,
        });
        const body = await encryptMessage(conversationId, id, device, [self], payload);
        return {
          ...body, senderId: peer.userId, envelope: body.envelopes[self.id], sequence: String(index + 1),
          createdAt, editedAt: null, reactions: [], votes: [],
        };
      }));
      return { received, attachment: [...data], voiceId };
    }, {
      storagePath: "/src/features/dms/dm-storage.ts", cryptoPath: "/src/features/dms/dm-crypto.ts",
      payloadPath: "/src/features/dms/message-payload.ts", filesPath: "/src/features/dms/dm-files.ts",
      conversationId, self, peer, createdAt: profile.createdAt,
    });
    const releaseVoice = Promise.withResolvers<void>();
    await page.route(`**${threadPath}/attachments/${voiceId}`, async (route) => {
      await releaseVoice.promise;
      return route.fulfill({ contentType: "application/octet-stream", body: Buffer.from(attachment) });
    });
    let visibleToServer = 40;
    await page.route(`**${threadPath}/messages?*`, (route) => {
      const params = new URL(route.request().url()).searchParams;
      const after = params.get("after");
      const before = params.get("before");
      const first = after ? Number(after) : 0;
      const last = before ? Math.min(visibleToServer, Number(before) - 1) : visibleToServer;
      const eligible = received.slice(first, last);
      return route.fulfill({ json: { messages: after ? eligible.slice(0, 40) : eligible.slice(-40), more: eligible.length > 40 } });
    });
    await page.goto(`/messages/${conversationId}`);
    await expect(page.getByText("History message 40", { exact: true })).toBeInViewport();
    visibleToServer = received.length;
    connection?.send(JSON.stringify({ type: "conversation", id: conversationId, roster: false }));
    await expect(page.getByText("History message 280", { exact: true })).toBeInViewport();
    const list = page.getByRole("list", { name: "Messages" });
    const mounted = list.locator("[data-virtual-message]");
    const reply = list.locator(`[data-virtual-message="${received[279].id}"]`);
    await expect(reply).toHaveAttribute("aria-setsize", "280");
    expect(await mounted.count()).toBeLessThan(90);
    const target = list.locator(`[data-virtual-message="${received[99].id}"]`);
    await expect(target).toHaveCount(0);
    expect(reads.has(received[99].id)).toBe(false);
    await reply.getByRole("button", { name: /History message 100/ }).click();
    await expect(target).toBeInViewport();
    await expect(target).toBeFocused();
    await expect.poll(() => reads.has(received[99].id)).toBe(true);
    expect(await mounted.count()).toBeLessThan(90);

    const history = page.getByLabel("Message history");
    const anchor = await history.evaluate((host) => {
      const top = host.getBoundingClientRect().top + 1;
      const rows = [...host.querySelectorAll<HTMLElement>("[data-virtual-message]")];
      const index = rows.findIndex((row) => row.getBoundingClientRect().bottom > top);
      const visible = rows[index];
      const earlier = rows[index - 1];
      if (!visible || !earlier) throw new Error("Expected a visible row and an overscan row");
      const offset = visible.getBoundingClientRect().top;
      const scrollTop = host.scrollTop;
      earlier.style.paddingBottom = "101px";
      return { id: visible.dataset.virtualMessage, offset, scrollTop };
    });
    await expect.poll(() => history.evaluate((host) => host.scrollTop)).toBeGreaterThan(anchor.scrollTop + 90);
    const anchored = list.locator(`[data-virtual-message="${anchor.id}"]`);
    const position = await anchored.boundingBox();
    expect(Math.abs((position?.y ?? 0) - anchor.offset)).toBeLessThan(2);

    const play = target.getByRole("button", { name: "Play voice message" });
    await play.click();
    await expect(play).toHaveAttribute("aria-busy", "true");
    await expect(play.locator(".animate-spin")).toHaveCount(0);
    releaseVoice.resolve();
    await expect(target.getByRole("button", { name: "Pause voice message" })).toBeVisible();
    await history.evaluate((host) => {
      host.focus({ preventScroll: true });
      host.scrollTop = host.scrollHeight;
    });
    await expect(reply).toBeInViewport();
    await expect(list.locator(`[data-virtual-message="${received[100].id}"]`)).toHaveCount(0);
    await expect(target.locator("audio")).toHaveJSProperty("paused", false);
    await target.locator("audio").evaluate((audio: HTMLAudioElement) => audio.pause());
    await expect(target).toHaveCount(0);

    const last = received[279];
    const reactions: string[] = [];
    await page.route(`**${threadPath}/messages/${last.id}/reaction`, (route) => {
      reactions.push(route.request().postDataJSON().emoji);
      return route.fulfill({ status: 204 });
    });
    await page.route(`**${threadPath}/messages/${last.id}?*`, (route) => route.fulfill({
      json: { message: { ...last, reactions: [{ userId: sender.id, emoji: reactions.at(-1)! }] } },
    }));
    const addReaction = reply.getByRole("button", { name: "Add reaction" });
    const picker = page.getByRole("dialog", { name: "Choose an emoji" });
    await reply.hover();
    await addReaction.click();
    await expect(picker).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    async function gesture(dx = 0, dy = 0, hold = false) {
      const bounds = await reply.locator("[data-message-body] p").first().boundingBox();
      if (!bounds) throw new Error("Message body missing");
      const point = { x: bounds.x + 15, y: bounds.y + bounds.height / 2 };
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      if (hold) await expect(reply.locator("[data-message-id]")).toHaveAttribute("data-selected", "true");
      if (dx || dy) await session.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: point.x + dx, y: point.y + dy }],
      });
      if (dx > 64) {
        await expect(reply.locator("[data-swipe-reply]")).toHaveCSS("opacity", "1");
        expect(await history.evaluate((host) => host.scrollWidth <= host.clientWidth)).toBe(true);
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await gesture(0, 0, true);
    await expect(reply.getByRole("button", { name: "React with 😂" })).toBeInViewport();
    const other = history.locator("li[data-virtual-message]").filter({ hasNot: page.locator("[data-selected]") }).first();
    await expect(other).toHaveCSS("filter", "blur(1.5px)");
    const button = await addReaction.boundingBox();
    if (!button) throw new Error("Missing reaction button");
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2 }],
    });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(picker).toBeVisible();
    await picker.getByRole("option").first().click();
    await expect.poll(() => reactions.length).toBe(1);
    await expect(picker).toBeHidden();
    await expect(reply.getByRole("toolbar")).toBeHidden();
    await expect(other).toHaveCSS("filter", "none");
    await gesture();
    await expect(reply.locator("[data-message-id]")).not.toHaveAttribute("data-selected", "true");
    await gesture();
    await expect.poll(() => reactions.slice(1)).toEqual(["❤️"]);
    await expect(reply.getByText("❤️", { exact: true }).first()).toBeVisible();
    await gesture(90, 2);
    await expect(page.getByRole("button", { name: "Cancel reply" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Cancel reply" }).click();
    await gesture(3, -75);
    await expect(page.getByRole("button", { name: "Cancel reply" })).toHaveCount(0);
    await session.detach();
  } finally {
    await otherPage.close();
  }
});
