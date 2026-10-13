import type { Metadata } from "next";

import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = {
  title: "Import / Export — Bookkeeping Assistant",
};

export default function ImportExportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Import / Export
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Import CSV/XLSX transactions with a column mapping preview, or download all transactions.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          Import
        </h2>
        <ImportWizard />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          Export
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/export?format=csv"
            download
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Download CSV
          </a>
          <a
            href="/api/export?format=xlsx"
            download
            className="inline-flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Download XLSX
          </a>
        </div>
      </section>
    </div>
  );
}