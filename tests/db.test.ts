// spec: exactly one shared Turso client/Drizzle instance for the whole app (globalThis-cached in dev), with
// PRAGMA foreign_keys = ON set on that client — otherwise schema ON DELETE SET NULL is silently ignored.
// expected: (1) two imports of @/lib/db return the identical db/client objects;
//           (2) deleting an invoice linked to a transaction → transaction.source_invoice_id === null (proves pragma is in effect).
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { invoices, transactions } from "@/db/schema";
import type { Database } from "@/lib/db";

let db: Database;
let client: Client;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", ":memory:");
  const dbModule = await import("@/lib/db");
  db = dbModule.db;
  client = dbModule.client;
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterAll(() => {
  vi.unstubAllEnvs();
  client.close();
});

describe("@/lib/db singleton", () => {
  it("returns the same instance on repeated imports, including after a module reset", async () => {
    const first = await import("@/lib/db");
    vi.resetModules();
    const second = await import("@/lib/db");

    expect(second.client).toBe(first.client);
    expect(second.db).toBe(first.db);
  });

  it("has PRAGMA foreign_keys = ON: deleting an invoice nulls the linked transaction's source_invoice_id", async () => {
    const [invoice] = await db
      .insert(invoices)
      .values({
        vendor: "Acme",
        date: 20260115,
        total_minor: 5000,
        currency_code: "USD",
        project: "P1",
        status: "needs_review",
        line_items: JSON.stringify([{ description: "Widget", amount_minor: 5000 }]),
        raw_llm_response: "{}",
      })
      .returning();

    const [transaction] = await db
      .insert(transactions)
      .values({
        date: 20260115,
        amount_minor: -5000,
        currency_code: "USD",
        category: "Invoice",
        project: "P1",
        source_invoice_id: invoice.id,
      })
      .returning();

    await db.delete(invoices).where(eq(invoices.id, invoice.id));

    const linked = await db.select().from(transactions).where(eq(transactions.id, transaction.id));

    expect(linked[0].source_invoice_id).toBeNull();
  });
});