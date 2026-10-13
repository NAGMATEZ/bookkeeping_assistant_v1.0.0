"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { minorUnitsToDecimal, parseDecimalToMinorUnits } from "@/lib/money";
import { cn } from "@/lib/utils";

export type InvoiceTableRow = {
  id: string;
  date: string;
  vendor: string;
  project: string;
  totalMinor: number;
  currencyCode: string;
  status: "needs_review" | "confirmed";
  totalMatchesLineItems: boolean;
};

type Feedback = { kind: "error" | "success"; message: string } | null;

function multicurrencyMessage(rowCurrency: string, defaultCurrency: string): string {
  return `Multi-currency support is coming in a future release. This invoice is in ${rowCurrency} but the active currency is ${defaultCurrency}. Non-${defaultCurrency} invoices cannot be confirmed yet.`;
}

export function InvoiceTable({
  rows,
  defaultCurrency,
}: {
  rows: InvoiceTableRow[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function confirmInvoice(row: InvoiceTableRow) {
    setFeedback(null);
    setPendingId(row.id);
    try {
      const response = await fetch(`/api/invoices/${row.id}/confirm`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback({ kind: "error", message: body?.message ?? `Confirm failed with HTTP ${response.status}` });
        return;
      }
      setFeedback({ kind: "success", message: `Invoice from ${row.vendor} confirmed.` });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? `Confirm failed: ${error.message}` : "Confirm failed",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function saveTotal(event: FormEvent<HTMLFormElement>, row: InvoiceTableRow) {
    event.preventDefault();
    setFeedback(null);

    let totalMinor: number;
    try {
      totalMinor = parseDecimalToMinorUnits(edits[row.id] ?? minorUnitsToDecimal(row.totalMinor));
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Invalid total",
      });
      return;
    }

    setPendingId(row.id);
    try {
      const response = await fetch(`/api/invoices/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_minor: totalMinor }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback({ kind: "error", message: body?.message ?? `Saving total failed with HTTP ${response.status}` });
        return;
      }
      setFeedback({ kind: "success", message: `Total updated to ${minorUnitsToDecimal(totalMinor)} ${row.currencyCode}.` });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? `Saving total failed: ${error.message}` : "Saving total failed",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={cn(
            "text-sm font-medium",
            feedback.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {feedback.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const multicurrency = row.currencyCode !== defaultCurrency;
              const message = multicurrency ? multicurrencyMessage(row.currencyCode, defaultCurrency) : "";
              return (
                <tr key={row.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">{row.date}</td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    <span className="block max-w-[14rem] truncate" title={row.vendor}>
                      {row.vendor}
                    </span>
                    {!row.totalMatchesLineItems && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        Total ≠ line items
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <span className="block max-w-[10rem] truncate" title={row.project}>
                      {row.project || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-900 dark:text-zinc-50">
                    {minorUnitsToDecimal(row.totalMinor)} {row.currencyCode}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        row.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                      )}
                    >
                      {row.status === "confirmed" ? "Confirmed" : "Needs review"}
                    </span>
                    {multicurrency && (
                      <span
                        title={message}
                        className="ml-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      >
                        [Multicurrency soon]
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.status === "needs_review" && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={multicurrency || pendingId === row.id}
                          title={multicurrency ? message : undefined}
                          onClick={() => confirmInvoice(row)}
                        >
                          Confirm
                        </Button>
                      )}
                      <form onSubmit={(event) => saveTotal(event, row)} className="flex items-center gap-1.5">
                        <input
                          aria-label={`Total for ${row.vendor}`}
                          value={edits[row.id] ?? minorUnitsToDecimal(row.totalMinor)}
                          onChange={(event) =>
                            setEdits((current) => ({ ...current, [row.id]: event.target.value }))
                          }
                          className="h-7 w-24 rounded-lg border border-zinc-200 bg-white px-2 text-right text-sm text-zinc-900 outline-none focus-visible:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                        <Button type="submit" variant="outline" size="sm" disabled={pendingId === row.id}>
                          Save
                        </Button>
                      </form>
                    </div>
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