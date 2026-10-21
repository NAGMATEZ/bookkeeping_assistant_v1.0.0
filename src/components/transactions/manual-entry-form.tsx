"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground";

export function ManualEntryForm() {
  const router = useRouter();
  const t = useT();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function handleAmountChange(value: string): void {
    setAmount(value);
    const trimmed = value.trim();
    if (trimmed.startsWith("-") || trimmed.startsWith("(")) {
      setIsIncome(false);
    } else if (trimmed.startsWith("+")) {
      setIsIncome(true);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "saving" });
    const trimmed = amount.trim();
    const signedIncome = /^[-+(]/.test(trimmed)
      ? !trimmed.startsWith("-") && !trimmed.startsWith("(")
      : isIncome;

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, amount, isIncome, category, project, description }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (!response.ok || body?.ok !== true) {
        setStatus({
          kind: "error",
          message: body?.message ?? t("transactions.saveFailedHttp", { status: response.status }),
        });
        return;
      }

      setStatus({
        kind: "success",
        message: signedIncome ? t("transactions.addedIncome") : t("transactions.addedExpense"),
      });
      setAmount("");
      setDescription("");
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message: t("transactions.saveFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t("manual.date")}
        <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t("manual.amount")}
        <input
          required
          inputMode="decimal"
          placeholder={t("manual.amountPlaceholder")}
          value={amount}
          onChange={(event) => handleAmountChange(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        {t("manual.direction")}
        <div
          role="group"
          aria-label={t("manual.direction")}
          className="flex h-9 items-center gap-1 rounded-lg border border-input p-1"
        >
          <button
            type="button"
            aria-pressed={!isIncome}
            onClick={() => setIsIncome(false)}
            className={`h-full flex-1 rounded-md text-sm font-medium transition-colors ${
              !isIncome ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "text-muted-foreground"
            }`}
          >
            {t("common.expense")}
          </button>
          <button
            type="button"
            aria-pressed={isIncome}
            onClick={() => setIsIncome(true)}
            className={`h-full flex-1 rounded-md text-sm font-medium transition-colors ${
              isIncome ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "text-muted-foreground"
            }`}
          >
            {t("common.income")}
          </button>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t("manual.category")}
        <input required value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t("manual.project")}
        <input value={project} onChange={(event) => setProject(event.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
        {t("manual.description")}
        <input value={description} onChange={(event) => setDescription(event.target.value)} className={INPUT_CLASS} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={status.kind === "saving"}>
          {status.kind === "saving" ? t("common.saving") : t("manual.add")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("manual.signedHint")}</span>
        {status.kind === "success" && (
          <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
