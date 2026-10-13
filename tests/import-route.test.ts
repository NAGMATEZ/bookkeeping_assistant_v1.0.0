// spec: import endpoint maps with precedence sign < direction column < per-row override, persists all rows in
//   DEFAULT_CURRENCY, and reports unparseable rows instead of throwing.
// expected (hand-derived): CSV rows "-5,00" (expense) and "100,00" + direction "income"; override {"0":true}
//   → inserted 2, amounts +500 and +10000, currency HUF; the "2024-02-30" row is skipped and reported at rowIndex 2.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { POST } from "@/app/api/import/route";
import { settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";

function importRequest(): Request {
  const csv = [
    "date;description;amount;direction;category;project",
    "2026-01-15;Coffee;-5,00;;Office;ImportRoute",
    "2026-01-16;Salary;100,00;income;Work;ImportRoute",
    "2024-02-30;Bad date;10,00;;Office;ImportRoute",
    "",
  ].join("\n");
  const form = new FormData();
  form.append("file", new File([new TextEncoder().encode(csv)], "import.csv", { type: "text/csv" }));
  form.append("mapping", JSON.stringify({ date: 0, description: 1, amount: 2, direction: 3, category: 4, project: 5 }));
  form.append("overrides", JSON.stringify({ "0": true }));
  return new Request("http://localhost/api/import", { method: "POST", body: form });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db
    .insert(settings)
    .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
});

describe("POST /api/import", () => {
  it("applies overrides over the sign, persists in DEFAULT_CURRENCY, and reports skipped rows", async () => {
    const response = await POST(importRequest());
    const body = (await response.json()) as { ok: boolean; inserted: number; skipped: Array<{ rowIndex: number }> };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(2);
    expect(body.skipped).toEqual([{ rowIndex: 2, reason: 'Invalid or missing date "2024-02-30"' }]);

    const stored = await db.select().from(transactions).where(eq(transactions.project, "ImportRoute"));
    expect(stored.map((row) => row.amount_minor).sort((a, b) => a - b)).toEqual([500, 10000]);
    expect(stored.every((row) => row.currency_code === "HUF")).toBe(true);
    expect(stored.find((row) => row.amount_minor === 500)?.description).toBe("Coffee");
  });
});