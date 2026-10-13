"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { minorUnitsToDecimal } from "@/lib/money";
import { cn } from "@/lib/utils";

export type TransactionTableRow = {
  id: string;
  date: string;
  amountMinor: number;
  currencyCode: string;
  category: string;
  project: string;
  description: string;
  sourceInvoiceId: string | null;
};

export function TransactionTable({ rows }: { rows: TransactionTableRow[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function remove(row: TransactionTableRow) {
    if (!window.confirm(`Delete the ${minorUnitsToDecimal(row.amountMinor)} ${row.currencyCode} ${row.category} transaction?`)) {
      return;
    }

    setFeedback(null);
    setPendingId(row.id);
    try {
      const response = await fetch(`/api/transactions/${row.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback(body?.message ?? `Delete failed with HTTP ${response.status}`);
        return;
      }
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? `Delete failed: ${error.message}` : "Delete failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {feedback}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const positive = row.amountMinor >= 0;
              const signed = `${positive ? "+" : "-"}${minorUnitsToDecimal(Math.abs(row.amountMinor))}`;
              return (
                <tr key={row.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">{row.date}</td>
                  <td
                    className={cn(
                      "px-4 py-3 whitespace-nowrap font-medium tabular-nums",
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {signed} {row.currencyCode}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{row.category}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <span className="block max-w-[10rem] truncate" title={row.project}>
                      {row.project || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <span className="block max-w-[16rem] truncate" title={row.description}>
                      {row.description || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {row.sourceInvoiceId ? "Invoice" : "Manual"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pendingId === row.id}
                      onClick={() => remove(row)}
                    >
                      Delete
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