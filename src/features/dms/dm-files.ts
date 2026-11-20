const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

export async function encryptFile(blob: Blob) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await blob.arrayBuffer()));
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { data, key: encode(raw), iv: encode(iv) };
}

export async function decryptFile(data: Uint8Array<ArrayBuffer>, key: string, iv: string, mime: string) {
  const imported = await crypto.subtle.importKey("raw", decode(key), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, imported, data);
  return new Blob([plain], { type: mime });
}
