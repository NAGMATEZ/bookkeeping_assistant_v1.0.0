import type { Metadata } from "next";
import Link from "next/link";

import { InvoiceTable, type InvoiceTableRow } from "@/components/invoices/invoice-table";
import { InvoiceUploadForm } from "@/components/invoices/invoice-upload-form";
import { fromDateInt } from "@/lib/dates";
import { lineItemsMatchTotal } from "@/lib/invoice-parse";
import { listInvoices } from "@/lib/invoices";
import { resolveSetting } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Invoices — Bookkeeping Assistant",
};

type InvoiceSearchParams = {
  status?: string;
  project?: string;
  vendor?: string;
};

const INPUT_CLASS =
  "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceSearchParams>;
}) {
  const params = await searchParams;
  const status =
    params.status === "needs_review" || params.status === "confirmed" ? params.status : undefined;
  const project = params.project?.trim() || undefined;
  const vendor = params.vendor?.trim() || undefined;

  const [rows, defaultCurrencySetting] = await Promise.all([
    listInvoices({ status, project, vendor }),
    resolveSetting("DEFAULT_CURRENCY"),
  ]);
  const defaultCurrency = defaultCurrencySetting?.value ?? "";

  const tableRows: InvoiceTableRow[] = rows.map((row) => ({
    id: row.id,
    date: fromDateInt(row.date),
    vendor: row.vendor,
    project: row.project,
    totalMinor: row.total_minor,
    currencyCode: row.currency_code,
    status: row.status,
    totalMatchesLineItems: lineItemsMatchTotal(row.line_items, row.total_minor),
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Invoices
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Upload invoice files for LLM extraction, then review totals and confirm them into the active
          currency{defaultCurrency ? ` (${defaultCurrency})` : ""}.
        </p>
      </header>

      {!defaultCurrencySetting && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          DEFAULT_CURRENCY is not set. No invoice can be confirmed until it is configured in Settings.
        </div>
      )}

      <div className="mb-6">
        <InvoiceUploadForm />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Status
          <select name="status" defaultValue={status ?? ""} className={INPUT_CLASS}>
            <option value="">All</option>
            <option value="needs_review">Needs review</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Project
          <input name="project" defaultValue={project ?? ""} placeholder="Filter by project" className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Vendor
          <input name="vendor" defaultValue={vendor ?? ""} placeholder="Filter by vendor" className={INPUT_CLASS} />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Filter
        </button>
        <Link
          href="/invoices"
          className="h-9 rounded-lg border border-zinc-200 px-3 text-sm font-medium leading-9 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Clear
        </Link>
      </form>

      {tableRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No invoices match the current filters. Upload an invoice to get started.
        </p>
      ) : (
        <InvoiceTable rows={tableRows} defaultCurrency={defaultCurrency} />
      )}
    </div>
  );
}