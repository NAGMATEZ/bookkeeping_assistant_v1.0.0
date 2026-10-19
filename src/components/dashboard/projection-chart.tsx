"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";
import { minorUnitsToDecimal } from "@/lib/money";

export type ProjectionPoint = { label: string; value: number };

const HORIZONS = [30, 60, 90] as const;
type Horizon = (typeof HORIZONS)[number];

const HISTORY_RANGES = [
  { key: "6", months: 6, label: "6M" },
  { key: "12", months: 12, label: "12M" },
  { key: "all", months: null, label: "All" },
] as const;
type HistoryRange = (typeof HISTORY_RANGES)[number]["key"];

type ChartPoint = { label: string; value: number | null; forecast: number | null };

export function ProjectionChart({
  history,
  forecast,
  currency,
}: {
  history: ProjectionPoint[];
  forecast: ProjectionPoint[];
  currency: string;
}) {
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("6");
  const months = horizon / 30;
  const visibleForecast = forecast.slice(0, months);
  const range = HISTORY_RANGES.find((option) => option.key === historyRange) ?? HISTORY_RANGES[0];
  const visibleHistory = range.months === null ? history : history.slice(-range.months);

  const data: ChartPoint[] = [
    ...visibleHistory.map((point) => ({ label: point.label, value: point.value, forecast: null })),
    ...visibleForecast.map((point) => ({ label: point.label, value: null, forecast: point.value })),
  ];
  if (visibleHistory.length > 0) {
    data[visibleHistory.length - 1].forecast = visibleHistory[visibleHistory.length - 1].value;
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">History</span>
          <div
            role="group"
            aria-label="History range"
            className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
          >
            {HISTORY_RANGES.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={historyRange === option.key}
                onClick={() => setHistoryRange(option.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  historyRange === option.key
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Forecast horizon</span>
          <div
            role="group"
            aria-label="Forecast horizon"
            className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
          >
            {HORIZONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={horizon === option}
                onClick={() => setHorizon(option)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  horizon === option
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                {option} days
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(value: number) => minorUnitsToDecimal(value)} width={80} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => `${minorUnitsToDecimal(Number(value))} ${currency}`} />
            <Line type="monotone" dataKey="value" name="Actual" stroke="#18181b" strokeWidth={2} dot={{ r: 3 }} />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="#18181b"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
