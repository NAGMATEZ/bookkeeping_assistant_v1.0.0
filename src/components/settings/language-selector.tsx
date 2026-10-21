"use client";

import { useRouter } from "next/navigation";

import { useLocale, useT } from "@/components/layout/i18n-provider";
import { COOKIE_MAX_AGE, LOCALE_COOKIE } from "@/lib/cookies";
import { LOCALES, type Locale } from "@/lib/i18n";

export function LanguageSelector() {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();

  function switchLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{t("settings.language")}</span>
      <select
        value={locale}
        onChange={(event) => switchLocale(event.target.value as Locale)}
        className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm text-foreground"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {option === "hu" ? t("common.hungarian") : t("common.english")}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">{t("settings.languageHint")}</span>
    </label>
  );
}
