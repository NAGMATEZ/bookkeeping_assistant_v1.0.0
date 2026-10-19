import type { Metadata } from "next";
import Link from "next/link";

import { ImportWizard } from "@/components/import/import-wizard";
import { ManualEntryForm } from "@/components/transactions/manual-entry-form";
import { TransactionTable, type TransactionTableRow } from "@/components/transactions/transaction-table";
import { fromDateInt, isAllowedCalendarDate } from "@/lib/dates";
import { translate } from "@/lib/i18n";
import { getLocale, localizedMetadata } from "@/lib/preferences";
import { listTransactions } from "@/lib/transactions";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.transactions");
}

type TransactionSearchParams = {
  project?: string;
  category?: string;
  from?: string;
  to?: string;
};

const INPUT_CLASS =
  "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const project = params.project?.trim() || undefined;
  const category = params.category?.trim() || undefined;
  const from = params.from && isAllowedCalendarDate(params.from) ? params.from : undefined;
  const to = params.to && isAllowedCalendarDate(params.to) ? params.to : undefined;

  const rows = await listTransactions({ project, category, from, to });

  const tableRows: TransactionTableRow[] = rows.map((row) => ({
    id: row.id,
    date: fromDateInt(row.date),
    amountMinor: row.amount_minor,
    currencyCode: row.currency_code,
    category: row.category,
    project: row.project,
    description: row.description,
    source: row.source,
    sourceInvoiceId: row.source_invoice_id,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {translate(locale, "transactions.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {translate(locale, "transactions.subtitle")}
        </p>
      </header>

      <div className="mb-6">
        <ManualEntryForm />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {translate(locale, "common.project")}
          <input
            name="project"
            defaultValue={project ?? ""}
            placeholder={translate(locale, "transactions.filterProject")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {translate(locale, "common.category")}
          <input
            name="category"
            defaultValue={category ?? ""}
            placeholder={translate(locale, "transactions.filterCategory")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {translate(locale, "transactions.from")}
          <input type="date" name="from" defaultValue={from ?? ""} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {translate(locale, "transactions.to")}
          <input type="date" name="to" defaultValue={to ?? ""} className={INPUT_CLASS} />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {translate(locale, "common.filter")}
        </button>
        <Link
          href="/transactions"
          className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-medium leading-9 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {translate(locale, "common.clear")}
        </Link>
      </form>

      {tableRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {translate(locale, "transactions.empty")}
        </p>
      ) : (
        <TransactionTable rows={tableRows} />
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          {translate(locale, "transactions.importSection")}
        </h2>
        <ImportWizard />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          {translate(locale, "transactions.exportSection")}
        </h2>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{translate(locale, "transactions.exportHint")}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/export?format=csv"
            download
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {translate(locale, "transactions.downloadCsv")}
          </a>
          <a
            href="/api/export?format=xlsx"
            download
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {translate(locale, "transactions.downloadXlsx")}
          </a>
        </div>
      </section>
    </div>
  );
}
