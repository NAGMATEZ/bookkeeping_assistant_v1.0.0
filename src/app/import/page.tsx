import type { Metadata } from "next";

import { ImportWizard } from "@/components/import/import-wizard";
import { translate } from "@/lib/i18n";
import { getLocale, localizedMetadata } from "@/lib/preferences";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.import");
}

export default async function ImportPage() {
  const locale = await getLocale();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {translate(locale, "import.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{translate(locale, "import.subtitle")}</p>
      </header>

      <ImportWizard />
    </div>
  );
}
