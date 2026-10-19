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
            <div className="flex min-h-screen w-full">
              <Sidebar initialTheme={theme} />
              <main className="min-w-0 flex-1 pt-14">{children}</main>
            </div>
          </I18nProvider>
        ) : (
          <GuardrailScreen reason={startup.reason} locale={locale} />
        )}
      </body>
    </html>
  );
}
