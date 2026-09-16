// AES-256-GCM encryption for sensitive payout details (bank account numbers).
// PAYOUT_ENCRYPTION_KEY must be a 64-char hex string (32 random bytes).
//
// Generate:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Storage format: `${ivHex}.${ciphertextHex}.${tagHex}` — single column, no
// padding or schema fragmentation. Rotating the key would require a one-time
// re-encrypt pass; for MVP we treat the key as long-lived.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "PAYOUT_ENCRYPTION_KEY is not set. Generate one with: " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  if (hex.length !== 64 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(
      "PAYOUT_ENCRYPTION_KEY must be 64 hex characters (32 bytes).",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptPayoutField(plain: string): string {
  if (!plain) throw new Error("encryptPayoutField: empty input");
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${enc.toString("hex")}.${tag.toString("hex")}`;
}


