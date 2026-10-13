// spec: manual entry endpoint — decimal amount signed by isIncome, persisted in DEFAULT_CURRENCY.
// expected: POST { date:"2026-01-20", amount:"12.34", isIncome:false } with DEFAULT_CURRENCY HUF → 200 and stored
//   amount_minor -1234; invalid body (isIncome missing) → 400 invalid payload.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { POST } from "@/app/api/transactions/route";
import { settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db
    .insert(settings)
    .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
});

describe("POST /api/transactions", () => {
  it("persists a $12.34 expense as -1234 minor units", async () => {
    const response = await post({
      date: "2026-01-20",
      amount: "12.34",
      isIncome: false,
      category: "Office",
      project: "P1",
      description: "Printer paper",
    });
    const body = (await response.json()) as { ok: boolean; transactionId: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    const stored = await db.select().from(transactions).where(eq(transactions.id, body.transactionId));
    expect(stored[0].amount_minor).toBe(-1234);
    expect(stored[0].currency_code).toBe("HUF");
    expect(stored[0].description).toBe("Printer paper");
  });

  it("rejects an invalid payload with a specific message", async () => {
    const response = await post({ date: "2026-01-20", amount: "12.34", category: "Office" });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain("Invalid transaction payload");
  });
});