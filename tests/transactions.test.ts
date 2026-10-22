// spec: manual entry — Amount decimal→minor units, Income/Expense toggle sets the sign, entries are always
//   DEFAULT_CURRENCY; description persists; list filters by project/category/date range; delete removes the row.
// expected (hand-derived): submit 12.34 as expense with DEFAULT_CURRENCY HUF → amount_minor -1234, currency HUF,
//   source "manual"; as income → +1234; an explicit "-12.34" with isIncome true still stores -1234 (sign wins,
//   matching the auto-toggle); date "2024-02-30" → 400 invalid date; amount zero → 400; missing DEFAULT_CURRENCY
//   → 503; date-range filter [2026-01-01, 2026-01-31] excludes a 2025-12-31 row; delete removes only the target row.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = ":memory:";
});

import { settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import {
  createManualTransaction,
  deleteTransaction,
  listTransactions,
} from "@/lib/transactions";

async function setDefaultCurrency(code: string | null): Promise<void> {
  await db.delete(settings).where(eq(settings.key, "DEFAULT_CURRENCY"));
  if (code) {
    await db.insert(settings).values({ key: "DEFAULT_CURRENCY", value: code });
  }
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createManualTransaction", () => {
  it("persists an expense as a negative minor-unit amount in DEFAULT_CURRENCY", async () => {
    await setDefaultCurrency("HUF");

    const result = await createManualTransaction({
      date: "2026-01-20",
      amount: "12.34",
      isIncome: false,
      category: "Office",
      project: "P1",
      description: "Printer paper",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction).toMatchObject({
      amount_minor: -1234,
      currency_code: "HUF",
      date: 20260120,
      category: "Office",
      project: "P1",
      description: "Printer paper",
      source: "manual",
    });
  });

  it("persists an income as a positive minor-unit amount", async () => {
    await setDefaultCurrency("HUF");

    const result = await createManualTransaction({
      date: "2026-01-21",
      amount: "12.34",
      isIncome: true,
      category: "Sales",
      project: "",
      description: "",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.amount_minor).toBe(1234);
  });

  it("lets an explicit negative sign override the Income toggle", async () => {
    await setDefaultCurrency("HUF");

    const result = await createManualTransaction({
      date: "2026-01-22",
      amount: "-12.34",
      isIncome: true,
      category: "Office",
      project: "",
      description: "",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.amount_minor).toBe(-1234);
  });

  it("rejects invalid dates, zero amounts, and a missing default currency", async () => {
    await setDefaultCurrency("HUF");

    await expect(
      createManualTransaction({
        date: "2024-02-30",
        amount: "10",
        isIncome: false,
        category: "Office",
        project: "",
        description: "",
      }),
    ).resolves.toEqual({
      ok: false,
      status: 400,
      message: 'Invalid date (expected YYYY-MM-DD within 1900–2100): "2024-02-30"',
    });

    await expect(
      createManualTransaction({
        date: "2026-01-01",
        amount: "0",
        isIncome: false,
        category: "Office",
        project: "",
        description: "",
      }),
    ).resolves.toEqual({ ok: false, status: 400, message: "Amount must not be zero" });

    await setDefaultCurrency(null);
    await expect(
      createManualTransaction({
        date: "2026-01-01",
        amount: "10",
        isIncome: false,
        category: "Office",
        project: "",
        description: "",
      }),
    ).resolves.toEqual({
      ok: false,
      status: 503,
      message: "DEFAULT_CURRENCY is not set. Configure it in Settings before entering transactions.",
    });
  });
});

describe("listTransactions", () => {
  it("filters by category and date range", async () => {
    await db.insert(transactions).values([
      { date: 20251231, amount_minor: -100, currency_code: "HUF", category: "FilterFuel", project: "RangeTest", description: "" },
      { date: 20260115, amount_minor: -200, currency_code: "HUF", category: "FilterFuel", project: "RangeTest", description: "" },
      { date: 20260201, amount_minor: -300, currency_code: "HUF", category: "FilterOther", project: "RangeTest", description: "" },
    ]);

    const inRange = await listTransactions({
      category: "FilterFuel",
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(inRange).toHaveLength(1);
    expect(inRange[0].date).toBe(20260115);
    expect(inRange[0].amount_minor).toBe(-200);
  });
});

describe("deleteTransaction", () => {
  it("removes only the targeted row and returns void", async () => {
    await db.insert(transactions).values([
      { date: 20260110, amount_minor: -111, currency_code: "HUF", category: "FilterDelete", project: "DeleteTest", description: "keep" },
      { date: 20260111, amount_minor: -222, currency_code: "HUF", category: "FilterDelete", project: "DeleteTest", description: "remove" },
    ]);
    const [target] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.description, "remove"));

    const result = await deleteTransaction(target.id);

    expect(result).toBeUndefined();
    const remaining = await db
      .select()
      .from(transactions)
      .where(eq(transactions.project, "DeleteTest"));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].description).toBe("keep");
  });
});