"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function ManualEntryForm() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "saving" });

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
          message: body?.message ?? `Saving the transaction failed with HTTP ${response.status}`,
        });
        return;
      }

      setStatus({ kind: "success", message: isIncome ? "Income recorded." : "Expense recorded." });
      setAmount("");
      setDescription("");
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error ? `Saving the transaction failed: ${error.message}` : "Saving the transaction failed",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Date
        <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Amount
        <input
          required
          inputMode="decimal"
          placeholder="12.34"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <div className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Direction
        <div className="flex h-9 items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
          <button
            type="button"
            aria-pressed={!isIncome}
            onClick={() => setIsIncome(false)}
            className={`h-full flex-1 rounded-md text-sm font-medium transition-colors ${
              !isIncome ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "text-zinc-500"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            aria-pressed={isIncome}
            onClick={() => setIsIncome(true)}
            className={`h-full flex-1 rounded-md text-sm font-medium transition-colors ${
              isIncome ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "text-zinc-500"
            }`}
          >
            Income
          </button>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Category
        <input required value={category} onChange={(event) => setCategory(event.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Project
        <input value={project} onChange={(event) => setProject(event.target.value)} className={INPUT_CLASS} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Description
        <input value={description} onChange={(event) => setDescription(event.target.value)} className={INPUT_CLASS} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6">
        <Button type="submit" disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Add transaction"}
        </Button>
        {status.kind === "success" && (
          <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
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