import { transactions } from "@/db/schema";
import { db } from "@/lib/db";
import type { MappedImportRecord } from "@/lib/import-map";
import { resolveSetting } from "@/lib/settings";

export type PersistImportResult =
  | { ok: true; inserted: number }
  | { ok: false; status: number; message: string };

export async function persistImport(records: MappedImportRecord[]): Promise<PersistImportResult> {
  const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
  if (!defaultCurrency) {
    return {
      ok: false,
      status: 503,
      message: "DEFAULT_CURRENCY is not set. Configure it in Settings before importing transactions.",
    };
  }

  if (records.length > 0) {
    await db.insert(transactions).values(
      records.map((record) => ({
        date: record.dateInt,
        amount_minor: record.amountMinor,
        currency_code: defaultCurrency.value,
        category: record.category || "Imported",
        project: record.project,
        description: record.description,
      })),
    );
  }

  return { ok: true, inserted: records.length };
}