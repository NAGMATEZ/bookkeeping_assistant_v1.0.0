// spec: Item 2 — PDF cap 15MB pre-base64, reject at API boundary before dispatch; rate-limit uploads per
//       session/IP against runaway retry cost (SUBMISSION_NOTES #6: cap applies to all accepted types, 10/10min).
// expected (hand-derived): 16 MiB PDF (16777216 bytes > 15728640) → rejected with "File is too large (16.0 MB)";
//   10 requests at t=0..9000ms → allowed, 11th at t=10000ms → denied (oldest at t=0 expires at t=600000ms, so
//   retryAfterSeconds = (600000-10000)/1000 = 590); after the window slides (now + 600001ms) a new request is
//   allowed; a .txt upload → unsupported-type rejection.
import { describe, expect, it } from "vitest";

import {
  checkUploadFile,
  checkUploadRateLimit,
  MAX_UPLOAD_BYTES,
  RATE_LIMIT_MAX_UPLOADS,
} from "@/lib/upload-guard";

describe("checkUploadFile", () => {
  it("rejects a 16MB PDF before any dispatch", () => {
    const verdict = checkUploadFile({
      name: "invoice.pdf",
      type: "application/pdf",
      size: 16 * 1024 * 1024,
    });

    expect(verdict).toEqual({
      ok: false,
      message: "File is too large (16.0 MB). The limit is 15 MB before base64 encoding.",
    });
  });

  it("accepts a file exactly at the cap and rejects one byte over", () => {
    expect(
      checkUploadFile({ name: "invoice.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES }),
    ).toEqual({ ok: true });
    expect(
      checkUploadFile({ name: "invoice.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 }).ok,
    ).toBe(false);
  });

  it("rejects unsupported file types", () => {
    const verdict = checkUploadFile({ name: "notes.txt", type: "text/plain", size: 100 });

    expect(verdict).toEqual({
      ok: false,
      message: 'Unsupported file type "text/plain". Upload a PNG, JPEG, WEBP, or PDF file.',
    });
  });
});

describe("checkUploadRateLimit", () => {
  it("allows the limit and rejects the next request in the same window", () => {
    const key = `rate-test-${Math.random()}`;
    const start = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_UPLOADS; i += 1) {
      expect(checkUploadRateLimit(key, start + i * 1000)).toEqual({ allowed: true });
    }

    const eleventh = checkUploadRateLimit(key, start + RATE_LIMIT_MAX_UPLOADS * 1000);

    expect(eleventh).toEqual({ allowed: false, retryAfterSeconds: 590 });
  });

  it("allows requests again once the window slides past the oldest request", () => {
    const key = `rate-window-${Math.random()}`;
    const start = 2_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_UPLOADS; i += 1) {
      checkUploadRateLimit(key, start + i);
    }
    expect(checkUploadRateLimit(key, start + 10).allowed).toBe(false);

    expect(checkUploadRateLimit(key, start + 600_001)).toEqual({ allowed: true });
  });
});