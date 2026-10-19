import { and, eq, gte, lte, sql } from "drizzle-orm";

import { invoices, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { monthKeyOf } from "@/lib/dates";
import { getOpeningBalanceMinor, resolveSetting } from "@/lib/settings";
import type { TransactionRow } from "@/lib/transactions";

export type PendingInvoiceStats = { total: number; hasMulticurrency: boolean };
export type MonthlyBucket = { month: string; netMinor: number };
export type Projections = { d30: number; d60: number; d90: number };

export function computeProjections(currentPositionMinor: number, movingAverageMinor: number): Projections {
  return {
    d30: currentPositionMinor + movingAverageMinor,
    d60: currentPositionMinor + movingAverageMinor * 2,
    d90: currentPositionMinor + movingAverageMinor * 3,
  };
}

function monthKeysBefore(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let offset = count; offset >= 1; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function monthKeysAfter(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthKeysThrough(startKey: string, endKey: string): string[] {
  const [startYear, startMonth] = startKey.split("-").map(Number);
  const [endYear, endMonth] = endKey.split("-").map(Number);
  const keys: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

function monthRange(dateIntStart: number, dateIntEnd: number) {
  return and(gte(transactions.date, dateIntStart), lte(transactions.date, dateIntEnd));
}

function currentMonthBounds(now: Date): { first: number; last: number } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const first = year * 10000 + month * 100 + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const last = nextYear * 10000 + nextMonth * 100 + 1 - 1;
  return { first, last };
}

export function bucketMonthlySums(
  rows: Pick<TransactionRow, "date" | "amount_minor">[],
  now: Date,
  count: number | "all",
): MonthlyBucket[] {
  const currentKey = monthKeyOf(now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + 1);
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const key = monthKeyOf(row.date);
    buckets.set(key, (buckets.get(key) ?? 0) + row.amount_minor);
  }

  let keys: string[];
  if (count === "all") {
    const earliest = [...buckets.keys()].filter((key) => key <= currentKey).sort()[0];
    keys = earliest ? monthKeysThrough(earliest, currentKey) : [currentKey];
  } else {
    keys = [...monthKeysBefore(now, count), currentKey];
  }

  return keys.map((month) => ({ month, netMinor: buckets.get(month) ?? 0 }));
}

export async function getPendingInvoiceStats(): Promise<PendingInvoiceStats> {
  const rows = await db
    .select({ currency_code: invoices.currency_code })
    .from(invoices)
    .where(eq(invoices.status, "needs_review"));
  const defaultCurrency = (await resolveSetting("DEFAULT_CURRENCY"))?.value ?? "";
  return {
    total: rows.length,
    hasMulticurrency: rows.some((row) => row.currency_code !== defaultCurrency),
  };
}

export async function getNetMonthlyDelta(now: Date = new Date()): Promise<number> {
  const { first, last } = currentMonthBounds(now);
  const rows = await db
    .select({ sum: sql<number>`COALESCE(SUM(${transactions.amount_minor}), 0)` })
    .from(transactions)
    .where(monthRange(first, last));
  return rows[0].sum;
}

export async function getCurrentPositionMinor(): Promise<number> {
  const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
  const opening = defaultCurrency ? await getOpeningBalanceMinor(defaultCurrency.value) : 0;
  const rows = await db
    .select({ sum: sql<number>`COALESCE(SUM(${transactions.amount_minor}), 0)` })
    .from(transactions);
  return opening + rows[0].sum;
}

export async function getMovingAverageMinor(now: Date = new Date()): Promise<number> {
  const keys = monthKeysBefore(now, 3);
  const rows = await db.select().from(transactions);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = monthKeyOf(row.date);
    totals.set(key, (totals.get(key) ?? 0) + row.amount_minor);
  }
  const sum = keys.reduce((total, key) => total + (totals.get(key) ?? 0), 0);
  return Math.round(sum / 3);
}

export async function getMonthlyBuckets(
  now: Date = new Date(),
  count: number | "all" = 6,
): Promise<MonthlyBucket[]> {
  const rows = await db
    .select({ date: transactions.date, amount_minor: transactions.amount_minor })
    .from(transactions);
  return bucketMonthlySums(rows, now, count);
}