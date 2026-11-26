/** Base64 for keys and ciphertext. Builds the string in a loop, so multi-MB inputs don't overflow the call stack. */
export function toBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
