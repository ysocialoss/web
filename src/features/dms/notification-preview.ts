import { z } from "zod/mini";
import { decryptMessage, deviceAccess, matchDevice, verifyDirectory } from "./dm-crypto.ts";
import { decodePayload, notificationLabel } from "./message-payload.ts";
import { pinConversation, readLocalDevice, rememberRemovals, trustedRoot } from "./dm-storage.ts";

const device = z.object({
  id: z.uuid(), userId: z.uuid(), encryptionKey: z.string(), signingKey: z.string(), proof: z.string(),
  root: z.boolean(), generation: z._default(z.int().check(z.positive()), 1), approvedBy: z.nullable(z.uuid()), approval: z.nullable(z.string()),
  revokedAt: z.nullable(z.iso.datetime()), revokedBy: z.nullable(z.uuid()), revocation: z.nullable(z.string()),
});
const responseSchema = z.object({
  conversationId: z.uuid(),
  author: z.optional(z.object({ displayName: z.string(), handle: z.string() })),
  devices: z.array(device).check(z.maxLength(256)),
  message: z.object({
    id: z.uuid(), senderId: z.uuid(), senderDeviceId: z.uuid(), version: z.literal(1), iv: z.string(),
    ciphertext: z.string(), signature: z.string(), envelope: z.string(), sequence: z.string(), createdAt: z.iso.datetime(),
  }),
});
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export async function chatNotificationPreview(userId: string, notificationId: string, signal: AbortSignal) {
  try {
    if (!z.uuid().safeParse(userId).success || !z.uuid().safeParse(notificationId).success) return;
    const local = await readLocalDevice(userId);
    if (!local) return;
    const path = `/api/dms/notification-previews/${notificationId}?${new URLSearchParams({ device: local.id })}`;
    const headers = await deviceAccess(local, "GET", path);
    const response = await fetch(path, { headers, credentials: "same-origin", cache: "no-store", signal });
    if (response.status !== 200) return;
    const { conversationId, author, message, devices } = responseSchema.parse(await response.json());
    if (message.senderId === userId) return;
    const [own, peer] = await Promise.all([verifyDirectory(userId, devices), verifyDirectory(message.senderId, devices)]);
    if (!own || !peer || !own.active.some((entry) => matchDevice(local, entry))) return;
    if (!await trustedRoot(userId, own.root, false)) return;
    const sender = peer.verified.get(message.senderDeviceId);
    if (!sender) return;
    await rememberRemovals(userId, own);
    const text = notificationLabel(decodePayload(await decryptMessage(conversationId, local, sender, message))).replace(/\s+/gu, " ").trim();
    signal.throwIfAborted();
    if (!await pinConversation(userId, conversationId, message.senderId) || !await trustedRoot(userId, peer.root, true)) return;
    await rememberRemovals(userId, peer);
    signal.throwIfAborted();
    const characters = Array.from(segmenter.segment(text), ({ segment }) => segment);
    return {
      text: characters.length > 120 ? characters.slice(0, 119).join("") + "…" : text,
      author: author?.displayName.replace(/\s+/gu, " ").trim() || author?.handle,
    };
  } catch {
    // An unavailable or unverified browser can still show the generic alert.
    return undefined;
  }
}
