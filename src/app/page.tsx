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
import { minorUnitsToDecimal } from "@/lib/money";
import { resolveSetting } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Dashboard — Bookkeeping Assistant",
};

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
    getMonthlyBuckets(),
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

  const format = (value: number) => `${minorUnitsToDecimal(value)} ${currency}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Position, monthly movement, and a three-month moving-average projection — all in {currency}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Pending invoices
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {pending.total}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/invoices?status=needs_review" className="underline underline-offset-2">
              Review invoices
            </Link>
          </p>
          {pending.hasMulticurrency && (
            <p className="mt-2 inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              Multicurrency soon — some pending invoices are in another currency
            </p>
          )}
        </div>
        <Card label="Net monthly delta" value={format(netDelta)} hint="Current calendar month" />
        <Card label="Current position" value={format(position)} hint="Opening balance + confirmed transactions" />
        <Card label="3-month moving average" value={format(movingAverage)} hint="Last three complete months" />
      </div>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
            Position &amp; projections
          </h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Method: Three-Month Moving Average + Opening Balance
          </span>
        </div>
        <ProjectionChart history={history} forecast={forecast} currency={currency} />
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Historical points are the computed monthly buckets; the dashed segment is the forecast, split into future
          months. Projections assume 30-day months — position + moving average × (horizon days / 30), so the 30/60/90
          switch shows one, two, or three projected months respectively.
        </p>
      </section>
    </div>
  );
}