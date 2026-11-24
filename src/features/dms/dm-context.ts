import { ApiError } from "@/lib/api";
import { dmApi, type WireMessage, type WireReaction, type WireVote } from "./dm-api";
import {
  DeviceTrustError, decryptMessage, encryptMessage, fingerprint, formatCode, matchDevice,
  verifyDirectory, type DeviceKeys, type EncryptedMessage, type LocalDevice, type ReceivedMessage,
} from "./dm-crypto";
import { historicalSenderKeys, pinConversation, rememberRemovals, rootStatus, trustedRoot } from "./dm-storage";
import { decodePayload, type MessagePayload } from "./message-payload";

export type DisplayMessage = Pick<ReceivedMessage, "id" | "senderId" | "sequence" | "createdAt">
  & Omit<MessagePayload, "text"> & { text: string | null; editedAt: string | null; reactions: WireReaction[]; votes: WireVote[] };

export type Context = Awaited<ReturnType<typeof readContext>>;

export async function readContext(id: string, device: LocalDevice, signal?: AbortSignal) {
  const { members, devices, inviteStatus, invitedBy, requestSent, selfOptedOut, peerOptedOut } = await dmApi.context(id, device, signal);
  const peer = members.find(({ id }) => id !== device.userId);
  const self = members.find(({ id }) => id === device.userId);
  if (!self || !peer || members.length !== 2)
    throw new DeviceTrustError("The conversation participants could not be verified.");
  const [own, theirs] = await Promise.all([verifyDirectory(self.id, devices), verifyDirectory(peer.id, devices)]);
  if (!own || !await trustedRoot(self.id, own.root, false)) {
    throw new DeviceTrustError("This browser’s approval could not be verified.");
  }
  await rememberRemovals(self.id, own);
  if (!own.active.some((entry) => matchDevice(device, entry)))
    throw new DeviceTrustError("This browser’s approval could not be verified.");
  if (!await pinConversation(self.id, id, peer.id))
    throw new DeviceTrustError("The conversation participants could not be verified.");
  const peerTrusted = theirs ? await trustedRoot(self.id, theirs.root, true) : false;
  if (theirs && peerTrusted) await rememberRemovals(self.id, theirs);
  const peerIdentity = theirs && !peerTrusted ? await rootStatus(self.id, theirs.root) : undefined;
  const senderKeys = new Map<string, DeviceKeys>(own.verified);
  if (theirs) {
    for (const [key, sender] of await historicalSenderKeys(self.id, theirs, devices)) senderKeys.set(key, sender);
    if (peerTrusted) for (const [key, sender] of theirs.verified) senderKeys.set(key, sender);
  }
  return {
    self, peer, own, theirs, inviteStatus, invitedBy, requestSent, selfOptedOut, peerOptedOut, senderKeys, peerIdentity,
    peerCode: theirs ? formatCode(await fingerprint(theirs.root)) : "",
  };
}

export async function decryptPage(id: string, device: LocalDevice, context: Context, messages: WireMessage[]) {
  return Promise.all(messages.map(async (message): Promise<DisplayMessage> => {
    const sender = context.senderKeys.get(message.senderDeviceId);
    const { id: messageId, senderId, sequence, createdAt, editedAt, reactions, votes } = message;
    const unreadable = { id: messageId, senderId, sequence, createdAt, editedAt, reactions, votes, text: null };
    if (!sender) return unreadable;
    try {
      return { ...unreadable, ...decodePayload(await decryptMessage(id, device, sender, message)) };
    } catch {
      return unreadable;
    }
  }));
}


export async function transmitMessage({ id, device, signal, peerId, messageId, payload, send, onStale }: {
  id: string;
  device: LocalDevice;
  signal: AbortSignal;
  peerId?: string;
  messageId: string;
  payload: string;
  send: (body: EncryptedMessage, signal: AbortSignal) => Promise<unknown>;
  onStale?: () => void;
}) {
  for (let attempt = 0; ; attempt++) {
    const next = await readContext(id, device, signal);
    if (peerId && next.peer.id !== peerId) throw new DeviceTrustError("The conversation participants changed. This conversation is locked.");
    if (next.peerIdentity) {
      onStale?.();
      throw new DeviceTrustError("Verify the contact’s new security code before sending.");
    }
    if (!next.theirs?.active.length) throw new Error("The other person needs a verified device to receive messages.");
    const body = await encryptMessage(id, messageId, device, [...next.own.active, ...next.theirs.active], payload);
    try {
      await send(body, signal);
      return next;
    } catch (error) {
      if (attempt || !(error instanceof ApiError) || error.message !== "dm_device_roster_changed") throw error;
    }
  }
}
