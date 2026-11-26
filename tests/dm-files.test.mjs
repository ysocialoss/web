import assert from "node:assert/strict";
import test from "node:test";
import { decryptFile, encryptFile, fileBinding } from "../src/features/dms/dm-files.ts";

const conversation = "6b3f2c9e-1d44-4c8a-9a3b-0f1e2d3c4b5a";
const attachment = "0f1e2d3c-4b5a-4c8a-9a3b-6b3f2c9e1d44";

test("bound files decrypt only for their conversation and attachment id", async () => {
  const plain = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);
  const { data, key, iv } = await encryptFile(plain, fileBinding(conversation, attachment));
  const opened = await decryptFile(data, key, iv, "application/pdf", fileBinding(conversation, attachment));
  assert.deepEqual(new Uint8Array(await opened.arrayBuffer()), new Uint8Array([1, 2, 3, 4, 5]));
  assert.equal(opened.type, "application/pdf");
  await assert.rejects(decryptFile(data, key, iv, "application/pdf", fileBinding(conversation, conversation)));
  await assert.rejects(decryptFile(data, key, iv, "application/pdf"));
});

test("voice notes without a binding keep working", async () => {
  const { data, key, iv } = await encryptFile(new Blob(["hi"]));
  assert.equal(await (await decryptFile(data, key, iv, "audio/webm")).text(), "hi");
});
