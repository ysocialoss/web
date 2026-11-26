import { fromBase64 as decode, toBase64 as encode } from "./base64.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const signingAlgorithm = { name: "ECDSA", hash: "SHA-256" };
const curve = { name: "ECDSA", namedCurve: "P-256" };
const rsa = { name: "RSA-OAEP", hash: "SHA-256" };
const version = 1;

export const messageByteLimit = 4000;

export type DeviceKeys = {
  id: string;
  userId: string;
  encryptionKey: string;
  signingKey: string;
};
export type Registration = DeviceKeys & { proof: string };
export type DirectoryDevice = Registration & {
  root: boolean;
  generation: number;
  approvedBy: string | null;
  approval: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocation: string | null;
};
export type LocalDevice = Registration & {
  decryptionKey: CryptoKey;
  privateSigningKey: CryptoKey;
};
type Message = {
  id: string;
  senderDeviceId: string;
  version: number;
  iv: string;
  ciphertext: string;
  signature: string;
};
export type EncryptedMessage = Message & { envelopes: Record<string, string> };
export type ReceivedMessage = Message & {
  senderId: string;
  envelope: string;
  sequence: string;
  createdAt: string;
};

function transcript(...fields: (number | string)[]) {
  return encoder.encode(JSON.stringify(fields));
}

function keyFields({ userId, id, encryptionKey, signingKey }: DeviceKeys) {
  return [userId, id, encryptionKey, signingKey];
}

const deviceProof = (device: DeviceKeys) => transcript("ysocial.dm.device", version, ...keyFields(device));
const approvalProof = (actorId: string, device: DeviceKeys) =>
  transcript("ysocial.dm.approve", version, actorId, ...keyFields(device));

async function sign(key: CryptoKey, payload: Uint8Array<ArrayBuffer>) {
  return encode(await crypto.subtle.sign(signingAlgorithm, key, payload));
}

async function verify(device: DeviceKeys, payload: Uint8Array<ArrayBuffer>, signature: string) {
  try {
    const key = await crypto.subtle.importKey("spki", decode(device.signingKey), curve, false, ["verify"]);
    return await crypto.subtle.verify(signingAlgorithm, key, decode(signature), payload);
  } catch {
    return false;
  }
}

