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
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
        onClick={() => setOpen((value) => !value)}
        className="fixed top-3 left-3 z-[60] flex size-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          data-testid="sidebar-scrim"
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-zinc-950/40 lg:hidden"
        />
      )}

      <aside
        data-testid="sidebar"
        aria-label={t("nav.main")}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-900",
          "lg:static lg:z-auto",
          open ? "translate-x-0 lg:flex" : "-translate-x-full lg:hidden",
        )}
      >
        <div className="border-b border-zinc-200 py-4 pr-4 pl-14 dark:border-zinc-800">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
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

        <div className="mt-auto flex flex-col gap-2 border-t border-zinc-200 p-2 dark:border-zinc-800">
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={t("nav.toggleTheme")}
              title={theme === "dark" ? t("nav.lightTheme") : t("nav.darkTheme")}
              className="flex size-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
            </button>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <span className="sr-only">{t("common.language")}</span>
              <select
                aria-label={t("common.language")}
                value={locale}
                onChange={(event) => switchLocale(event.target.value as Locale)}
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
