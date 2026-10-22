// spec: destructive "delete all data" is server-guarded by a typed confirmation, not just a client click,
//   and removes transactions, invoices, and settings in one request.
// expected (hand-derived): seeded 1 invoice + 1 linked transaction + 1 setting → { ok:true,
//   deleted:{transactions:1,invoices:1,settings:1} }; tables empty afterwards; a missing/wrong confirmation
//   → 400 and all rows still present.
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { POST } from "@/app/api/reset/route";
import { invoices, settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function seed(): Promise<void> {
  await db.insert(invoices).values({
    id: "reset-invoice",
    vendor: "V",
    date: 20260115,
    total_minor: 500,
    currency_code: "USD",
    project: "",
    status: "confirmed",
    line_items: "[]",
    raw_llm_response: "{}",
  });
  await db.insert(transactions).values({
    id: "reset-tx",
    date: 20260115,
    amount_minor: -500,
    currency_code: "USD",
    category: "Office",
    project: "",
    description: "",
    source_invoice_id: "reset-invoice",
  });
  await db.insert(settings).values({ key: "DEFAULT_CURRENCY", value: "USD" });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("POST /api/reset", () => {
  it("rejects a missing or wrong typed confirmation without deleting anything", async () => {
    await seed();

    const missing = await post({ confirm: true });
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      message: 'Reset requires { "confirm": true, "confirmation": "DELETE" }',
    });

    const wrong = await post({ confirm: true, confirmation: "delete" });
    expect(wrong.status).toBe(400);
    expect(await db.select().from(transactions)).toHaveLength(1);
    expect(await db.select().from(invoices)).toHaveLength(1);
    expect(await db.select().from(settings)).toHaveLength(1);
  });

  it("deletes every transaction, invoice, and setting", async () => {
    const response = await post({ confirm: true, confirmation: "DELETE" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deleted: { transactions: 1, invoices: 1, settings: 1 },
    });
    expect(await db.select().from(transactions)).toEqual([]);
    expect(await db.select().from(invoices)).toEqual([]);
    expect(await db.select().from(settings)).toEqual([]);
  });
});
