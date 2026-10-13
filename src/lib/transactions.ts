import { and, desc, eq, gte, like, lte } from "drizzle-orm";

import { transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { toDateInt } from "@/lib/dates";
import { MAX_AMOUNT_MINOR } from "@/lib/invoice-parse";
import { parseDecimalToMinorUnits } from "@/lib/money";
import { resolveSetting } from "@/lib/settings";

export type TransactionRow = typeof transactions.$inferSelect;

export type ManualEntryInput = {
  date: string;
  amount: string;
  isIncome: boolean;
  category: string;
  project: string;
  description: string;
};

export type CreateTransactionResult =
  | { ok: true; transaction: TransactionRow }
  | { ok: false; status: number; message: string };

export type TransactionFilters = {
  project?: string;
  category?: string;
  from?: string;
  to?: string;
};

export async function createManualTransaction(
  input: ManualEntryInput,
): Promise<CreateTransactionResult> {
  const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
  if (!defaultCurrency) {
    return {
      ok: false,
      status: 503,
      message: "DEFAULT_CURRENCY is not set. Configure it in Settings before entering transactions.",
    };
  }

  const category = input.category.trim();
  if (category === "") {
    return { ok: false, status: 400, message: "Category is required" };
  }

  let dateInt: number;
  try {
    dateInt = toDateInt(input.date);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message: error instanceof Error ? error.message : "Invalid date",
    };
  }

  let magnitude: number;
  try {
    magnitude = parseDecimalToMinorUnits(input.amount);
  } catch (error) {
    return {
      ok: false,
      status: 400,
      message: error instanceof Error ? error.message : "Invalid amount",
    };
  }

  if (magnitude === 0) {
    return { ok: false, status: 400, message: "Amount must not be zero" };
  }
  if (Math.abs(magnitude) > MAX_AMOUNT_MINOR) {
    return {
      ok: false,
      status: 400,
      message: `Amount exceeds the ${MAX_AMOUNT_MINOR} minor-unit cap`,
    };
  }

  const [created] = await db
    .insert(transactions)
    .values({
      date: dateInt,
      amount_minor: input.isIncome ? Math.abs(magnitude) : -Math.abs(magnitude),
      currency_code: defaultCurrency.value,
      category,
      project: input.project.trim(),
      description: input.description.trim(),
    })
    .returning();

  return { ok: true, transaction: created };
}

export async function listTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const conditions = [];
  if (filters.project) {
    conditions.push(like(transactions.project, `%${filters.project}%`));
  }
  if (filters.category) {
    conditions.push(like(transactions.category, `%${filters.category}%`));
  }
  if (filters.from) {
    conditions.push(gte(transactions.date, toDateInt(filters.from)));
  }
  if (filters.to) {
    conditions.push(lte(transactions.date, toDateInt(filters.to)));
  }

  return db
    .select()
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.created_at));
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.delete(transactions).where(eq(transactions.id, id));
}