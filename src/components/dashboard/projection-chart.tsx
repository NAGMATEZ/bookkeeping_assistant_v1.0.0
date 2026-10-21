"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useT } from "@/components/layout/i18n-provider";
import { formatMoney } from "@/lib/format";
import type { Locale, MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ProjectionPoint = { label: string; value: number };

const HORIZONS = [30, 60, 90] as const;
type Horizon = (typeof HORIZONS)[number];

const HISTORY_RANGES: Array<{ key: "6" | "12" | "all"; months: number | null; label: MessageKey }> = [
  { key: "6", months: 6, label: "dashboard.months6" },
  { key: "12", months: 12, label: "dashboard.months12" },
  { key: "all", months: null, label: "dashboard.allMonths" },
];
type HistoryRange = (typeof HISTORY_RANGES)[number]["key"];

type ChartPoint = { label: string; value: number | null; forecast: number | null };

export function ProjectionChart({
  history,
  forecast,
  currency,
  locale,
}: {
  history: ProjectionPoint[];
  forecast: ProjectionPoint[];
  currency: string;
  locale: Locale;
}) {
  const t = useT();
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
          <span className="text-xs font-medium text-muted-foreground">
            {t("dashboard.historyRange")}
          </span>
          <div
            role="group"
            aria-label={t("dashboard.historyRange")}
            className="inline-flex rounded-lg border border-border p-0.5"
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
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("dashboard.forecastRange")}
          </span>
          <div
            role="group"
            aria-label={t("dashboard.forecastRange")}
            className="inline-flex rounded-lg border border-border p-0.5"
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
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {t("dashboard.days", { count: option })}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--chart-line)" strokeWidth="2" />
          </svg>
          {t("dashboard.actual")}
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="28"
              y2="4"
              stroke="var(--chart-line)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </svg>
          {t("dashboard.forecast")}
        </span>
      </div>
      <p className="sr-only">
        {t("dashboard.historyRange")}:{" "}
        {visibleHistory
          .map((point) => `${point.label}: ${formatMoney(point.value, currency, locale)}`)
          .join(", ")}
        . {t("dashboard.forecastRange")}:{" "}
        {visibleForecast
          .map((point) => `${point.label}: ${formatMoney(point.value, currency, locale)}`)
          .join(", ")}
        .
      </p>
      <div
        className="h-72 w-full"
        role="img"
        aria-label={t("dashboard.positionProjections")}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tickLine={{ stroke: "var(--chart-grid)" }}
            />
            <YAxis
              tickFormatter={(value: number) => formatMoney(value, currency, locale)}
              width={110}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tickLine={{ stroke: "var(--chart-grid)" }}
            />
            <Tooltip
              formatter={(value) => formatMoney(Number(value), currency, locale)}
              cursor={{ stroke: "var(--muted-foreground)" }}
              contentStyle={{
                backgroundColor: "var(--popover)",
                borderColor: "var(--border)",
                borderRadius: "0.5rem",
                color: "var(--popover-foreground)",
              }}
              itemStyle={{ color: "var(--popover-foreground)" }}
              labelStyle={{ color: "var(--muted-foreground)" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={t("dashboard.actual")}
              stroke="var(--chart-line)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--chart-line)", stroke: "var(--chart-line)" }}
              activeDot={{ r: 5, fill: "var(--chart-line)", stroke: "var(--chart-line)" }}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name={t("dashboard.forecast")}
              stroke="var(--chart-line)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: "var(--chart-line)", stroke: "var(--chart-line)" }}
              activeDot={{ r: 5, fill: "var(--chart-line)", stroke: "var(--chart-line)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
