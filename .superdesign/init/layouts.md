# Shared Layout Components

## Root Layout

- File: `src/app/layout.tsx`
- Renders `<html lang>` + `dark` class from a cookie, Geist / Geist Mono fonts, skip-to-content link,
  persistent `Sidebar`, and a focusable `<main>`.

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GuardrailScreen } from "@/components/layout/guardrail-screen";
import { I18nProvider } from "@/components/layout/i18n-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { translate } from "@/lib/i18n";
import { getLocale, getTheme } from "@/lib/preferences";
import { checkStartup } from "@/lib/startup-gate";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: translate(locale, "meta.root"),
    description: translate(locale, "meta.description"),
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [startup, locale, theme] = await Promise.all([checkStartup(), getLocale(), getTheme()]);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${theme === "dark" ? " dark" : ""}`}
    >
      <body className="min-h-full">
        {startup.ok ? (
          <I18nProvider locale={locale}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
              {translate(locale, "nav.skipToContent")}
            </a>
            <div className="flex min-h-screen w-full">
              <Sidebar initialTheme={theme} />
              <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pt-14">
                {children}
              </main>
            </div>
          </I18nProvider>
        ) : (
          <GuardrailScreen reason={startup.reason} locale={locale} />
        )}
      </body>
    </html>
  );
}
```

## Sidebar

- File: `src/components/layout/sidebar.tsx`
- Fixed drawer under `lg`, static 16rem column at `lg+`. Brand text, nav links with active primary
  pill, theme toggle, HU/EN selector, settings link. Uses lucide icons.

```tsx
"use client";

import {
  ArrowLeftRight,
  Download,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale, useT } from "@/components/layout/i18n-provider";
import type { Locale, MessageKey } from "@/lib/i18n";
import type { Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "nav.invoices", icon: FileText },
  { href: "/transactions", label: "nav.transactions", icon: ArrowLeftRight },
  { href: "/export", label: "nav.export", icon: Download },
] as const;

const SETTINGS_ITEM = { href: "/settings", label: "nav.settings", icon: Settings } as const;

function persistCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function Sidebar({ initialTheme }: { initialTheme: Theme }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useT();

  function toggleTheme(): void {
    const next: Theme = theme === "dark" ? "light" : "dark";
    persistCookie("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
  }

  function switchLocale(locale: Locale): void {
    persistCookie("lang", locale);
    router.refresh();
  }

  function navLink(item: { href: string; label: MessageKey; icon: LucideIcon }, active: boolean) {
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{t(item.label)}</span>
      </Link>
    );
  }

  const settingsActive = pathname.startsWith(SETTINGS_ITEM.href);

  return (
    <>
      <button
        type="button"
        aria-label={open ? t("nav.close") : t("nav.open")}
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen((value) => !value)}
        className="fixed top-3 left-3 z-[60] flex size-9 items-center justify-center rounded-lg border border-input bg-card text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          data-testid="sidebar-scrim"
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        data-testid="sidebar"
        aria-label={t("nav.main")}
        inert={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-transform duration-200",
          "lg:static lg:z-auto",
          open ? "translate-x-0 lg:flex" : "-translate-x-full lg:hidden",
        )}
      >
        <div className="border-b border-sidebar-border py-4 pr-4 pl-14">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {t("common.appName")}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return <li key={item.href}>{navLink(item, active)}</li>;
            })}
          </ul>
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-sidebar-border p-2">
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t("nav.toggleTheme")}
              title={theme === "dark" ? t("nav.lightTheme") : t("nav.darkTheme")}
              className="flex size-9 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
            </button>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="sr-only">{t("common.language")}</span>
              <select
                aria-label={t("common.language")}
                value={locale}
                onChange={(event) => switchLocale(event.target.value as Locale)}
                className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="hu">{t("common.hungarian")}</option>
                <option value="en">{t("common.english")}</option>
              </select>
            </label>
          </div>
          {navLink(SETTINGS_ITEM, settingsActive)}
        </div>
      </aside>
    </>
  );
}
```

## I18n Provider

- File: `src/components/layout/i18n-provider.tsx`
- Client context that exposes the active locale and a `useT()` translator.

```tsx
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
```

## Guardrail Screen

- File: `src/components/layout/guardrail-screen.tsx`
- Full-page configuration/startup failure card.

```tsx
import { TriangleAlert } from "lucide-react";

import { translate, type Locale } from "@/lib/i18n";

export function GuardrailScreen({ reason, locale = "hu" }: { reason: string; locale?: Locale }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold text-foreground">
            {translate(locale, "guardrail.title")}
          </h1>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {translate(locale, "guardrail.body")}
        </p>
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs break-words text-foreground/80">
          {reason}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {translate(locale, "guardrail.configure")}
        </p>
      </div>
    </div>
  );
}
```
