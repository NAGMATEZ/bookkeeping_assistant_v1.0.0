"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useLocale, useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { InvoiceLineItem } from "@/lib/invoice-parse";
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
  lineItems: InvoiceLineItem[];
  totalMatchesLineItems: boolean;
  hasSourceImage: boolean;
  sourceMime: string | null;
};

type Feedback = { kind: "error" | "success"; message: string } | null;
type LineDraft = { description: string; net: string; vat: string; gross: string };
type Draft = { net: string; vat: string; gross: string; lineItems: LineDraft[] };
type LineSums = { netMinor: number; vatMinor: number; grossMinor: number };

const AMOUNT_INPUT =
  "h-8 w-28 rounded-lg border border-input bg-background px-2 text-right text-sm text-foreground";
const LINE_DESCRIPTION_INPUT =
  "h-8 min-w-0 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";
const LINE_AMOUNT_INPUT =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-right text-sm text-foreground";

function isBlankLine(item: LineDraft): boolean {
  return (
    item.description.trim() === "" &&
    item.net.trim() === "" &&
    item.vat.trim() === "" &&
    item.gross.trim() === ""
  );
}

function lineItemSums(lineItems: LineDraft[]): LineSums | null {
  const sums: LineSums = { netMinor: 0, vatMinor: 0, grossMinor: 0 };
  for (const item of lineItems) {
    if (isBlankLine(item)) {
      continue;
    }
    try {
      sums.netMinor += parseDecimalToMinorUnits(item.net);
      sums.vatMinor += parseDecimalToMinorUnits(item.vat);
      sums.grossMinor += parseDecimalToMinorUnits(item.gross);
    } catch {
      return null;
    }
  }
  return sums;
}

function lineItemMismatch(item: LineDraft): boolean {
  if (isBlankLine(item)) {
    return false;
  }
  try {
    return (
      parseDecimalToMinorUnits(item.net) + parseDecimalToMinorUnits(item.vat) !==
      parseDecimalToMinorUnits(item.gross)
    );
  } catch {
    return false;
  }
}

