import type { Metadata } from "next";
import { cookies } from "next/headers";

import { COOKIE_MAX_AGE, LOCALE_COOKIE, THEME_COOKIE, type Theme } from "@/lib/cookies";
import { DEFAULT_LOCALE, isLocale, translate, type Locale, type MessageKey } from "@/lib/i18n";

export { COOKIE_MAX_AGE, LOCALE_COOKIE, THEME_COOKIE };
export type { Theme };

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}

export async function localizedMetadata(key: MessageKey): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: translate(locale, key),
    description: translate(locale, "meta.description"),
  };
}
