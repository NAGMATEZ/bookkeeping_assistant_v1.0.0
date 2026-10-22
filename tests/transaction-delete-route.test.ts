// spec: transactions table Delete button must be wired to a real endpoint that removes the row.
// expected: DELETE /api/transactions/:id → { ok: true } and the row no longer exists.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { DELETE } from "@/app/api/transactions/[id]/route";
import { transactions } from "@/db/schema";
import { db } from "@/lib/db";

function callDelete(id: string): Promise<Response> {
  return DELETE(new Request("http://localhost/api/transactions/x", { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("DELETE /api/transactions/[id]", () => {
  it("deletes the transaction and returns ok", async () => {
    const [row] = await db
      .insert(transactions)
      .values({ date: 20260120, amount_minor: -500, currency_code: "HUF", category: "RouteDelete", project: "", description: "" })
      .returning();

    const response = await callDelete(row.id);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(await db.select().from(transactions).where(eq(transactions.id, row.id))).toHaveLength(0);
  });
});