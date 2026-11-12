import { and, gte, inArray, lte } from "drizzle-orm";

import { transactions } from "@/db/schema";
import { db } from "@/lib/db";
import type { MappedImportRecord } from "@/lib/import-map";
import { resolveSetting } from "@/lib/settings";

export type PersistImportOptions = {
  skipDuplicates?: boolean;
};

export type PersistImportResult =
  | { ok: true; inserted: number; skippedDuplicates: number }
  | { ok: false; status: number; message: string };

export const IMPORT_INSERT_CHUNK_SIZE = 500;

type ImportedRow = {
  date: number;
  amount_minor: number;
  currency_code: string;
  category: string;
  project: string;
  description: string;
  source: "csv" | "xlsx";
};

function dedupeKey(row: {
  date: number;
  amount_minor: number;
  currency_code: string;
  category: string;
  project: string;
  description: string;
}): string {
  return [
    row.date,
    row.amount_minor,
    row.currency_code,
    row.category,
    row.project,
    row.description,
  ].join("\u0000");
}

export async function persistImport(
  records: MappedImportRecord[],
  source: "csv" | "xlsx" = "csv",
  options: PersistImportOptions = {},
): Promise<PersistImportResult> {
  const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
  if (!defaultCurrency) {
    return {
      ok: false,
      status: 503,
      message: "DEFAULT_CURRENCY is not set. Configure it in Settings before importing transactions.",
    };
  }

  const rows: ImportedRow[] = records.map((record) => ({
    date: record.dateInt,
    amount_minor: record.amountMinor,
    currency_code: defaultCurrency.value,
    category: record.category || "Imported",
    project: record.project,
    description: record.description,
    source,
  }));

  let pending = rows;
  let skippedDuplicates = 0;

  if (options.skipDuplicates && rows.length > 0) {
    const minDate = rows.reduce((min, row) => Math.min(min, row.date), Number.POSITIVE_INFINITY);
    const maxDate = rows.reduce((max, row) => Math.max(max, row.date), Number.NEGATIVE_INFINITY);
    const existing = await db
      .select({
        date: transactions.date,
        amount_minor: transactions.amount_minor,
        currency_code: transactions.currency_code,
        category: transactions.category,
        project: transactions.project,
        description: transactions.description,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.source, ["csv", "xlsx"]),
          gte(transactions.date, minDate),
          lte(transactions.date, maxDate),
        ),
      );

    const seen = new Set(existing.map(dedupeKey));
    pending = rows.filter((row) => {
      const key = dedupeKey(row);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    skippedDuplicates = rows.length - pending.length;
  }

  for (let index = 0; index < pending.length; index += IMPORT_INSERT_CHUNK_SIZE) {
    await db.insert(transactions).values(pending.slice(index, index + IMPORT_INSERT_CHUNK_SIZE));
  }

  return { ok: true, inserted: pending.length, skippedDuplicates };
}