// spec: every catch block logs the full error (stack included) via console.error before responding; the client
//       body always carries a specific message and never a stack trace or file path; secret values are redacted from logs.
// expected: (1) logFailure → console.error receives an object whose stack contains "route.ts:42:9";
//           (2) provider-style Error("connection refused") → client message "connection refused", status preserved;
//           (3) ENOENT message with C:\Users\x\secret\file.pdf → "[path]", never the real path;
//           (4) message containing the stubbed PRIMARY_API_KEY → logged message has "[REDACTED]";
//           (5) message containing the stubbed TURSO_DATABASE_URL → logged message has "[REDACTED]".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { failureResponse, logFailure } from "@/lib/diagnostics";

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleError.mockRestore();
  vi.unstubAllEnvs();
});

describe("logFailure", () => {
  it("logs the full error object including stack", () => {
    const error = new Error("connection refused");
    error.stack = "Error: connection refused\n    at handleUpload (C:\\app\\src\\app\\api\\upload\\route.ts:42:9)";

    logFailure("invoice upload", error);

    expect(consoleError).toHaveBeenCalledWith(
      "[invoice upload]",
      expect.objectContaining({
        name: "Error",
        message: "connection refused",
        stack: expect.stringContaining("route.ts:42:9"),
      }),
    );
  });

  it("redacts secret environment values from the logged message", () => {
    vi.stubEnv("PRIMARY_API_KEY", "sk-live-12345");
    const error = new Error("401 Unauthorized: key sk-live-12345 was rejected");

    logFailure("llm dispatch", error);

    expect(consoleError).toHaveBeenCalledWith(
      "[llm dispatch]",
      expect.objectContaining({ message: "401 Unauthorized: key [REDACTED] was rejected" }),
    );
  });

  it("redacts the Turso database URL from logs", () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://db.turso.io?authToken=super-secret");
    const error = new Error(
      "failed to connect to libsql://db.turso.io?authToken=super-secret",
    );

    logFailure("db boot", error);

    expect(consoleError).toHaveBeenCalledWith(
      "[db boot]",
      expect.objectContaining({ message: "failed to connect to [REDACTED]" }),
    );
  });
});

describe("failureResponse", () => {
  it("returns the specific provider message and keeps the status", () => {
    const result = failureResponse("llm dispatch", new Error("connection refused"), "Upload failed", 502);

    expect(result).toEqual({ message: "connection refused", status: 502 });
  });

  it("strips filesystem paths but keeps a specific message", () => {
    const error = new Error("ENOENT: no such file or directory, open 'C:\\Users\\x\\secret\\file.pdf'");

    const result = failureResponse("invoice upload", error, "Upload failed");

    expect(result.message).toBe("ENOENT: no such file or directory, open '[path]'");
    expect(result.message).not.toContain("C:\\Users");
  });

  it("falls back to the caller-provided specific message when there is no usable detail", () => {
    const result = failureResponse("invoice upload", "", "Invoice upload failed: provider rejected the file");

    expect(result).toEqual({ message: "Invoice upload failed: provider rejected the file", status: 500 });
  });
});