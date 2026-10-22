// spec: Settings save must actually write to the Settings table, encrypt *_API_KEY before storage, and convert a
//       decimal OPENING_BALANCE to minor units at the API boundary under OPENING_BALANCE_<DEFAULT_CURRENCY>.
// expected (hand-derived): "1 000,00" → stored OPENING_BALANCE_USD value "100000"; PRIMARY_API_KEY "test-key"
//   → stored value starts "enc:v1:" and decrypts back to "test-key"; an empty API key leaves the stored value
//   untouched (updated count 0); unparseable balance → 400 and no new row; startup gate failure → 503.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
  process.env.APP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

import { POST } from "@/app/api/settings/route";
import { settings } from "@/db/schema";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function readSetting(key: string): Promise<string | undefined> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("DATABASE_URL", ":memory:");
});

describe("POST /api/settings", () => {
  it("stores non-secret values and an encrypted API key", async () => {
    const response = await post({
      PRIMARY_BASE_URL: "https://api.test/v1",
      PRIMARY_MODEL: "vision-model",
      PRIMARY_API_KEY: "test-key",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, updated: 3 });
    await expect(readSetting("PRIMARY_BASE_URL")).resolves.toBe("https://api.test/v1");

    const storedKey = await readSetting("PRIMARY_API_KEY");
    expect(storedKey?.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(storedKey ?? "")).toBe("test-key");
  });

  it("converts the opening balance decimal string to minor units", async () => {
    const response = await post({ DEFAULT_CURRENCY: "USD", OPENING_BALANCE: "1 000,00" });

    expect(response.status).toBe(200);
    await expect(readSetting("OPENING_BALANCE_USD")).resolves.toBe("100000");
  });

  it("leaves the stored API key unchanged when an empty value is submitted", async () => {
    await post({
      PRIMARY_BASE_URL: "https://api.test/v1",
      PRIMARY_MODEL: "vision-model",
      PRIMARY_API_KEY: "keep-me",
    });

    const response = await post({ PRIMARY_API_KEY: "" });

    await expect(response.json()).resolves.toEqual({ ok: true, updated: 0 });
    const storedKey = await readSetting("PRIMARY_API_KEY");
    expect(decryptSecret(storedKey ?? "")).toBe("keep-me");
  });

  it("requires base URL, model, and key when any primary field is submitted", async () => {
    await db.delete(settings).where(eq(settings.key, "PRIMARY_MODEL"));

    const response = await post({ PRIMARY_BASE_URL: "https://api.test/v1" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Primary model is required",
    });
  });

  it("clears the optional secondary provider when its fields are emptied", async () => {
    await post({
      PRIMARY_BASE_URL: "https://api.test/v1",
      PRIMARY_MODEL: "vision-model",
      PRIMARY_API_KEY: "primary-key",
      SECONDARY_BASE_URL: "https://backup.test/v1",
      SECONDARY_MODEL: "backup-model",
      SECONDARY_API_KEY: "backup-key",
    });
    expect(await readSetting("SECONDARY_BASE_URL")).toBe("https://backup.test/v1");

    const response = await post({
      SECONDARY_BASE_URL: "",
      SECONDARY_MODEL: "",
      SECONDARY_API_KEY: "",
    });

    expect(response.status).toBe(200);
    await expect(readSetting("SECONDARY_BASE_URL")).resolves.toBeUndefined();
    await expect(readSetting("SECONDARY_MODEL")).resolves.toBeUndefined();
    await expect(readSetting("SECONDARY_API_KEY")).resolves.toBeUndefined();
  });

  it("rejects an unparseable opening balance without writing a row", async () => {
    const response = await post({ DEFAULT_CURRENCY: "EUR", OPENING_BALANCE: "not-a-number" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: 'Invalid opening balance — Invalid amount: "not-a-number"',
    });
    await expect(readSetting("OPENING_BALANCE_EUR")).resolves.toBeUndefined();
  });

  it("rejects unknown payload fields", async () => {
    const response = await post({ UNKNOWN_FIELD: "x" });

    expect(response.status).toBe(400);
  });

  it("returns the startup gate reason with status 503 when the database env is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await post({ PRIMARY_MODEL: "whatever" });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Missing required environment variable: DATABASE_URL",
    });
  });
});