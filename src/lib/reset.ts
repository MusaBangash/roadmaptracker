import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Story 2: one-time password reset links. Only a SHA-256 hash of the token is stored, so a copy of
// the database can't be used to reset anyone's password.

export const RESET_HOURS = 1;

export function newResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
