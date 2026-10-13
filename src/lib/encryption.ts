import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const CIPHERTEXT_PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY is not set");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("APP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
  }
  return Buffer.from(raw, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${CIPHERTEXT_PREFIX}${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith(CIPHERTEXT_PREFIX)) {
    throw new Error("Encrypted value has an unrecognized format");
  }
  const [iv, authTag, data] = payload.slice(CIPHERTEXT_PREFIX.length).split(".");
  if (!iv || !authTag || !data) {
    throw new Error("Encrypted value is malformed");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}