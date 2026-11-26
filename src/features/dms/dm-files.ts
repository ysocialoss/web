import { fromBase64 as decode, toBase64 as encode } from "./base64.ts";

/** Ciphertext limit enforced by the API (`attachmentLimit`); AES-GCM adds a 16 byte tag. */
export const fileByteLimit = 25 * 1024 * 1024 - 16;

/** Binds a file's ciphertext to its conversation and attachment id so it can't be swapped for another. */
export const fileBinding = (conversationId: string, attachmentId: string) =>
  new TextEncoder().encode(JSON.stringify(["ysocial.dm.file", 1, conversationId, attachmentId]));

export async function encryptFile(blob: Blob, binding?: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt(
    binding ? { name: "AES-GCM", iv, additionalData: binding } : { name: "AES-GCM", iv }, key, await blob.arrayBuffer(),
  ));
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { data, key: encode(raw), iv: encode(iv) };
}

export async function decryptFile(data: Uint8Array<ArrayBuffer>, key: string, iv: string, mime: string, binding?: Uint8Array<ArrayBuffer>) {
  const imported = await crypto.subtle.importKey("raw", decode(key), "AES-GCM", false, ["decrypt"]);
  const nonce = decode(iv);
  const plain = await crypto.subtle.decrypt(
    binding ? { name: "AES-GCM", iv: nonce, additionalData: binding } : { name: "AES-GCM", iv: nonce }, imported, data,
  );
  return new Blob([plain], { type: mime });
}
