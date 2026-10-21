import type { Metadata } from "next";
import Link from "next/link";

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
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground";

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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {translate(locale, "transactions.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {translate(locale, "transactions.subtitle")}
        </p>
      </header>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "common.project")}
          <input
            name="project"
            defaultValue={project ?? ""}
            placeholder={translate(locale, "transactions.filterProject")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "common.category")}
          <input
            name="category"
            defaultValue={category ?? ""}
            placeholder={translate(locale, "transactions.filterCategory")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "transactions.from")}
          <input type="date" name="from" defaultValue={from ?? ""} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "transactions.to")}
          <input type="date" name="to" defaultValue={to ?? ""} className={INPUT_CLASS} />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {translate(locale, "common.filter")}
        </button>
        <Link
          href="/transactions"
          className="h-9 rounded-lg border border-input px-3 text-sm font-medium leading-9 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {translate(locale, "common.clear")}
        </Link>
      </form>

      {tableRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {translate(locale, "transactions.empty")}
        </p>
      ) : (
        <TransactionTable rows={tableRows} />
      )}

      <section className="mt-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">{translate(locale, "manual.title")}</h2>
        </div>
        <div className="p-6">
          <ManualEntryForm />
        </div>
      </section>
    </div>
  );
}
