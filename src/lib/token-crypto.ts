import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts raw QR tokens so they can be re-printed later. Format: v1.<iv>.<tag>.<ciphertext> (base64url).
// QR_TOKEN_KEY must be 32 random bytes, base64 encoded (`openssl rand -base64 32`).

function key(): Buffer {
  const raw = process.env.QR_TOKEN_KEY;
  const k = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new Error("QR_TOKEN_KEY must be 32 bytes, base64 encoded");
  return k;
}

export function hasTokenKey(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptToken(value: string): string {
  const [version, iv, tag, ct] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ct) throw new Error("Unknown token format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
