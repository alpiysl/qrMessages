import { createHash, randomBytes } from "node:crypto";

// 24 random bytes -> 32 char base64url token (192 bits of entropy).
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}