function lineItemsMismatch(draft: Draft): boolean {
  if (draft.lineItems.length === 0) {
    return false;
  }
  const sums = lineItemSums(draft.lineItems);
  if (sums === null) {
    return false;
  }
  try {
    return (
      sums.netMinor !== parseDecimalToMinorUnits(draft.net) ||
      sums.vatMinor !== parseDecimalToMinorUnits(draft.vat) ||
      sums.grossMinor !== parseDecimalToMinorUnits(draft.gross)
    );
  } catch {
    return false;
  }
}

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
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  function buildDraft(row: InvoiceTableRow): Draft {
    return {
      net: minorUnitsToDecimal(row.netMinor),
      vat: minorUnitsToDecimal(row.vatMinor),
      gross: minorUnitsToDecimal(row.grossMinor),
      lineItems: row.lineItems.map((item) => ({
        description: item.description,
        net: minorUnitsToDecimal(item.netMinor),
        vat: minorUnitsToDecimal(item.vatMinor),
        gross: minorUnitsToDecimal(item.grossMinor),
      })),
    };
  }

  function draftFor(row: InvoiceTableRow): Draft {
    return drafts[row.id] ?? buildDraft(row);
  }

  function updateDraft(row: InvoiceTableRow, field: keyof Omit<Draft, "lineItems">, value: string): void {
    setDrafts((current) => ({
      ...current,
      [row.id]: { ...(current[row.id] ?? buildDraft(row)), [field]: value },
    }));
  }

  function updateLineItem(
    row: InvoiceTableRow,
    index: number,
    field: keyof LineDraft,
    value: string,
  ): void {
    setDrafts((current) => {
      const draft = current[row.id] ?? buildDraft(row);
      return {
        ...current,
        [row.id]: {
          ...draft,
          lineItems: draft.lineItems.map((item, itemIndex) =>
            itemIndex === index ? { ...item, [field]: value } : item,
          ),
        },
      };
    });
  }

  function addLineItem(row: InvoiceTableRow): void {
    setDrafts((current) => {
      const draft = current[row.id] ?? buildDraft(row);
      return {
        ...current,
        [row.id]: {
          ...draft,
          lineItems: [
            ...draft.lineItems,
            { description: "", net: "", vat: "", gross: "" },
          ],
        },
      };
    });
  }

  function removeLineItem(row: InvoiceTableRow, index: number): void {
    setDrafts((current) => {
      const draft = current[row.id] ?? buildDraft(row);
      return {
        ...current,
        [row.id]: {
          ...draft,
          lineItems: draft.lineItems.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
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

    const lineItems: InvoiceLineItem[] = [];
    for (const item of draft.lineItems) {
      if (isBlankLine(item)) {
        continue;
      }
      if (item.description.trim() === "") {
        setFeedback({ kind: "error", message: t("invoices.lineDescriptionRequired") });
        return;
      }
      try {
        lineItems.push({
          description: item.description.trim(),
          netMinor: parseDecimalToMinorUnits(item.net),
          vatMinor: parseDecimalToMinorUnits(item.vat),
          grossMinor: parseDecimalToMinorUnits(item.gross),
        });
      } catch (error) {
        setFeedback({
          kind: "error",
          message: t("invoices.invalidLineAmount", {
            detail: error instanceof Error ? error.message : t("errors.unknown"),
          }),
        });
        return;
      }
    }

    setPendingId(row.id);
    try {
      const response = await fetch(`/api/invoices/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          net_minor: netMinor,
          vat_minor: vatMinor,
          gross_minor: grossMinor,
          line_items: lineItems.map((item) => ({
            description: item.description,
            net_minor: item.netMinor,
            vat_minor: item.vatMinor,
            gross_minor: item.grossMinor,
          })),
        }),
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
        className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm"
        role="region"
        aria-label={t("common.dataTable")}
        tabIndex={0}
      >
        <table className="w-full min-w-[68rem] border-collapse text-sm">
          <caption className="sr-only">{t("invoices.title")}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
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
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-foreground/80">{row.date}</td>
                  <td className="px-4 py-3 text-foreground">
                    <span className="block max-w-[14rem] truncate" title={row.vendor}>
                      {row.vendor}
                    </span>
                    {row.lineItems.length > 0 && !row.totalMatchesLineItems && (
                      <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        {t("invoices.lineItemsMismatch")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/80">
                    <span className="block max-w-[10rem] truncate" title={row.project}>
                      {row.project || t("common.dash")}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-foreground/80">
                    {formatMoney(row.netMinor, row.currencyCode, locale)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums text-foreground/80">
                    {formatMoney(row.vatMinor, row.currencyCode, locale)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-medium tabular-nums text-foreground">
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
              const lineSums = lineItemSums(draft.lineItems);
              const sourceHref = `/api/invoices/${row.id}/image`;
              return (
                <tr
                  key={`${row.id}-details`}
                  id={`invoice-details-${row.id}`}
                  className="border-b border-border/60 bg-muted/40 last:border-0"
                >
                  <td colSpan={8} className="px-4 py-5">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                      <form onSubmit={(event) => saveAmounts(event, row)} className="space-y-5">
                        <section className="space-y-3">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              {t("invoices.lineItems")}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {t("invoices.lineItemsHelper")}
                            </p>
                          </div>
                          {draft.lineItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("invoices.noLines")}</p>
                          ) : (
                            <div className="space-y-2">
                              {draft.lineItems.map((item, index) => (
                                <div
                                  key={index}
                                  className="space-y-2 rounded-lg border border-border/70 bg-background/60 p-2.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item.description}
                                      onChange={(event) =>
                                        updateLineItem(row, index, "description", event.target.value)
                                      }
                                      aria-label={t("invoices.lineDescription")}
                                      placeholder={t("invoices.lineDescription")}
                                      className={LINE_DESCRIPTION_INPUT}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeLineItem(row, index)}
                                      aria-label={t("common.remove")}
                                      title={t("common.remove")}
                                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <label className="flex flex-col gap-1 text-[0.68rem] font-medium text-muted-foreground">
                                      {t("invoices.lineNet")}
                                      <input
                                        inputMode="decimal"
                                        value={item.net}
                                        onChange={(event) =>
                                          updateLineItem(row, index, "net", event.target.value)
                                        }
                                        aria-label={t("invoices.lineNet")}
                                        className={LINE_AMOUNT_INPUT}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-[0.68rem] font-medium text-muted-foreground">
                                      {t("invoices.lineVat")}
                                      <input
                                        inputMode="decimal"
                                        value={item.vat}
                                        onChange={(event) =>
                                          updateLineItem(row, index, "vat", event.target.value)
                                        }
                                        aria-label={t("invoices.lineVat")}
                                        className={LINE_AMOUNT_INPUT}
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1 text-[0.68rem] font-medium text-muted-foreground">
                                      {t("invoices.lineGross")}
                                      <input
                                        inputMode="decimal"
                                        value={item.gross}
                                        onChange={(event) =>
                                          updateLineItem(row, index, "gross", event.target.value)
                                        }
                                        aria-label={t("invoices.lineGross")}
                                        className={LINE_AMOUNT_INPUT}
                                      />
                                    </label>
                                  </div>
                                  {lineItemMismatch(item) && (
                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                      {t("invoices.lineItemMismatch")}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <Button type="button" variant="outline" size="sm" onClick={() => addLineItem(row)}>
                            + {t("invoices.addLine")}
                          </Button>
                          {draft.lineItems.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">
                                {t("invoices.lineItemsSum")}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="rounded-lg bg-muted px-3 py-2">
                                  <span className="block text-[0.68rem] font-medium uppercase text-muted-foreground">
                                    {t("common.net")}
                                  </span>
                                  <span className="text-sm font-semibold tabular-nums text-foreground">
                                    {lineSums === null
                                      ? t("common.dash")
                                      : formatMoney(lineSums.netMinor, row.currencyCode, locale)}
                                  </span>
                                </div>
                                <div className="rounded-lg bg-muted px-3 py-2">
                                  <span className="block text-[0.68rem] font-medium uppercase text-muted-foreground">
                                    {t("common.vat")}
                                  </span>
                                  <span className="text-sm font-semibold tabular-nums text-foreground">
                                    {lineSums === null
                                      ? t("common.dash")
                                      : formatMoney(lineSums.vatMinor, row.currencyCode, locale)}
                                  </span>
                                </div>
                                <div className="rounded-lg bg-muted px-3 py-2">
                                  <span className="block text-[0.68rem] font-medium uppercase text-muted-foreground">
                                    {t("common.gross")}
                                  </span>
                                  <span className="text-sm font-semibold tabular-nums text-foreground">
                                    {lineSums === null
                                      ? t("common.dash")
                                      : formatMoney(lineSums.grossMinor, row.currencyCode, locale)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          {lineItemsMismatch(draft) && (
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                              {t("invoices.lineItemsTotalsMismatch")}
                            </p>
                          )}
                        </section>

                        <section className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground">
                            {t("invoices.totals")}
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                              {t("common.net")}
                              <input
                                inputMode="decimal"
                                value={draft.net}
                                onChange={(event) => updateDraft(row, "net", event.target.value)}
                                className={AMOUNT_INPUT}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                              {t("common.vat")}
                              <input
                                inputMode="decimal"
                                value={draft.vat}
                                onChange={(event) => updateDraft(row, "vat", event.target.value)}
                                className={AMOUNT_INPUT}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
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
                        </section>
                      </form>

                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {t("invoices.sourceImage")}
                        </h3>
                        {row.hasSourceImage ? (
                          <>
                            <div className="overflow-hidden rounded-lg border border-border bg-muted/40">
                              {row.sourceMime?.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={sourceHref}
                                  alt={t("invoices.sourceImage")}
                                  className="max-h-[32rem] w-full object-contain"
                                />
                              ) : row.sourceMime === "application/pdf" ? (
                                <iframe
                                  src={sourceHref}
                                  title={t("invoices.sourceImage")}
                                  className="h-[32rem] w-full bg-background"
                                />
                              ) : (
                                <p className="p-4 text-sm text-muted-foreground">
                                  {t("invoices.sourceUnavailable")}
                                </p>
                              )}
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs text-muted-foreground">
                                {t("invoices.sourceHint")}
                              </p>
                              <a
                                href={sourceHref}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-xs font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400"
                              >
                                {t("invoices.openSource")}
                              </a>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
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
