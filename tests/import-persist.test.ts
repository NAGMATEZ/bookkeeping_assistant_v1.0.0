// spec: import persistence writes mapped rows to transactions with the inferred sign in DEFAULT_CURRENCY;
//   unparseable-date rows are skipped by the mapper and reported, never thrown.
// expected (hand-derived): records [expense -5000, income +1000] with DEFAULT_CURRENCY HUF → 2 rows with
//   amount_minor -5000/+1000 and currency_code HUF; empty category → "Imported"; missing DEFAULT_CURRENCY → 503.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import type { MappedImportRecord } from "@/lib/import-map";
import { persistImport } from "@/lib/import-persist";

function record(overrides: Partial<MappedImportRecord> = {}): MappedImportRecord {
  return {
    rowIndex: 0,
    date: "2026-01-15",
    dateInt: 20260115,
    description: "Imported row",
    amountMinor: -5000,
    category: "Office",
    project: "P1",
    ...overrides,
  };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("persistImport", () => {
  it("inserts mapped records with their signs in DEFAULT_CURRENCY", async () => {
    await db
      .insert(settings)
      .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });

    const marker = `persist-${Math.random()}`;
    const result = await persistImport([
      record({ project: marker, amountMinor: -5000 }),
      record({ rowIndex: 1, project: marker, amountMinor: 1000, category: "" }),
    ]);

    expect(result).toEqual({ ok: true, inserted: 2 });
    const stored = await db.select().from(transactions).where(eq(transactions.project, marker));
    expect(stored).toHaveLength(2);
    expect(stored.map((row) => row.amount_minor).sort((a, b) => a - b)).toEqual([-5000, 1000]);
    expect(stored.every((row) => row.currency_code === "HUF")).toBe(true);
    expect(stored.find((row) => row.amount_minor === 1000)?.category).toBe("Imported");
    expect(stored.every((row) => row.source === "csv")).toBe(true);
  });

  it("tags XLSX imports distinctly", async () => {
    await db
      .insert(settings)
      .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
    const marker = `persist-xlsx-${Math.random()}`;

    await persistImport([record({ project: marker })], "xlsx");

    const stored = await db.select().from(transactions).where(eq(transactions.project, marker));
    expect(stored[0].source).toBe("xlsx");
  });

  it("fails with a specific message when DEFAULT_CURRENCY is missing", async () => {
    await db.delete(settings).where(eq(settings.key, "DEFAULT_CURRENCY"));

    await expect(persistImport([record()])).resolves.toEqual({
      ok: false,
      status: 503,
      message: "DEFAULT_CURRENCY is not set. Configure it in Settings before importing transactions.",
    });

    await db
      .insert(settings)
      .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
  });
});