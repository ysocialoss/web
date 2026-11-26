import { z } from "zod/mini";
import { ApiError, errorMessage, sendRequest, userSchema } from "@/lib/api";
import { deviceAccess, DeviceTrustError, type EncryptedMessage, type LocalDevice, type Registration } from "./dm-crypto";

const user = z.extend(userSchema, { id: z.uuid() });
const directoryDevice = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  encryptionKey: z.string(),
  signingKey: z.string(),
  proof: z.string(),
  root: z.boolean(),
  generation: z._default(z.int().check(z.positive()), 1),
  approvedBy: z.nullable(z.uuid()),
  approval: z.nullable(z.string()),
  revokedAt: z.nullable(z.iso.datetime()),
  revokedBy: z.nullable(z.uuid()),
  revocation: z.nullable(z.string()),
});
const ownDevice = z.extend(directoryDevice, { label: z.string(), createdAt: z.iso.datetime() });
const invite = z.object({ invitedBy: z.nullable(z.uuid()), inviteStatus: z.enum(["pending", "accepted", "declined"]) });
const conversation = z.extend(invite, {
  id: z.uuid(), peer: user, lastMessageAt: z.nullable(z.iso.datetime()),
  unread: z._default(z.int().check(z.nonnegative()), 0), requestSent: z._default(z.int().check(z.nonnegative()), 0),
});
const context = z.extend(invite, {
  members: z.array(user), devices: z.array(directoryDevice), requestSent: z._default(z.int().check(z.nonnegative()), 0),
  selfOptedOut: z._default(z.boolean(), false), peerOptedOut: z._default(z.boolean(), false),
});
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
  sequence: z.string().check(z.regex(/^[1-9][0-9]{0,18}$/)),
  createdAt: z.iso.datetime(),
  editedAt: z._default(z.nullable(z.iso.datetime()), null),
  reactions: z._default(z.array(z.object({ userId: z.uuid(), emoji: z.string() })), []),
  votes: z._default(z.array(z.object({ userId: z.uuid(), option: z.int() })), []),
});
const linkPreview = z.object({
  previews: z.array(z.object({
    kind: z.optional(z.string()), href: z.string(), title: z.string(), description: z.optional(z.string()),
    siteName: z.optional(z.string()), imageKey: z.optional(z.string()), iconKey: z.optional(z.string()),
  })),
});

export type DmUser = z.infer<typeof user>;
export type OwnDevice = z.infer<typeof ownDevice>;
export type Conversation = z.infer<typeof conversation>;
export type WireMessage = z.infer<typeof message>;
export type WireReaction = WireMessage["reactions"][number];
export type WireVote = WireMessage["votes"][number];
export type LinkPreview = z.infer<typeof linkPreview>["previews"][number];
export const requestLimit = 3;

