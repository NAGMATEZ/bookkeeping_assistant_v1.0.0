// spec: Item 0 resolves the database connection from a single DATABASE_URL carrying the libSQL/Turso URL with the
//       auth token embedded as ?authToken=; no separate token variable exists.
// expected: a present DATABASE_URL → { url }; whitespace-only → treated as missing and throws; nothing set → throws.
import { describe, expect, it } from "vitest";

import { missingDatabaseEnvVars, resolveDatabaseConfig } from "@/lib/db-config";

describe("resolveDatabaseConfig", () => {
  it("returns the single DATABASE_URL, token embedded", () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: "libsql://bookkeeping.turso.io?authToken=embedded",
    });

    expect(config).toEqual({ url: "libsql://bookkeeping.turso.io?authToken=embedded" });
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() => resolveDatabaseConfig({})).toThrow(/DATABASE_URL/);
  });

  it("treats a whitespace-only DATABASE_URL as unset", () => {
    expect(() => resolveDatabaseConfig({ DATABASE_URL: "   " })).toThrow(/DATABASE_URL/);
  });

  it("ignores the legacy TURSO_* variables", () => {
    expect(() =>
      resolveDatabaseConfig({
        TURSO_DATABASE_URL: "libsql://legacy.turso.io",
        TURSO_AUTH_TOKEN: "legacy-token",
      }),
    ).toThrow(/DATABASE_URL/);
  });
});

describe("missingDatabaseEnvVars", () => {
  it("reports nothing missing when DATABASE_URL is set", () => {
    expect(missingDatabaseEnvVars({ DATABASE_URL: "libsql://x.turso.io?authToken=t" })).toEqual([]);
  });

  it("reports DATABASE_URL as missing when unset", () => {
    expect(missingDatabaseEnvVars({})).toEqual(["DATABASE_URL"]);
  });

  it("reports DATABASE_URL as missing when whitespace-only", () => {
    expect(missingDatabaseEnvVars({ DATABASE_URL: "   " })).toEqual(["DATABASE_URL"]);
  });
});
