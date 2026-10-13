// spec: API keys are AES-256-GCM encrypted at rest via APP_ENCRYPTION_KEY and decrypted in-memory only when needed.
// expected (hand-derived): encrypt("test-key") → decrypt(...) === "test-key" exactly; ciphertext carries the
//   "enc:v1:" prefix and does not contain the plaintext; a second encryption of the same value differs (random IV);
//   tampering with ciphertext fails GCM auth instead of returning garbage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/encryption";

beforeEach(() => {
  vi.stubEnv("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips the exact plaintext", () => {
    const ciphertext = encryptSecret("test-key");

    expect(ciphertext.startsWith("enc:v1:")).toBe(true);
    expect(ciphertext).not.toContain("test-key");
    expect(decryptSecret(ciphertext)).toBe("test-key");
  });

  it("uses a random IV so the same value encrypts differently each time", () => {
    const first = encryptSecret("test-key");
    const second = encryptSecret("test-key");

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("test-key");
    expect(decryptSecret(second)).toBe("test-key");
  });

  it("rejects tampered ciphertext via the GCM auth tag", () => {
    const ciphertext = encryptSecret("test-key");
    const tampered = `${ciphertext.slice(0, -1)}${ciphertext.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("fails with a specific error when the key is missing", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "");

    expect(() => encryptSecret("test-key")).toThrow("APP_ENCRYPTION_KEY is not set");
  });
});