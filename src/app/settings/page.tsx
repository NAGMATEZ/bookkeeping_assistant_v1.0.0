import type { Metadata } from "next";

import { LanguageSelector } from "@/components/settings/language-selector";
import { ResetPanel } from "@/components/settings/reset-panel";
import { SettingsForm } from "@/components/settings/settings-form";
import { translate } from "@/lib/i18n";
import { minorUnitsToDecimal } from "@/lib/money";
import { getLocale, localizedMetadata } from "@/lib/preferences";
import { getOpeningBalanceMinor, resolveSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.settings");
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const [
    primaryBaseUrl,
    primaryModel,
    primaryApiKey,
    secondaryBaseUrl,
    secondaryModel,
    secondaryApiKey,
    defaultCurrency,
  ] = await Promise.all([
    resolveSetting("PRIMARY_BASE_URL"),
    resolveSetting("PRIMARY_MODEL"),
    resolveSetting("PRIMARY_API_KEY"),
    resolveSetting("SECONDARY_BASE_URL"),
    resolveSetting("SECONDARY_MODEL"),
    resolveSetting("SECONDARY_API_KEY"),
    resolveSetting("DEFAULT_CURRENCY"),
  ]);

  const currency = defaultCurrency?.value ?? "";
  const openingBalance = currency
    ? minorUnitsToDecimal(await getOpeningBalanceMinor(currency))
    : "";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {translate(locale, "settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{translate(locale, "settings.subtitle")}</p>
      </header>

      {!defaultCurrency && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          {translate(locale, "settings.currencyMissing")}
        </div>
      )}

      <div className="mb-8">
        <LanguageSelector />
      </div>

      <SettingsForm
        initial={{
          primaryBaseUrl: primaryBaseUrl?.value ?? "",
          primaryModel: primaryModel?.value ?? "",
          primaryApiKeySet: primaryApiKey !== null,
          secondaryBaseUrl: secondaryBaseUrl?.value ?? "",
          secondaryModel: secondaryModel?.value ?? "",
          secondaryApiKeySet: secondaryApiKey !== null,
          defaultCurrency: currency,
          openingBalance,
        }}
      />

      <ResetPanel />
    </div>
  );
}
