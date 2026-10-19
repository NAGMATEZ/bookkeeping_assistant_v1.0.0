// spec: dashboard math — Pending = count of needs_review; Net Monthly Delta = current calendar month SUM only;
//   Current Position = OPENING_BALANCE + all-time SUM; Moving Average = average of the 3 most recent COMPLETE
//   months excluding the current; projections = position + MA × horizon/30; month labels derive from the same
//   year/month values as the buckets (no year-boundary drift).
// expected (hand-derived): 3 needs_review + 2 confirmed → 3; Feb 100 + Mar 200 + Apr 300 + partial May 9999 with
//   "now" in May → delta excludes May unless current; MA = (100+200+300)/3 = 200; opening 10000 + sum 2500 →
//   12500; projections(10000, 500) → d30 10500, d60 11000, d90 11500; buckets for now=2026-01 span Dec/Jan keys;
//   forecast months are the 3 calendar months AFTER now (Nov 2025 → 2025-12, 2026-01, 2026-02).
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { invoices, settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import {
  bucketMonthlySums,
  computeProjections,
  getCurrentPositionMinor,
  getMovingAverageMinor,
  getNetMonthlyDelta,
  getPendingInvoiceStats,
  monthKeysAfter,
} from "@/lib/dashboard";

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

function tx(date: number, amount: number, project: string) {
  return {
    date,
    amount_minor: amount,
    currency_code: "HUF",
    category: "Dash",
    project,
    description: "",
  };
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await setSetting("DEFAULT_CURRENCY", "HUF");
});

describe("dashboard math", () => {
  it("counts only needs_review invoices", async () => {
    await db.insert(invoices).values([
      { vendor: "A", date: 20260101, total_minor: 1, currency_code: "HUF", project: "", status: "needs_review", line_items: "[]", raw_llm_response: "{}" },
      { vendor: "B", date: 20260101, total_minor: 1, currency_code: "HUF", project: "", status: "needs_review", line_items: "[]", raw_llm_response: "{}" },
      { vendor: "C", date: 20260101, total_minor: 1, currency_code: "USD", project: "", status: "needs_review", line_items: "[]", raw_llm_response: "{}" },
      { vendor: "D", date: 20260101, total_minor: 1, currency_code: "HUF", project: "", status: "confirmed", line_items: "[]", raw_llm_response: "{}" },
      { vendor: "E", date: 20260101, total_minor: 1, currency_code: "HUF", project: "", status: "confirmed", line_items: "[]", raw_llm_response: "{}" },
    ]);

    const stats = await getPendingInvoiceStats();

    expect(stats.total).toBe(3);
    expect(stats.hasMulticurrency).toBe(true);
  });

  it("sums only the current month for the net delta", async () => {
    await db.insert(transactions).values([
      tx(20260115, -111, "DeltaTest"),
      tx(20260301, -222, "DeltaTest"),
      tx(20260320, 777, "DeltaTest"),
    ]);

    const march = await getNetMonthlyDelta(new Date(Date.UTC(2026, 2, 15)));

    expect(march).toBe(555);
  });

  it("adds the opening balance to the all-time transaction sum", async () => {
    await setSetting("OPENING_BALANCE_HUF", "10000");
    await db.insert(transactions).values([tx(20260110, 1500, "PositionTest"), tx(20260111, -500, "PositionTest")]);

    const position = await getCurrentPositionMinor();

    // opening 10000 + DeltaTest sum 444 + PositionTest sum 1000 = 11444
    expect(position).toBe(11444);
  });

  it("averages only the three complete months before the current one", async () => {
    const marker = `MaTest-${Math.random()}`;
    await db.insert(transactions).values([
      tx(20260205, 100, marker),
      tx(20260305, 200, marker),
      tx(20260405, 300, marker),
      tx(20260505, 9999, marker),
    ]);

    const average = await getMovingAverageMinor(new Date(Date.UTC(2026, 4, 15)));

    // Feb 100, Mar (DeltaTest 555 + 200), Apr 300 → (100+755+300)/3 = 385; May 9999 excluded
    expect(average).toBe(385);
  });

  it("computes 30/60/90 projections from position and moving average", () => {
    expect(computeProjections(10000, 500)).toEqual({ d30: 10500, d60: 11000, d90: 11500 });
  });

  it("labels the forecast months after the current one, across a year boundary", () => {
    expect(monthKeysAfter(new Date(Date.UTC(2025, 10, 15)), 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("returns every month from the earliest transaction through the current one", () => {
    const buckets = bucketMonthlySums(
      [
        { date: 20251120, amount_minor: -100 },
        { date: 20251205, amount_minor: 250 },
        { date: 20260210, amount_minor: 50 },
      ],
      new Date(Date.UTC(2026, 1, 20)),
      "all",
    );

    expect(buckets.map((bucket) => bucket.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(buckets.map((bucket) => bucket.netMinor)).toEqual([-100, 250, 0, 50]);
  });

  it("keeps month labels in sync with buckets across a year boundary", () => {
    const buckets = bucketMonthlySums(
      [
        { date: 20251220, amount_minor: -100 },
        { date: 20260105, amount_minor: 250 },
      ],
      new Date(Date.UTC(2026, 0, 20)),
      2,
    );

    expect(buckets.map((bucket) => bucket.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(buckets[1].netMinor).toBe(-100);
    expect(buckets[2].netMinor).toBe(250);
  });
});