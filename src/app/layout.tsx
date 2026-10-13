import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GuardrailScreen } from "@/components/layout/guardrail-screen";
import { Sidebar } from "@/components/layout/sidebar";
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

export const metadata: Metadata = {
  title: "Bookkeeping Assistant",
  description: "Invoices, transactions, imports, and projections in one place",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const startup = await checkStartup();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {startup.ok ? (
          <div className="flex min-h-screen w-full">
            <Sidebar />
            <main className="min-w-0 flex-1 pt-14">{children}</main>
          </div>
        ) : (
          <GuardrailScreen reason={startup.reason} />
        )}
      </body>
    </html>
  );
}