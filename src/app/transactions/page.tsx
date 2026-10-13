import type { Metadata } from "next";
import Link from "next/link";

import { ManualEntryForm } from "@/components/transactions/manual-entry-form";
import { TransactionTable, type TransactionTableRow } from "@/components/transactions/transaction-table";
import { fromDateInt, isAllowedCalendarDate } from "@/lib/dates";
import { listTransactions } from "@/lib/transactions";

export const metadata: Metadata = {
  title: "Transactions — Bookkeeping Assistant",
};

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
    sourceInvoiceId: row.source_invoice_id,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manual entries and confirmed invoices, all in the active currency. Positive values are income,
          negative values are expenses.
        </p>
      </header>

      <div className="mb-6">
        <ManualEntryForm />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Project
          <input name="project" defaultValue={project ?? ""} placeholder="Filter by project" className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Category
          <input name="category" defaultValue={category ?? ""} placeholder="Filter by category" className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          From
          <input type="date" name="from" defaultValue={from ?? ""} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          To
          <input type="date" name="to" defaultValue={to ?? ""} className={INPUT_CLASS} />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Filter
        </button>
        <Link
          href="/transactions"
          className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-medium leading-9 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Clear
        </Link>
      </form>

      {tableRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No transactions match the current filters. Add one above or confirm an invoice.
        </p>
      ) : (
        <TransactionTable rows={tableRows} />
      )}
    </div>
  );
}