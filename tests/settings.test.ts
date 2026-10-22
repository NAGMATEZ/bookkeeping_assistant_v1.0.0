// spec: Settings KV fallback is DB Settings → env var of the identical name → (caller) guardrail;
//       OPENING_BALANCE_<CODE> is stored as integer minor units.
// expected (hand-derived): DB DEFAULT_CURRENCY=USD beats env DEFAULT_CURRENCY=EUR → { value:"USD", source:"db" };
//   no DB row + env FALLBACK_TEST_KEY="from-env" → { value:"from-env", source:"env" }; neither → null;
//   DB OPENING_BALANCE_USD="100000" → 100000; missing key → 0 (SUBMISSION_NOTES #4); "1000.5" → specific throw.
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { settings } from "@/db/schema";
import { db } from "@/lib/db";
import { getOpeningBalanceMinor, resolveSetting } from "@/lib/settings";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("resolveSetting", () => {
  it("prefers a DB value over an env var with the same name", async () => {
    await db.insert(settings).values({ key: "DEFAULT_CURRENCY", value: "USD" });
    vi.stubEnv("DEFAULT_CURRENCY", "EUR");

    await expect(resolveSetting("DEFAULT_CURRENCY")).resolves.toEqual({ value: "USD", source: "db" });
  });

  it("falls back to the env var when the DB has no value", async () => {
    vi.stubEnv("FALLBACK_TEST_KEY", "from-env");

    await expect(resolveSetting("FALLBACK_TEST_KEY")).resolves.toEqual({ value: "from-env", source: "env" });
  });

  it("returns null when neither DB nor env has the key", async () => {
    await expect(resolveSetting("MISSING_KEY_XYZ")).resolves.toBeNull();
  });
});

describe("getOpeningBalanceMinor", () => {
  it("reads stored minor units for the given currency", async () => {
    await db.insert(settings).values({ key: "OPENING_BALANCE_USD", value: "100000" });

    await expect(getOpeningBalanceMinor("USD")).resolves.toBe(100000);
  });

  it("reads a missing opening balance as zero minor units", async () => {
    await expect(getOpeningBalanceMinor("HUF")).resolves.toBe(0);
  });

  it("rejects a non-integer stored value", async () => {
    await db.insert(settings).values({ key: "OPENING_BALANCE_EUR", value: "1000.5" });

    await expect(getOpeningBalanceMinor("EUR")).rejects.toThrow(
      "OPENING_BALANCE_EUR must be an integer number of minor units",
    );
  });
});