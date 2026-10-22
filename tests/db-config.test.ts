// spec: Item 0 reads exactly TURSO_DATABASE_URL and TURSO_AUTH_TOKEN; both are required.
// expected: both present → { url, authToken }; url only → missing ["TURSO_AUTH_TOKEN"]; token only →
//           missing ["TURSO_DATABASE_URL"]; neither → both; whitespace-only counts as missing.
import { describe, expect, it } from "vitest";

import { missingDatabaseEnvVars, resolveDatabaseConfig } from "@/lib/db-config";

describe("resolveDatabaseConfig", () => {
  it("returns the Turso URL and auth token", () => {
    const config = resolveDatabaseConfig({
      TURSO_DATABASE_URL: "libsql://bookkeeping.turso.io",
      TURSO_AUTH_TOKEN: "tok-123",
    });

    expect(config).toEqual({ url: "libsql://bookkeeping.turso.io", authToken: "tok-123" });
  });

  it("throws when the database URL is missing", () => {
    expect(() => resolveDatabaseConfig({ TURSO_AUTH_TOKEN: "tok-123" })).toThrow(
      /TURSO_DATABASE_URL/,
    );
  });

  it("throws when the auth token is missing", () => {
    expect(() => resolveDatabaseConfig({ TURSO_DATABASE_URL: "libsql://x.turso.io" })).toThrow(
      /TURSO_AUTH_TOKEN/,
    );
  });

  it("throws when both are missing", () => {
    expect(() => resolveDatabaseConfig({})).toThrow(/TURSO_DATABASE_URL.*TURSO_AUTH_TOKEN/);
  });

  it("treats whitespace-only values as missing", () => {
    expect(() =>
      resolveDatabaseConfig({
        TURSO_DATABASE_URL: "   ",
        TURSO_AUTH_TOKEN: "  ",
      }),
    ).toThrow(/TURSO_DATABASE_URL.*TURSO_AUTH_TOKEN/);
  });
});

describe("missingDatabaseEnvVars", () => {
  it("reports nothing missing when both are set", () => {
    expect(
      missingDatabaseEnvVars({
        TURSO_DATABASE_URL: "libsql://x.turso.io",
        TURSO_AUTH_TOKEN: "tok-123",
      }),
    ).toEqual([]);
  });

  it("reports the token when only the URL is set", () => {
    expect(missingDatabaseEnvVars({ TURSO_DATABASE_URL: "libsql://x.turso.io" })).toEqual([
      "TURSO_AUTH_TOKEN",
    ]);
  });

  it("reports the URL when only the token is set", () => {
    expect(missingDatabaseEnvVars({ TURSO_AUTH_TOKEN: "tok-123" })).toEqual([
      "TURSO_DATABASE_URL",
    ]);
  });

  it("reports both when neither is set", () => {
    expect(missingDatabaseEnvVars({})).toEqual(["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]);
  });
});
