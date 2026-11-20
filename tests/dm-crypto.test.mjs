import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  decryptMessage, encryptMessage, fingerprint, formatCode, generateDevice, pairingCode,
  signApproval, signRevocation, verifyDirectory,
} from "../src/features/dms/dm-crypto.ts";

function registration(device) {
  const { id, userId, encryptionKey, signingKey, proof } = device;
  return { id, userId, encryptionKey, signingKey, proof, root: false, generation: 1, approvedBy: null, approval: null, revokedAt: null, revokedBy: null, revocation: null };
}

test("ciphertext opens only on addressed devices and authenticates its sender and conversation", async () => {
  const [sender, recipient, unverified] = await Promise.all([
    generateDevice(randomUUID()), generateDevice(randomUUID()), generateDevice(randomUUID()),
  ]);
  const ownSecondDevice = await generateDevice(sender.userId);
  const id = randomUUID();
  const text = "Grüße 👋\nSecond line";
  const encrypted = await encryptMessage(id, randomUUID(), sender, [sender, ownSecondDevice, recipient], text);
  assert.equal(JSON.stringify(encrypted).includes("Second line"), false);
  assert.equal(Object.hasOwn(encrypted.envelopes, unverified.id), false);
  for (const device of [sender, ownSecondDevice, recipient]) {
    const message = { ...encrypted, senderId: sender.userId, envelope: encrypted.envelopes[device.id] };
    assert.equal(await decryptMessage(id, device, sender, message), text);
  }
  const message = { ...encrypted, senderId: sender.userId, envelope: encrypted.envelopes[recipient.id] };
  await assert.rejects(decryptMessage(id, unverified, sender, message));
  await assert.rejects(decryptMessage(randomUUID(), recipient, sender, message));
  await assert.rejects(decryptMessage(id, recipient, sender, { ...message, ciphertext: message.ciphertext.replace(/^./, (c) => c === "A" ? "B" : "A") }));
  await assert.rejects(decryptMessage(id, recipient, sender, { ...message, envelope: encrypted.envelopes[sender.id] }));
  await assert.rejects(decryptMessage(id, recipient, recipient, message));
  await assert.rejects(encryptMessage(id, randomUUID(), sender, [recipient], "ü".repeat(2001)));
  assert.equal(sender.decryptionKey.extractable, false);
  assert.equal(sender.privateSigningKey.extractable, false);
});

test("device directories verify approval chains and signed removals", async () => {
  const userId = randomUUID();
  const [first, second, third] = await Promise.all(Array.from({ length: 3 }, () => generateDevice(userId)));
  const root = { ...registration(first), root: true };
  const pending = registration(second);
  assert.deepEqual((await verifyDirectory(userId, [pending, root])).active.map(({ id }) => id), [root.id]);
  const approved = { ...pending, approvedBy: root.id, approval: await signApproval(first, second) };
  const thirdDevice = { ...registration(third), approvedBy: second.id, approval: await signApproval(second, third) };
  const revoked = { ...root, revokedAt: new Date().toISOString(), revokedBy: third.id, revocation: await signRevocation(third, first.id) };
  const directory = await verifyDirectory(userId, [thirdDevice, approved, revoked]);
  assert.deepEqual(directory.active.map(({ id }) => id), [second.id, third.id]);
  assert.ok(directory.verified.has(first.id), "the revoked key can still authenticate historic messages");
  await assert.rejects(verifyDirectory(userId, [root, { ...approved, encryptionKey: third.encryptionKey }]));
  await assert.rejects(verifyDirectory(userId, [root, { ...approved, approvedBy: approved.id }]));
  await assert.rejects(verifyDirectory(userId, [root, { ...approved, revokedAt: new Date().toISOString() }]));

  const code = await pairingCode(root, pending);
  assert.equal(code, await pairingCode(root, approved));
  assert.equal(code, await pairingCode(root, second));
  assert.notEqual(code, await pairingCode(root, thirdDevice));
  assert.notEqual(code, await pairingCode(thirdDevice, pending));
  assert.match(formatCode(code), /^[A-F0-9]{4}( [A-F0-9]{4}){3}$/);
  assert.notEqual(await fingerprint(root), await fingerprint(thirdDevice));
});
