// spec: Hungarian is the default UI language with every string available in English too; money is
//   currency- and locale-aware, and HUF is always shown symbol-after as "1 234 Ft".
// expected (hand-derived): DEFAULT_LOCALE = "hu"; both dictionaries expose exactly the same keys;
//   translate("en", "nav.dashboard") = "Dashboard"; translate("hu", "import.importAll", {count:3}) uses the
//   Hungarian template with 3 substituted; formatMoney(123400, "HUF", "en") = "1 234 Ft" (NBSP separators);
//   formatMoney(123456, "USD", "en") = "$1,234.56"; formatMoney(-123456, "EUR", "hu") = "-1 234,56 €".
import { describe, expect, it } from "vitest";

import { formatMoney, formatMoneyAbsolute } from "@/lib/format";
import { DEFAULT_LOCALE, ERROR_MESSAGE_KEYS, isLocale, messages, translate } from "@/lib/i18n";

const NBSP = "\u00a0";

describe("i18n", () => {
  it("defaults to Hungarian and validates locale cookies", () => {
    expect(DEFAULT_LOCALE).toBe("hu");
    expect(isLocale("hu")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("defines every message key in both languages", () => {
    expect(Object.keys(messages.hu).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it("translates and interpolates", () => {
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
    expect(translate("hu", "nav.dashboard")).toBe("Dashboard");
    expect(translate("hu", "import.importAll", { count: 3 })).toContain("3");
    expect(translate("en", "import.importAll", { count: 3 })).toBe("Import All 3 Rows");
  });
});

// spec: controlled error notices in Hungarian mode show the Hungarian sentence first and the English
//   original in parentheses; English mode is unchanged. Expected hand-derived from the two dictionaries:
//   HU "A tranzakció mentése HTTP 500 hibával megszakadt." + " (" + EN
//   "Saving the transaction failed with HTTP 500." + ")".
describe("bilingual error notices", () => {
  it("appends the English original only in Hungarian mode", () => {
    expect(translate("hu", "transactions.saveFailedHttp", { status: 500 })).toBe(
      "A tranzakció mentése HTTP 500 hibával megszakadt. (Saving the transaction failed with HTTP 500.)",
    );
    expect(translate("en", "transactions.saveFailedHttp", { status: 500 })).toBe(
      "Saving the transaction failed with HTTP 500.",
    );
  });

  it("leaves non-error keys and the error key set untouched by ordinary translation", () => {
    expect(translate("hu", "nav.dashboard")).toBe("Dashboard");
    expect(ERROR_MESSAGE_KEYS.has("nav.dashboard")).toBe(false);
    expect(ERROR_MESSAGE_KEYS.has("transactions.saveFailedHttp")).toBe(true);
  });
});

describe("formatMoney", () => {
  it("formats HUF as symbol-after with grouping regardless of UI locale", () => {
    expect(formatMoney(123400, "HUF", "en")).toBe(`1${NBSP}234${NBSP}Ft`);
    expect(formatMoney(123400, "HUF", "hu")).toBe(`1${NBSP}234${NBSP}Ft`);
  });

  it("formats USD and EUR using the active locale", () => {
    expect(formatMoney(123456, "USD", "en")).toBe("$1,234.56");
    expect(formatMoney(-123456, "EUR", "hu")).toBe(`-1${NBSP}234,56${NBSP}€`);
  });

  it("formats absolute amounts without a sign", () => {
    expect(formatMoneyAbsolute(-123456, "USD", "en")).toBe("$1,234.56");
  });
});
