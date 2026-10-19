import type { Locale } from "@/lib/i18n";
import { minorUnitsToDecimal } from "@/lib/money";

const LOCALE_TAGS: Record<Locale, string> = { hu: "hu-HU", en: "en-US" };

function intlLocaleFor(currencyCode: string, locale: Locale): string {
  // HUF is always presented Hungarian-style ("1 234 Ft", symbol after the amount),
  // regardless of the UI language. Other currencies follow the active locale.
  return currencyCode === "HUF" ? "hu-HU" : LOCALE_TAGS[locale];
}

function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function formatMoney(minorUnits: number, currencyCode: string, locale: Locale): string {
  const code = currencyCode.trim().toUpperCase();
  const major = minorUnits / 100;

  if (!isCurrencyCode(code)) {
    return `${minorUnitsToDecimal(minorUnits)} ${currencyCode}`.trim();
  }

  try {
    return new Intl.NumberFormat(intlLocaleFor(code, locale), {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      useGrouping: "always",
    }).format(major);
  } catch {
    return `${minorUnitsToDecimal(minorUnits)} ${code}`;
  }
}

export function formatMoneyAbsolute(minorUnits: number, currencyCode: string, locale: Locale): string {
  return formatMoney(Math.abs(minorUnits), currencyCode, locale);
}
