import type { Metadata } from "next";
import Link from "next/link";

import { ProjectionChart, type ProjectionPoint } from "@/components/dashboard/projection-chart";
import { GuardrailScreen } from "@/components/layout/guardrail-screen";
import {
  computeProjections,
  getCurrentPositionMinor,
  getMonthlyBuckets,
  getMovingAverageMinor,
  getNetMonthlyDelta,
  getPendingInvoiceStats,
  monthKeysAfter,
} from "@/lib/dashboard";
import { formatMoney } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { getLocale, localizedMetadata } from "@/lib/preferences";
import { resolveSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata("meta.dashboard");
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
  if (!defaultCurrency) {
    return (
      <GuardrailScreen reason="DEFAULT_CURRENCY is not set. Configure it in Settings to load the dashboard." />
    );
  }
  const currency = defaultCurrency.value;

  const [pending, netDelta, position, movingAverage, buckets] = await Promise.all([
    getPendingInvoiceStats(),
    getNetMonthlyDelta(),
    getCurrentPositionMinor(),
    getMovingAverageMinor(),
    getMonthlyBuckets(new Date(), "all"),
  ]);
  const projections = computeProjections(position, movingAverage);

  const bucketTotal = buckets.reduce((sum, bucket) => sum + bucket.netMinor, 0);
  const history: ProjectionPoint[] = [];
  let running = position - bucketTotal;
  for (const bucket of buckets) {
    running += bucket.netMinor;
    history.push({ label: bucket.month, value: running });
  }
  const forecastMonths = monthKeysAfter(new Date(), 3);
  const forecast: ProjectionPoint[] = [
    { label: forecastMonths[0], value: projections.d30 },
    { label: forecastMonths[1], value: projections.d60 },
    { label: forecastMonths[2], value: projections.d90 },
  ];

  const format = (value: number) => formatMoney(value, currency, locale);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {translate(locale, "dashboard.title")}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {translate(locale, "dashboard.subtitle", { currency })}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            {translate(locale, "dashboard.pendingInvoices")}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {pending.total}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/invoices?status=needs_review" className="underline underline-offset-2">
              {translate(locale, "dashboard.reviewInvoices")}
            </Link>
          </p>
          {pending.hasMulticurrency && (
            <p className="mt-2 inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              {translate(locale, "dashboard.multicurrencyNotice")}
            </p>
          )}
        </div>
        <Card
          label={translate(locale, "dashboard.netMonthlyDelta")}
          value={format(netDelta)}
          hint={translate(locale, "dashboard.currentMonth")}
        />
        <Card
          label={translate(locale, "dashboard.currentPosition")}
          value={format(position)}
          hint={translate(locale, "dashboard.openingPlus")}
        />
        <Card
          label={translate(locale, "dashboard.movingAverage")}
          value={format(movingAverage)}
          hint={translate(locale, "dashboard.lastThreeMonths")}
        />
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
            {translate(locale, "dashboard.positionProjections")}
          </h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {translate(locale, "dashboard.method")}
          </span>
        </div>
        <ProjectionChart history={history} forecast={forecast} currency={currency} locale={locale} />
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {translate(locale, "dashboard.footnote")}
        </p>
      </section>
    </div>
  );
}
