"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

import { useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n";

type FieldKey = "date" | "amount" | "description" | "category" | "project" | "direction";
type Mapping = Record<FieldKey, number | "">;

type Preview = {
  headers: string[];
  rows: string[][];
  totalRows: number;
};

const FIELD_LABEL_KEYS: Record<FieldKey, MessageKey> = {
  date: "import.date",
  amount: "import.amount",
  description: "import.description",
  category: "import.category",
  project: "import.project",
  direction: "import.direction",
};

const REQUIRED_FIELDS: FieldKey[] = ["date", "amount"];

const EMPTY_MAPPING: Mapping = {
  date: "",
  amount: "",
  description: "",
  category: "",
  project: "",
  direction: "",
};

const HEADER_HINTS: Record<FieldKey, string[]> = {
  date: ["date", "dátum", "datum"],
  amount: ["amount", "összeg", "osszeg", "value"],
  description: ["description", "leírás", "leiras", "megjegyzés", "note", "memo"],
  category: ["category", "kategória", "kategoria"],
  project: ["project", "projekt"],
  direction: ["direction", "irány", "irany", "type", "típus", "tipus"],
};

function suggestMapping(headers: string[]): Mapping {
  const mapping: Mapping = { ...EMPTY_MAPPING };
  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    (Object.keys(HEADER_HINTS) as FieldKey[]).forEach((field) => {
      if (mapping[field] === "" && HEADER_HINTS[field].some((hint) => normalized.includes(hint))) {
        mapping[field] = index;
      }
    });
  });
  return mapping;
}

export function ImportWizard() {
  const router = useRouter();
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setOverrides({});
    setFeedback(null);
    if (!selected) return;

    setBusy("preview");
    try {
      const form = new FormData();
      form.append("file", selected);
      const response = await fetch("/api/import/preview", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as (Preview & { ok?: boolean; message?: string }) | null;
      if (!response.ok || body?.ok !== true) {
        setFeedback({
          kind: "error",
          message: body?.message ?? t("import.previewFailedHttp", { status: response.status }),
        });
        return;
      }
      setPreview({ headers: body.headers, rows: body.rows, totalRows: body.totalRows });
      setMapping(suggestMapping(body.headers));
    } catch (error) {
      setFeedback({
        kind: "error",
        message: t("import.previewFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!file || !preview) return;
    const missing = REQUIRED_FIELDS.filter((field) => mapping[field] === "");
    if (missing.length > 0) {
      setFeedback({
        kind: "error",
        message: t("import.mapRequired", {
          fields: missing.map((field) => t(FIELD_LABEL_KEYS[field])).join(", "),
        }),
      });
      return;
    }

    setBusy("import");
    setFeedback(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append(
        "mapping",
        JSON.stringify(
          Object.fromEntries(
            (Object.keys(mapping) as FieldKey[])
              .filter((field) => mapping[field] !== "")
              .map((field) => [field, mapping[field]]),
          ),
        ),
      );
      form.append("overrides", JSON.stringify(overrides));

      const response = await fetch("/api/import", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        inserted?: number;
        skipped?: Array<{ rowIndex: number; reason: string }>;
        message?: string;
      } | null;

      if (!response.ok || body?.ok !== true) {
        setFeedback({
          kind: "error",
          message: body?.message ?? t("import.importFailedHttp", { status: response.status }),
        });
        return;
      }

      const skipped = body.skipped ?? [];
      setFeedback({
        kind: "success",
        message:
          skipped.length === 0
            ? t("import.imported", { count: body.inserted ?? 0 })
            : t("import.importedWithSkips", {
                count: body.inserted ?? 0,
                skipped: skipped.length,
                details: skipped
                  .map((row) =>
                    t("import.rowDetail", { row: row.rowIndex + 1, reason: row.reason }),
                  )
                  .join("; "),
              }),
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: t("import.importFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    } finally {
      setBusy(null);
    }
  }

  function headerLabel(header: string, index: number): string {
    return header || t("import.columnFallback", { index: index + 1 });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t("import.fileLabel")}
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
      </label>

      {busy === "preview" && (
        <p role="status" className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("import.reading")}
        </p>
      )}

      {preview && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(FIELD_LABEL_KEYS) as FieldKey[]).map((field) => (
              <label key={field} className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {t(FIELD_LABEL_KEYS[field])}
                <select
                  value={mapping[field]}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: event.target.value === "" ? "" : Number(event.target.value),
                    }))
                  }
                  className="h-9 rounded-lg border border-input bg-white px-2 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">{t("common.none")}</option>
                  {preview.headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {headerLabel(header, index)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("import.previewInfo", { shown: preview.rows.length, total: preview.totalRows })}
          </p>

          <div
            className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            role="region"
            aria-label={t("common.dataTable")}
            tabIndex={0}
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("import.fileLabel")}</caption>
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-3 py-2">{t("import.rowNumber")}</th>
                  {preview.headers.map((header, index) => (
                    <th key={`${header}-${index}`} className="px-3 py-2">
                      {headerLabel(header, index)}
                    </th>
                  ))}
                  <th className="px-3 py-2">{t("import.directionOverride")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, rowIndex) => {
                  const override = overrides[rowIndex];
                  return (
                    <tr key={rowIndex} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{rowIndex + 1}</td>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="max-w-[12rem] truncate px-3 py-2 text-zinc-700 dark:text-zinc-300">
                          {cell}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <div
                          role="group"
                          aria-label={`${t("import.directionOverride")} - ${rowIndex + 1}`}
                          className="flex items-center gap-1"
                        >
                          <button
                            type="button"
                            aria-pressed={override === true}
                            onClick={() => setOverrides((current) => ({ ...current, [rowIndex]: true }))}
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              override === true
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {t("common.income")}
                          </button>
                          <button
                            type="button"
                            aria-pressed={override === false}
                            onClick={() => setOverrides((current) => ({ ...current, [rowIndex]: false }))}
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              override === false
                                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                : "text-zinc-500 dark:text-zinc-400"
                            }`}
                          >
                            {t("common.expense")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleImport} disabled={busy === "import"}>
              {busy === "import"
                ? t("import.importing")
                : t("import.importAll", { count: preview.totalRows })}
            </Button>
            {feedback?.kind === "success" && (
              <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {feedback.message}
              </p>
            )}
          </div>
        </>
      )}

      {feedback?.kind === "error" && (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {feedback.message}
        </p>
      )}
    </div>
  );
}
