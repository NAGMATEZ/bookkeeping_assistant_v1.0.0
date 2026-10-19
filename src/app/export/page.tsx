import type { Metadata } from "next";

import { translate } from "@/lib/i18n";
import { getLocale, localizedMetadata } from "@/lib/preferences";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.export");
}

export default async function ExportPage() {
  const locale = await getLocale();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {translate(locale, "export.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{translate(locale, "export.subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <a
          href="/api/export?format=csv"
          download
          className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {translate(locale, "export.downloadCsv")}
        </a>
        <a
          href="/api/export?format=xlsx"
          download
          className="inline-flex h-10 items-center rounded-lg border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {translate(locale, "export.downloadXlsx")}
        </a>
      </div>
    </div>
  );
}
