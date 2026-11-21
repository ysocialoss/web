import { dmApi, requestLimit, type DmUser } from "./dm-api";
import { transmitMessage } from "./dm-context";
import { DeviceTrustError, type LocalDevice } from "./dm-crypto";
import { pinConversation, readLocalDevice } from "./dm-storage";

export async function openConversation(handle: string, device: LocalDevice) {
  const { id, peerId } = await dmApi.open(handle, device);
  if (!await pinConversation(device.userId, id, peerId))
    throw new DeviceTrustError("The conversation participants could not be verified.");
  return id;
}

export type Recent =
  | { state: "setup" }
  | { state: "error"; message: string }
  | { state: "ready"; device: LocalDevice; people: DmUser[] };

export async function recentContacts(userId: string, signal: AbortSignal, limit = 5): Promise<Recent> {
  const device = await readLocalDevice(userId);
  if (!device) return { state: "setup" };
  const { conversations } = await dmApi.conversations(device, signal);
  const people = conversations
    .filter((conversation) => conversation.inviteStatus === "accepted"
      || (conversation.inviteStatus === "pending" && conversation.invitedBy === userId && conversation.requestSent < requestLimit))
    .slice(0, limit)
    .map(({ peer }) => peer);
  return { state: "ready", device, people };
}

export async function sendTextTo(device: LocalDevice, handle: string, text: string, signal: AbortSignal) {
  const id = await openConversation(handle, device);
  await transmitMessage({
    id, device, signal, messageId: crypto.randomUUID(), payload: text,
    send: (body, abort) => dmApi.send(id, body, abort),
  });
  return id;
}
