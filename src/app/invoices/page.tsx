import type { Metadata } from "next";
import Link from "next/link";

import { InvoiceTable, type InvoiceTableRow } from "@/components/invoices/invoice-table";
import { InvoiceUploadForm } from "@/components/invoices/invoice-upload-form";
import { fromDateInt } from "@/lib/dates";
import { translate } from "@/lib/i18n";
import { lineItemsMatchTotal, parseStoredLineItems } from "@/lib/invoice-parse";
import { listInvoices } from "@/lib/invoices";
import { getLocale, localizedMetadata } from "@/lib/preferences";
import { resolveSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.invoices");
}

type InvoiceSearchParams = {
  status?: string;
  project?: string;
  vendor?: string;
};

const INPUT_CLASS =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<InvoiceSearchParams>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
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
    netMinor: row.net_minor,
    vatMinor: row.vat_minor,
    grossMinor: row.gross_minor,
    currencyCode: row.currency_code,
    status: row.status,
    lineItems: parseStoredLineItems(row.line_items),
    totalMatchesLineItems: lineItemsMatchTotal(row.line_items, row.total_minor),
    hasSourceImage: row.hasSourceImage,
    sourceMime: row.source_image_mime,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {translate(locale, "invoices.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {defaultCurrency
            ? translate(locale, "invoices.subtitle", { currency: defaultCurrency })
            : translate(locale, "invoices.subtitleNoCurrency")}
        </p>
      </header>

      {!defaultCurrencySetting && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {translate(locale, "invoices.currencyMissing")}
        </div>
      )}

      <div className="mb-6">
        <InvoiceUploadForm />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "invoices.filterStatus")}
          <select name="status" defaultValue={status ?? ""} className={INPUT_CLASS}>
            <option value="">{translate(locale, "invoices.statusAll")}</option>
            <option value="needs_review">{translate(locale, "invoices.statusNeedsReview")}</option>
            <option value="confirmed">{translate(locale, "invoices.statusConfirmed")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "common.project")}
          <input
            name="project"
            defaultValue={project ?? ""}
            placeholder={translate(locale, "invoices.filterProject")}
            className={INPUT_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {translate(locale, "common.vendor")}
          <input
            name="vendor"
            defaultValue={vendor ?? ""}
            placeholder={translate(locale, "invoices.filterVendor")}
            className={INPUT_CLASS}
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {translate(locale, "common.filter")}
        </button>
        <Link
          href="/invoices"
          className="h-9 rounded-lg border border-input px-3 text-sm font-medium leading-9 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {translate(locale, "common.clear")}
        </Link>
      </form>

      {tableRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {translate(locale, "invoices.empty")}
        </p>
      ) : (
        <InvoiceTable rows={tableRows} defaultCurrency={defaultCurrency} />
      )}
    </div>
  );
}