export async function generateDevice(userId: string): Promise<LocalDevice> {
  const [encryption, signing] = await Promise.all([
    crypto.subtle.generateKey({ ...rsa, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, false, ["encrypt", "decrypt"]),
    crypto.subtle.generateKey(curve, false, ["sign", "verify"]),
  ]);
  const [encryptionKey, signingKey] = await Promise.all([
    crypto.subtle.exportKey("spki", encryption.publicKey),
    crypto.subtle.exportKey("spki", signing.publicKey),
  ]);
  const device = { userId, id: crypto.randomUUID(), encryptionKey: encode(encryptionKey), signingKey: encode(signingKey) };
  return {
    ...device,
    proof: await sign(signing.privateKey, deviceProof(device)),
    decryptionKey: encryption.privateKey,
    privateSigningKey: signing.privateKey,
  };
}

export function matchDevice(first: DeviceKeys, second: DeviceKeys) {
  return first.userId === second.userId && first.id === second.id
    && first.encryptionKey === second.encryptionKey && first.signingKey === second.signingKey;
}

export const signApproval = (actor: LocalDevice, target: DeviceKeys) =>
  sign(actor.privateSigningKey, approvalProof(actor.id, target));

const revocationProof = (actor: DeviceKeys, targetId: string) =>
  transcript("ysocial.dm.revoke", version, actor.id, actor.userId, targetId);

export const signRevocation = (actor: LocalDevice, targetId: string) =>
  sign(actor.privateSigningKey, revocationProof(actor, targetId));

export async function deviceAccess(device: LocalDevice, method: string, path: string, binding = "", now = Date.now()) {
  const timestamp = String(now);
  return {
    "x-dm-time": timestamp,
    "x-dm-signature": await sign(device.privateSigningKey,
      transcript("ysocial.dm.access", version, device.userId, device.id, method, path, binding, timestamp)),
  };
}

async function hash(payload: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const fingerprint = (root: DeviceKeys) => hash(transcript("ysocial.dm.identity", version, ...keyFields(root)));

export async function pairingCode(root: DeviceKeys, target: DeviceKeys) {
  const digest = await hash(transcript("ysocial.dm.pair.request", version, ...keyFields(root), ...keyFields(target)));
  return digest.slice(0, 16);
}

export function formatCode(code: string) {
  return code.match(/.{1,4}/g)?.join(" ") ?? "";
}

export class DeviceTrustError extends Error {}

export async function verifyDirectory(userId: string, directory: DirectoryDevice[], generation?: number) {
  const certified = directory.filter((device) => device.userId === userId && (device.root || device.approvedBy));
  const current = generation ?? certified.reduce((latest, device) => Math.max(latest, device.generation), 0);
  const devices = certified.filter((device) => device.generation === current);
  if (!devices.length) return null;
  const roots = devices.filter((device) => device.root);
  const [root] = roots;
  const remaining = new Map(devices.filter((device) => !device.root).map((device) => [device.id, device]));
  if (roots.length !== 1 || !root || root.approvedBy || root.approval
      || remaining.size !== devices.length - 1 || remaining.has(root.id)
      || !await verify(root, deviceProof(root), root.proof)) {
    throw new DeviceTrustError("The device list could not be verified.");
  }

  const verified = new Map([[root.id, root]]);
  for (const device of remaining.values()) {
    const chain: DirectoryDevice[] = [];
    const seen = new Set<string>();
    let next: DirectoryDevice | undefined = device;
    while (next && !verified.has(next.id) && !seen.has(next.id)) {
      chain.push(next);
      seen.add(next.id);
      next = next.approvedBy ? remaining.get(next.approvedBy) ?? verified.get(next.approvedBy) : undefined;
    }
    if (!next || !verified.has(next.id)) throw new DeviceTrustError("The device list could not be verified.");
    let approver = next;
    for (const entry of chain.reverse()) {
      if (!entry.approval || !await verify(approver, approvalProof(approver.id, entry), entry.approval)
          || !await verify(entry, deviceProof(entry), entry.proof)) {
        throw new DeviceTrustError("The device list could not be verified.");
      }
      verified.set(entry.id, entry);
      approver = entry;
    }
  }
  for (const entry of verified.values()) {
    if (!entry.revokedAt && !entry.revokedBy && !entry.revocation) continue;
    const actor = entry.revokedBy && verified.get(entry.revokedBy);
    if (!entry.revokedAt || !actor || actor.id === entry.id || !entry.revocation
        || !await verify(actor, revocationProof(actor, entry.id), entry.revocation)) {
      throw new DeviceTrustError("A device removal could not be verified.");
    }
  }
  return { root, verified, active: Array.from(verified.values()).filter((device) => !device.revokedAt) };
}

function messageContext(conversationId: string, senderId: string, message: Pick<Message, "id" | "senderDeviceId" | "version">) {
  return [message.version, conversationId, message.id, senderId, message.senderDeviceId];
}

function messageProof(context: (number | string)[], iv: string, ciphertext: string) {
  return transcript("ysocial.dm.message", ...context, iv, ciphertext);
}

export async function encryptMessage(conversationId: string, id: string, sender: LocalDevice, recipients: DeviceKeys[], text: string): Promise<EncryptedMessage> {
  const plaintext = encoder.encode(text);
  if (!plaintext.length || plaintext.length > messageByteLimit) throw new Error("Message length is out of range.");
  const header = { id, senderDeviceId: sender.id, version };
  const context = messageContext(conversationId, sender.userId, header);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  try {
    const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
    const iv = encode(nonce);
    const ciphertext = encode(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: transcript("ysocial.dm.body", ...context) },
      key, plaintext,
    ));
    const envelopes = await Promise.all(recipients.map(async (device) => {
      const encryptionKey = await crypto.subtle.importKey("spki", decode(device.encryptionKey), rsa, false, ["encrypt"]);
      const wrapped = await crypto.subtle.encrypt(
        { name: rsa.name, label: transcript("ysocial.dm.envelope", ...context, device.id) },
        encryptionKey, rawKey,
      );
      return [device.id, encode(wrapped)];
    }));
    const signature = await sign(sender.privateSigningKey, messageProof(context, iv, ciphertext));
    return { ...header, iv, ciphertext, signature, envelopes: Object.fromEntries(envelopes) };
  } finally {
    rawKey.fill(0);
  }
}

export async function decryptMessage(conversationId: string, recipient: LocalDevice, sender: DeviceKeys, message: ReceivedMessage) {
  if (message.version !== version || message.senderId !== sender.userId || message.senderDeviceId !== sender.id)
    throw new DeviceTrustError("The message sender could not be verified.");
  const context = messageContext(conversationId, sender.userId, message);
  if (!await verify(sender, messageProof(context, message.iv, message.ciphertext), message.signature))
    throw new DeviceTrustError("The message signature could not be verified.");
  const rawKey = await crypto.subtle.decrypt(
    { name: rsa.name, label: transcript("ysocial.dm.envelope", ...context, recipient.id) },
    recipient.decryptionKey, decode(message.envelope),
  );
  try {
    const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
    return decoder.decode(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decode(message.iv), additionalData: transcript("ysocial.dm.body", ...context) },
      key, decode(message.ciphertext),
    ));
  } finally {
    new Uint8Array(rawKey).fill(0);
  }
}
