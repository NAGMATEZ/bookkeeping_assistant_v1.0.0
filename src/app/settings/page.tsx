import type { Metadata } from "next";

import { SettingsForm } from "@/components/settings/settings-form";
import { minorUnitsToDecimal } from "@/lib/money";
import { getOpeningBalanceMinor, resolveSetting } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings — Bookkeeping Assistant",
};

export default async function SettingsPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Provider credentials, default currency, and opening balance. API keys are stored encrypted and
          are never rendered back into this page.
        </p>
      </header>

      {!defaultCurrency && (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          DEFAULT_CURRENCY is not set. Invoices cannot be confirmed and manual entries/imports are
          blocked until it is configured.
        </div>
      )}

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
    </div>
  );
}