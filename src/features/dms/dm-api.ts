import { z } from "zod";
import { ApiError, errorMessage, sendRequest } from "@/lib/api";
import { deviceAccess, DeviceTrustError, type EncryptedMessage, type LocalDevice, type Registration } from "./dm-crypto";

const user = z.object({ id: z.uuid(), handle: z.string(), displayName: z.string(), avatarUrl: z.string().nullable() });
const directoryDevice = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  encryptionKey: z.string(),
  signingKey: z.string(),
  proof: z.string(),
  root: z.boolean(),
  generation: z.number().int().positive().default(1),
  approvedBy: z.uuid().nullable(),
  approval: z.string().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  revokedBy: z.uuid().nullable(),
  revocation: z.string().nullable(),
});
const ownDevice = directoryDevice.extend({ label: z.string(), createdAt: z.iso.datetime() });
const invite = z.object({ invitedBy: z.uuid().nullable(), inviteStatus: z.enum(["pending", "accepted", "declined"]) });
const conversation = invite.extend({ id: z.uuid(), peer: user, lastMessageAt: z.iso.datetime().nullable() });
const context = invite.extend({ members: z.array(user), devices: z.array(directoryDevice) });
export type InviteResponse = Exclude<z.infer<typeof invite>["inviteStatus"], "pending">;
const message = z.object({
  id: z.uuid(),
  senderId: z.uuid(),
  senderDeviceId: z.uuid(),
  version: z.number(),
  iv: z.string(),
  ciphertext: z.string(),
  signature: z.string(),
  envelope: z.string(),
  sequence: z.string().regex(/^[1-9][0-9]{0,18}$/),
  createdAt: z.iso.datetime(),
});

export type DmUser = z.infer<typeof user>;
export type OwnDevice = z.infer<typeof ownDevice>;
export type Conversation = z.infer<typeof conversation>;

async function request<T>(path: string, schema: z.ZodType<T>, { method = "GET", body, signal, device, binding }: {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  device?: LocalDevice;
  binding?: string;
} = {}) {
  const url = `/api/dms${path}`;
  const headers = device ? await deviceAccess(device, method, url, binding) : undefined;
  const timeout = AbortSignal.timeout(12_000);
  return sendRequest(url, schema, method, body, signal ? AbortSignal.any([signal, timeout]) : timeout, headers);
}

function conversationPath(id: string) {
  return `/conversations/${encodeURIComponent(id)}`;
}

function registration({ id, signingKey, encryptionKey, proof }: Registration) {
  return { id, signingKey, encryptionKey, proof, label: `Browser ${id.slice(-6).toUpperCase()}` };
}

export const dmApi = {
  devices: (signal?: AbortSignal) => request("/devices", z.object({ devices: z.array(ownDevice) }), { signal }),
  register: (device: Registration, signal: AbortSignal) =>
    request("/devices", z.undefined(), { method: "POST", body: registration(device), signal }),
  reset: (device: Registration, previousRootId: string) =>
    request("/devices/reset", z.undefined(), {
      method: "POST", body: { ...registration(device), previousRootId },
    }),
  deviceAction: (id: string, action: "approve" | "revoke", actorId: string, signature: string) =>
    request(`/devices/${encodeURIComponent(id)}/${action}`, z.undefined(), { method: "POST", body: { actorId, signature } }),
  conversations: (device: LocalDevice, signal?: AbortSignal) =>
    request(`/conversations?${new URLSearchParams({ device: device.id })}`, z.object({ conversations: z.array(conversation) }), { device, signal }),
  open: (handle: string, device: LocalDevice) =>
    request("/conversations", z.object({ id: z.uuid(), peerId: z.uuid() }), {
      method: "POST", body: { handle, deviceId: device.id }, device, binding: handle,
    }),
  context: (id: string, device: LocalDevice, signal?: AbortSignal) =>
    request(`${conversationPath(id)}?${new URLSearchParams({ device: device.id })}`, context, { device, signal }),
  respondToInvite: (id: string, device: LocalDevice, response: InviteResponse, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/invite`, z.undefined(), { method: "POST", body: { deviceId: device.id, response }, device, binding: response, signal }),
  messages: (id: string, device: LocalDevice, cursor?: { after: string } | { before: string }, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages?${new URLSearchParams({ device: device.id, ...cursor })}`,
      z.object({ messages: z.array(message), more: z.boolean() }), { device, signal }),
  read: (id: string, device: LocalDevice, messageIds: string[], signal?: AbortSignal) =>
    request(`${conversationPath(id)}/read`, z.undefined(), {
      method: "PUT", body: { deviceId: device.id, messageIds }, device, binding: JSON.stringify(messageIds), signal,
    }),
  send: (id: string, input: EncryptedMessage, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages`, z.undefined(), { method: "POST", body: input, signal }),
};

const messages: Record<string, string> = {
  dm_user_not_found: "No available user has that handle.",
  dm_self: "Choose someone other than yourself.",
  dm_identity_changed: "The account’s chat identity changed. Reload Messages and try again.",
  dm_device_limit: "This account has reached its device limit.",
  dm_device_unverified: "This browser needs to be verified.",
  invalid_dm_device_access: "Couldn’t verify this browser. Check your system clock and try again.",
  dm_device_not_found: "The device request has expired.",
  dm_device_unavailable: "The device request has expired or was removed.",
  dm_device_revoked: "This browser was removed from Messages.",
  dm_conversation_not_found: "This conversation is unavailable.",
  dm_conversation_unavailable: "This conversation is unavailable.",
  dm_recipient_not_enrolled: "The other person needs to open Messages first.",
  dm_invite_required: "Messages are available after the invite is accepted.",
  dm_invite_already_answered: "This invite has already been answered.",
  dm_device_roster_changed: "The verified devices changed. Send again to use the current list.",
  network_unavailable: "Couldn't reach Messages. Check your connection and try again.",
};

export function dmError(error: unknown) {
  if (error instanceof DeviceTrustError) return error.message;
  if (error instanceof ApiError) return messages[error.message] ?? errorMessage(error);
  if (error instanceof Error && error.constructor === Error) return error.message;
  return "Something went wrong in Messages. Try again.";
}
