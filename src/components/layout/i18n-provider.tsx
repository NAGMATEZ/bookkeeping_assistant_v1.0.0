"use client";

import { createContext, useContext, type ReactNode } from "react";

import { translate, type Locale, type MessageKey } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("hu");

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return (key: MessageKey, variables?: Record<string, string | number>) =>
    translate(locale, key, variables);
}
