// spec: import persistence writes mapped rows to transactions with the inferred sign in DEFAULT_CURRENCY;
//   unparseable-date rows are skipped by the mapper and reported, never thrown.
// expected (hand-derived): records [expense -5000, income +1000] with DEFAULT_CURRENCY HUF → 2 rows with
//   amount_minor -5000/+1000 and currency_code HUF; empty category → "Imported"; unset DEFAULT_CURRENCY → HUF fallback.
// skipDuplicates: re-persisting the same record inserts 0 and reports 1 duplicate; 1201 unique rows insert 1201
//   (chunked inserts stay below the SQLite parameter limit).
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
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

    expect(result).toEqual({ ok: true, inserted: 2, skippedDuplicates: 0 });
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

  it("falls back to HUF when DEFAULT_CURRENCY is not configured", async () => {
    await db.delete(settings).where(eq(settings.key, "DEFAULT_CURRENCY"));
    const marker = `persist-default-${Math.random()}`;

    await expect(persistImport([record({ project: marker })])).resolves.toEqual({
      ok: true,
      inserted: 1,
      skippedDuplicates: 0,
    });
    const stored = await db.select().from(transactions).where(eq(transactions.project, marker));
    expect(stored[0].currency_code).toBe("HUF");

    await db
      .insert(settings)
      .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
  });

  it("skips records already imported when skipDuplicates is enabled", async () => {
    await db
      .insert(settings)
      .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
    const marker = `persist-dedupe-${Math.random()}`;
    const row = record({ project: marker });

    await expect(persistImport([row], "csv", { skipDuplicates: true })).resolves.toEqual({
      ok: true,
      inserted: 1,
      skippedDuplicates: 0,
    });
    await expect(persistImport([row], "csv", { skipDuplicates: true })).resolves.toEqual({
      ok: true,
      inserted: 0,
      skippedDuplicates: 1,
    });

    const stored = await db.select().from(transactions).where(eq(transactions.project, marker));
    expect(stored).toHaveLength(1);
  });

  it("inserts large batches in chunks instead of one oversized statement", async () => {
    await db
      .insert(settings)
      .values({ key: "DEFAULT_CURRENCY", value: "HUF" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "HUF" } });
    const marker = `persist-chunk-${Math.random()}`;
    const rows = Array.from({ length: 1201 }, (_, index) =>
      record({ rowIndex: index, project: marker, description: `row ${index}` }),
    );

    await expect(persistImport(rows)).resolves.toEqual({
      ok: true,
      inserted: 1201,
      skippedDuplicates: 0,
    });

    const stored = await db.select().from(transactions).where(eq(transactions.project, marker));
    expect(stored).toHaveLength(1201);
  });
});