"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useLocale, useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { minorUnitsToDecimal, parseDecimalToMinorUnits } from "@/lib/money";
import { cn } from "@/lib/utils";

export type InvoiceTableRow = {
  id: string;
  date: string;
  vendor: string;
  project: string;
  totalMinor: number;
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
  currencyCode: string;
  status: "needs_review" | "confirmed";
  totalMatchesLineItems: boolean;
  hasSourceImage: boolean;
  sourceMime: string | null;
};

type Feedback = { kind: "error" | "success"; message: string } | null;
type Draft = { net: string; vat: string; gross: string };

const AMOUNT_INPUT =
  "h-8 w-28 rounded-lg border border-input bg-white px-2 text-right text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50";

function draftMismatch(draft: Draft): boolean {
  const toNumber = (value: string) => Number(value.replace(",", "."));
  const net = toNumber(draft.net);
  const vat = toNumber(draft.vat);
  const gross = toNumber(draft.gross);
  if (!Number.isFinite(net) || !Number.isFinite(vat) || !Number.isFinite(gross)) {
    return false;
  }
  return Math.round((net + vat) * 100) !== Math.round(gross * 100);
}

export function InvoiceTable({
  rows,
  defaultCurrency,
}: {
  rows: InvoiceTableRow[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSource, setShowSource] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  function draftFor(row: InvoiceTableRow): Draft {
    return (
      drafts[row.id] ?? {
        net: minorUnitsToDecimal(row.netMinor),
        vat: minorUnitsToDecimal(row.vatMinor),
        gross: minorUnitsToDecimal(row.grossMinor),
      }
    );
  }

  function updateDraft(row: InvoiceTableRow, field: keyof Draft, value: string): void {
    setDrafts((current) => ({
      ...current,
      [row.id]: { ...draftFor(row), [field]: value },
    }));
  }

  async function confirmInvoice(row: InvoiceTableRow) {
    setFeedback(null);
    setPendingId(row.id);
    try {
      const response = await fetch(`/api/invoices/${row.id}/confirm`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback({
          kind: "error",
          message: body?.message ?? t("invoices.confirmFailedHttp", { status: response.status }),
        });
        return;
      }
      setFeedback({ kind: "success", message: t("invoices.confirmed", { vendor: row.vendor }) });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: t("invoices.confirmFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    } finally {
      setPendingId(null);
    }
  }

  async function saveAmounts(event: FormEvent<HTMLFormElement>, row: InvoiceTableRow) {
    event.preventDefault();
    setFeedback(null);
    const draft = draftFor(row);

    let netMinor: number;
    let vatMinor: number;
    let grossMinor: number;
    try {
      netMinor = parseDecimalToMinorUnits(draft.net);
      vatMinor = parseDecimalToMinorUnits(draft.vat);
      grossMinor = parseDecimalToMinorUnits(draft.gross);
    } catch (error) {
      setFeedback({
        kind: "error",
        message: t("invoices.invalidAmount", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
      return;
    }

    setPendingId(row.id);
    try {
      const response = await fetch(`/api/invoices/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ net_minor: netMinor, vat_minor: vatMinor, gross_minor: grossMinor }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback({
          kind: "error",
          message: body?.message ?? t("invoices.saveFailedHttp", { status: response.status }),
        });
        return;
      }
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setFeedback({ kind: "success", message: t("invoices.saved") });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: t("invoices.saveFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    } finally {
      setPendingId(null);
    }
  }

  async function removeInvoice(row: InvoiceTableRow) {
    if (!window.confirm(t("invoices.deleteConfirm", { vendor: row.vendor }))) {
      return;
    }

    setFeedback(null);
    setPendingId(row.id);
    try {
      const response = await fetch(`/api/invoices/${row.id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback({
          kind: "error",
          message: body?.message ?? t("invoices.deleteFailedHttp", { status: response.status }),
        });
        return;
      }
      setFeedback({ kind: "success", message: t("invoices.deleted") });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: t("invoices.deleteFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
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
            feedback.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {feedback.message}
        </p>
      )}

      <div
        className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
        role="region"
        aria-label={t("common.dataTable")}
        tabIndex={0}
      >
        <table className="w-full min-w-[68rem] border-collapse text-sm">
          <caption className="sr-only">{t("invoices.title")}</caption>
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="px-4 py-3">{t("common.date")}</th>
              <th className="px-4 py-3">{t("common.vendor")}</th>
              <th className="px-4 py-3">{t("common.project")}</th>
              <th className="px-4 py-3 text-right">{t("common.net")}</th>
              <th className="px-4 py-3 text-right">{t("common.vat")}</th>
              <th className="px-4 py-3 text-right">{t("common.gross")}</th>
              <th className="px-4 py-3">{t("common.status")}</th>
              <th className="px-4 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const multicurrency = row.currencyCode !== defaultCurrency;
              const expanded = expandedId === row.id;

              return (
                <tr key={row.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">{row.date}</td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    <span className="block max-w-[14rem] truncate" title={row.vendor}>
                      {row.vendor}
                    </span>
                    {!row.totalMatchesLineItems && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {t("invoices.mismatch")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <span className="block max-w-[10rem] truncate" title={row.project}>
                      {row.project || t("common.dash")}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatMoney(row.netMinor, row.currencyCode, locale)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatMoney(row.vatMinor, row.currencyCode, locale)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatMoney(row.grossMinor || row.totalMinor, row.currencyCode, locale)}
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
                      {row.status === "confirmed"
                        ? t("invoices.statusConfirmed")
                        : t("invoices.statusNeedsReview")}
                    </span>
                    {multicurrency && (
                      <span
                        title={t("invoices.multicurrencyMessage", {
                          rowCurrency: row.currencyCode,
                          defaultCurrency,
                        })}
                        className="ml-2 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      >
                        {t("invoices.multicurrency")}
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
                          title={
                            multicurrency
                              ? t("invoices.multicurrencyMessage", {
                                  rowCurrency: row.currencyCode,
                                  defaultCurrency,
                                })
                              : undefined
                          }
                          onClick={() => confirmInvoice(row)}
                        >
                          {t("invoices.confirm")}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-expanded={expanded}
                        aria-controls={`invoice-details-${row.id}`}
                        aria-label={expanded ? t("invoices.collapse") : t("invoices.expand")}
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                      >
                        {expanded ? t("invoices.collapse") : t("invoices.expand")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={pendingId === row.id}
                        onClick={() => removeInvoice(row)}
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.map((row) => {
              if (expandedId !== row.id) {
                return null;
              }
              const draft = draftFor(row);
              const sourceShown = showSource[row.id] === true;
              return (
                <tr
                  key={`${row.id}-details`}
                  id={`invoice-details-${row.id}`}
                  className="border-b border-zinc-100 bg-zinc-50/70 last:border-0 dark:border-zinc-800/60 dark:bg-zinc-950/40"
                >
                  <td colSpan={8} className="px-4 py-5">
                    <div className="grid gap-6 lg:grid-cols-2">
                      <form onSubmit={(event) => saveAmounts(event, row)} className="space-y-3">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {t("invoices.totals")}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {t("common.net")}
                            <input
                              inputMode="decimal"
                              value={draft.net}
                              onChange={(event) => updateDraft(row, "net", event.target.value)}
                              className={AMOUNT_INPUT}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {t("common.vat")}
                            <input
                              inputMode="decimal"
                              value={draft.vat}
                              onChange={(event) => updateDraft(row, "vat", event.target.value)}
                              className={AMOUNT_INPUT}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {t("common.gross")}
                            <input
                              inputMode="decimal"
                              value={draft.gross}
                              onChange={(event) => updateDraft(row, "gross", event.target.value)}
                              className={AMOUNT_INPUT}
                            />
                          </label>
                        </div>
                        {draftMismatch(draft) && (
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            {t("invoices.mismatch")}
                          </p>
                        )}
                        <Button type="submit" size="sm" disabled={pendingId === row.id}>
                          {t("invoices.saveDetails")}
                        </Button>
                      </form>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {t("invoices.sourceImage")}
                        </h3>
                        {row.hasSourceImage ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setShowSource((current) => ({ ...current, [row.id]: !sourceShown }))
                              }
                            >
                              {sourceShown ? t("invoices.hideSource") : t("invoices.showSource")}
                            </Button>
                            {sourceShown &&
                              (row.sourceMime?.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`/api/invoices/${row.id}/image`}
                                  alt={t("invoices.sourceImage")}
                                  className="max-h-96 w-auto rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
                                />
                              ) : (
                                <a
                                  href={`/api/invoices/${row.id}/image`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block text-sm font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400"
                                >
                                  {t("invoices.showSource")}
                                </a>
                              ))}
                          </>
                        ) : (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {t("invoices.sourceUnavailable")}
                          </p>
                        )}
                      </div>
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
