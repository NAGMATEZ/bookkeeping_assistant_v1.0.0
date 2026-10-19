import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, translate, type Locale, type MessageKey } from "@/lib/i18n";

export const LOCALE_COOKIE = "lang";
export const THEME_COOKIE = "theme";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

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
