import { DeviceTrustError, fingerprint, generateDevice, type DeviceKeys, type LocalDevice, verifyDirectory } from "./dm-crypto.ts";

let opening: Promise<IDBDatabase> | undefined;

function database() {
  if (!globalThis.indexedDB || !globalThis.crypto?.subtle)
    throw new Error("Messages need a secure browser with device storage enabled.");
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ysocial-encrypted-dms", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opening = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      opening = undefined;
      reject(request.error);
    };
  });
  return opening;
}

async function read(key: string): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction("keys").objectStore("keys").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function write(key: string, value: LocalDevice | string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.objectStore("keys").add(value, key);
  });
}

function alreadyExists(error: unknown) {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export async function readLocalDevice(userId: string): Promise<LocalDevice | undefined> {
  const value = await read(`device:${userId}`);
  if (value === undefined) return;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string"
      && "userId" in value && value.userId === userId
      && "encryptionKey" in value && typeof value.encryptionKey === "string"
      && "signingKey" in value && typeof value.signingKey === "string"
      && "proof" in value && typeof value.proof === "string"
      && "decryptionKey" in value && value.decryptionKey instanceof CryptoKey
      && "privateSigningKey" in value && value.privateSigningKey instanceof CryptoKey) {
    return {
      id: value.id, userId, encryptionKey: value.encryptionKey, signingKey: value.signingKey,
      proof: value.proof, decryptionKey: value.decryptionKey, privateSigningKey: value.privateSigningKey,
    };
  }
  throw new Error("This browser’s chat keys could not be opened.");
}

export async function createLocalDevice(userId: string) {
  const device = await generateDevice(userId);
  try {
    await write(`device:${userId}`, device);
    return device;
  } catch (error) {
    if (!alreadyExists(error)) throw error;
    const existing = await readLocalDevice(userId);
    if (!existing) throw error;
    return existing;
  }
}

export async function clearRevokedDevice(device: LocalDevice) {
  const db = await database();
  const key = `device:${device.userId}`;
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    const store = transaction.objectStore("keys");
    const request = store.get(key);
    request.onsuccess = () => {
      const current: unknown = request.result;
      if (current && typeof current === "object" && "id" in current && current.id === device.id)
        store.delete(key);
    };
  });
}

async function pin(key: string, value: string, allowFirstUse: boolean, mismatch: string): Promise<boolean> {
  const known = await read(key);
  if (known === value) return true;
  if (known !== undefined) throw new DeviceTrustError(mismatch);
  if (!allowFirstUse) return false;
  try {
    await write(key, value);
  } catch (error) {
    if (!alreadyExists(error)) throw error;
    return pin(key, value, false, mismatch);
  }
  return true;
}

type IdentityPin = { current: string; previous: string[] };

function identityPin(value: unknown): IdentityPin | undefined {
  if (typeof value === "string") return { current: value, previous: [] };
  if (value === undefined) return;
  if (value && typeof value === "object" && "current" in value && typeof value.current === "string" &&
      "previous" in value && Array.isArray(value.previous) && value.previous.every((entry) => typeof entry === "string"))
    return { current: value.current, previous: value.previous };
  throw new DeviceTrustError("The saved chat security code could not be opened.");
}

const identityKey = (ownerId: string, userId: string) => `identity:${ownerId}:${userId}`;

export async function rootStatus(ownerId: string, root: DeviceKeys) {
  const [value, code] = await Promise.all([read(identityKey(ownerId, root.userId)), fingerprint(root)]);
  const known = identityPin(value);
  return { known, code, trusted: known?.current === code };
}

export async function trustedRoot(ownerId: string, root: DeviceKeys, allowFirstUse: boolean) {
  const { known, code, trusted } = await rootStatus(ownerId, root);
  if (trusted) return true;
  if (known || !allowFirstUse) return false;
  try {
    await write(identityKey(ownerId, root.userId), code);
  } catch (error) {
    if (!alreadyExists(error)) throw error;
    return trustedRoot(ownerId, root, false);
  }
  return true;
}

export async function confirmRoot(ownerId: string, root: DeviceKeys, expected: string | undefined) {
  const [db, code] = await Promise.all([database(), fingerprint(root)]);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    const store = transaction.objectStore("keys");
    const key = identityKey(ownerId, root.userId);
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        const known = identityPin(request.result);
        if (known?.current === code) return;
        if (known?.current !== expected || known?.previous.includes(code))
          throw new DeviceTrustError("The saved chat security code changed. Check the code again.");
        store.put({ current: code, previous: known ? [...known.previous, known.current] : [] } satisfies IdentityPin, key);
      } catch (error) {
        reject(error);
        transaction.abort();
      }
    };
  });
}

export async function historicalSenderKeys(ownerId: string, current: NonNullable<Awaited<ReturnType<typeof verifyDirectory>>>, devices: Parameters<typeof verifyDirectory>[1]) {
  const known = identityPin(await read(identityKey(ownerId, current.root.userId)));
  const keys = new Map<string, DeviceKeys>();
  if (!known) return keys;
  const roots = devices.filter(({ userId, root, generation }) =>
    userId === current.root.userId && root && generation < current.root.generation);
  const trusted = await Promise.all(roots.map(async (root) => {
    const code = await fingerprint(root);
    if (code === known.current || known.previous.includes(code))
      return verifyDirectory(root.userId, devices, root.generation);
  }));
  for (const directory of trusted) {
    for (const [id, device] of directory?.verified ?? []) keys.set(id, device);
  }
  return keys;
}

export function pinConversation(ownerId: string, conversationId: string, peerId: string) {
  return pin(`conversation:${ownerId}:${conversationId}`, peerId, true,
    "The conversation participants changed. This conversation is locked.");
}

export async function rememberRemovals(ownerId: string, directory: NonNullable<Awaited<ReturnType<typeof verifyDirectory>>>) {
  const db = await database();
  const key = `removed:${ownerId}:${directory.root.userId}`;
  const removed = [...directory.verified.values()].filter(({ revokedAt }) => !!revokedAt).map(({ id }) => id);
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    const store = transaction.objectStore("keys");
    const request = store.get(key);
    request.onsuccess = () => {
      const value: unknown = request.result;
      const known = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
      if (directory.active.some(({ id }) => known.includes(id))) {
        reject(new DeviceTrustError("The device list included a previously removed device."));
        transaction.abort();
        return;
      }
      const updated = [...new Set([...known, ...removed])];
      if (updated.length > known.length) store.put(updated, key);
    };
  });
}
