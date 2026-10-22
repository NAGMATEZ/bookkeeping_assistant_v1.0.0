// spec: startup gate = env var present + real SELECT 1; a missing DATABASE_URL fails before any DB work,
//       and a failed SELECT 1 fails without leaking a stack to the caller.
// expected: missing DATABASE_URL → { ok:false, reason:"Missing required environment variable: DATABASE_URL" }, db.run never called;
//           db.run rejects "connection refused" → { ok:false, reason:"connection refused" },
//           console.error received the full error incl. stack; db.run resolves → { ok:true }.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { run: runMock } }));

import { checkStartup } from "@/lib/startup-gate";

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  runMock.mockReset();
  vi.stubEnv("DATABASE_URL", "libsql://test.turso.io?authToken=test-token");
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("checkStartup", () => {
  it("fails on a missing env var without querying the database", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const result = await checkStartup();

    expect(result).toEqual({
      ok: false,
      reason: "Missing required environment variable: DATABASE_URL",
    });
    expect(runMock).not.toHaveBeenCalled();
  });

  it("fails when the SELECT 1 check throws, logging the full error", async () => {
    const error = new Error("connection refused");
    error.stack = "Error: connection refused\n    at connect (C:\\app\\src\\lib\\db.ts:12:7)";
    runMock.mockRejectedValueOnce(error);

    const result = await checkStartup();

    expect(result).toEqual({ ok: false, reason: "connection refused" });
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "[startup gate]",
      expect.objectContaining({ stack: expect.stringContaining("db.ts:12:7") }),
    );
  });

  it("passes when the SELECT 1 check succeeds", async () => {
    runMock.mockResolvedValueOnce(undefined);

    const result = await checkStartup();

    expect(result).toEqual({ ok: true });
  });
});