async function request<T>(path: string, schema: z.ZodMiniType<T>, { method = "GET", body, signal, device, binding }: {
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
  preferences: (signal?: AbortSignal) => request("/preferences", z.object({ enabled: z.boolean() }), { signal }),
  setMessaging: (device: LocalDevice, enabled: boolean) =>
    request("/preferences", z.undefined(), { method: "PUT", body: { deviceId: device.id, enabled }, device, binding: enabled ? "on" : "off" }),
  unread: (signal?: AbortSignal) => request("/unread", z.object({ unread: z.number(), requests: z.number() }), { signal }),
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
  message: (id: string, messageId: string, device: LocalDevice, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages/${encodeURIComponent(messageId)}?${new URLSearchParams({ device: device.id })}`,
      z.object({ message }), { device, signal }),
  send: (id: string, input: EncryptedMessage & { attachmentId?: string }, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages`, z.undefined(), { method: "POST", body: input, signal }),
  edit: (id: string, input: EncryptedMessage, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages/${encodeURIComponent(input.id)}`, z.undefined(), { method: "PUT", body: input, signal }),
  remove: (id: string, messageId: string, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages/${encodeURIComponent(messageId)}`, z.undefined(), { method: "DELETE", signal }),
  react: (id: string, messageId: string, emoji: string | null, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages/${encodeURIComponent(messageId)}/reaction`, z.undefined(), { method: "PUT", body: { emoji }, signal }),
  vote: (id: string, messageId: string, option: number | null, signal?: AbortSignal) =>
    request(`${conversationPath(id)}/messages/${encodeURIComponent(messageId)}/vote`, z.undefined(), { method: "PUT", body: { option }, signal }),
  linkPreview: async (url: string, signal?: AbortSignal) =>
    (await request(`/link-preview?${new URLSearchParams({ url })}`, linkPreview, { signal })).previews[0],
  linkPreviewAsset: (kind: "image" | "icon", url: string, key: string) =>
    `/api/dms/link-preview-${kind}?${new URLSearchParams({ url, key })}`,
  /** Uploads ciphertext with a device-signed request; XHR so the composer can show progress. */
  async upload(id: string, device: LocalDevice, attachmentId: string, data: Uint8Array<ArrayBuffer>, { signal, onProgress }: {
    signal?: AbortSignal;
    onProgress?: (fraction: number) => void;
  } = {}) {
    const url = `/api/dms${conversationPath(id)}/attachments?${new URLSearchParams({ device: device.id })}`;
    const headers = await deviceAccess(device, "POST", url, attachmentId);
    signal?.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.setRequestHeader("X-DM-Attachment-Id", attachmentId);
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      const abort = () => xhr.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const done = (error?: unknown) => {
        signal?.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve();
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return done();
        if (xhr.status === 413) return done(new ApiError(413, "dm_attachment_too_large"));
        let code = "network_unavailable";
        try {
          const body: unknown = JSON.parse(xhr.responseText);
          if (body && typeof body === "object" && "error" in body && typeof body.error === "string") code = body.error;
        } catch { /* not JSON */ }
        done(new ApiError(xhr.status, code));
      };
      xhr.onerror = () => done(new ApiError(0, "network_unavailable"));
      xhr.onabort = () => done(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      xhr.send(data);
    });
    return attachmentId;
  },
  async download(id: string, attachmentId: string, signal?: AbortSignal) {
    const response = await fetch(`/api/dms${conversationPath(id)}/attachments/${encodeURIComponent(attachmentId)}`, { signal, credentials: "same-origin" });
    if (!response.ok) throw new ApiError(response.status, "dm_attachment_not_found");
    return new Uint8Array(await response.arrayBuffer());
  },
  close: (id: string, device: LocalDevice) =>
    request(`${conversationPath(id)}/close`, z.undefined(), { method: "POST", body: { deviceId: device.id }, device, binding: "close" }),
  unblock: (id: string, device: LocalDevice) =>
    request(`${conversationPath(id)}/unblock`, z.undefined(), { method: "POST", body: { deviceId: device.id }, device, binding: "unblock" }),
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
  dm_request_limit: "You’ve sent the 3 messages a request allows. You can write again once they accept.",
  dm_opted_out: "Messages are turned off for your account. Turn them back on from Chat devices.",
  dm_recipient_opted_out: "This person has turned off Messages.",
  dm_blocked: "Messages between you and this person are turned off.",
  dm_block_owner_required: "Only the person who declined can unblock.",
  dm_attachment_limit: "Too many files are waiting to be sent. Try again in a moment.",
  dm_attachment_unavailable: "That file is no longer available. Attach it again.",
  dm_attachment_too_large: "Files can be up to 25 MB.",
  avatar_storage_unavailable: "File storage is unavailable right now. Try again in a moment.",
  avatar_storage_not_configured: "File sharing isn’t available on this server.",
  dm_attachment_not_found: "This file is no longer available.",
  dm_message_not_found: "That message no longer exists.",
  dm_message_owner_required: "You can only change your own messages.",
  invalid_dm_reaction: "That emoji can’t be used as a reaction.",
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
