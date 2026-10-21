"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale, useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";
import { formatMoneyAbsolute } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import type { TransactionSource } from "@/db/schema";
import { cn } from "@/lib/utils";

export type TransactionTableRow = {
  id: string;
  date: string;
  amountMinor: number;
  currencyCode: string;
  category: string;
  project: string;
  description: string;
  source: TransactionSource;
  sourceInvoiceId: string | null;
};

const SOURCE_KEYS: Record<TransactionSource, MessageKey> = {
  manual: "transactions.sourceManual",
  csv: "transactions.sourceCsv",
  xlsx: "transactions.sourceXlsx",
  invoice: "transactions.sourceInvoice",
};

export function TransactionTable({ rows }: { rows: TransactionTableRow[] }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function remove(row: TransactionTableRow) {
    const confirmed = window.confirm(
      t("transactions.deleteConfirm", {
        amount: formatMoneyAbsolute(row.amountMinor, row.currencyCode, locale),
        category: row.category,
      }),
    );
    if (!confirmed) {
      return;
    }

    setFeedback(null);
    setPendingId(row.id);
    try {
      const response = await fetch(`/api/transactions/${row.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback(body?.message ?? t("transactions.deleteFailedHttp", { status: response.status }));
        return;
      }
      router.refresh();
    } catch (error) {
      setFeedback(
        t("transactions.deleteFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {feedback}
        </p>
      )}
      <div
        className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
        role="region"
        aria-label={t("common.dataTable")}
        tabIndex={0}
      >
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <caption className="sr-only">{t("transactions.title")}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3">{t("common.date")}</th>
              <th className="px-4 py-3">{t("common.category")}</th>
              <th className="px-4 py-3">{t("common.description")}</th>
              <th className="px-4 py-3">{t("common.project")}</th>
              <th className="px-4 py-3 text-right">{t("common.amount")}</th>
              <th className="px-4 py-3">{t("common.source")}</th>
              <th className="px-4 py-3">
                <span className="sr-only">{t("common.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const positive = row.amountMinor >= 0;
              return (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-foreground/80">{row.date}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.category}</td>
                  <td className="px-4 py-3 text-foreground/80">
                    <span className="block max-w-[16rem] truncate" title={row.description}>
                      {row.description || t("common.dash")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    <span className="block max-w-[10rem] truncate" title={row.project}>
                      {row.project || t("common.dash")}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums",
                      positive ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {positive ? "+" : "-"}
                    {formatMoneyAbsolute(row.amountMinor, row.currencyCode, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {t(SOURCE_KEYS[row.source])}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pendingId === row.id}
                      onClick={() => remove(row)}
                    >
                      {t("common.delete")}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
