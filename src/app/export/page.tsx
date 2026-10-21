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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {translate(locale, "export.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{translate(locale, "export.subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <a
          href="/api/export?format=csv"
          download
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {translate(locale, "export.downloadCsv")}
        </a>
        <a
          href="/api/export?format=xlsx"
          download
          className="inline-flex h-10 items-center rounded-lg border border-input px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {translate(locale, "export.downloadXlsx")}
        </a>
      </div>
    </div>
  );
}
