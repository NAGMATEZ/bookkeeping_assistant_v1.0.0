"use client";

import { ArrowLeft, ArrowRight, Check, FileUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type DragEvent } from "react";

import { useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FieldKey = "date" | "amount" | "description" | "category" | "project" | "direction";
type Mapping = Record<FieldKey, number | "">;
type Step = 1 | 2 | 3;

type Preview = {
  headers: string[];
  rows: string[][];
  totalRows: number;
};

type ImportResult = {
  inserted: number;
  skipped: Array<{ rowIndex: number; reason: string }>;
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

const STEP_LABEL_KEYS: Record<Step, MessageKey> = {
  1: "import.stepUpload",
  2: "import.stepMap",
  3: "import.stepReview",
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepIndicator({ step }: { step: Step }) {
  const t = useT();

  return (
    <ol className="flex items-center gap-2" aria-label={t("import.steps")}>
      {([1, 2, 3] as Step[]).map((item, index) => {
        const done = step > item;
        const current = step === item;
        return (
          <li key={item} className={cn("flex items-center", index < 2 && "flex-1")}>
            <span
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                done && "bg-primary text-primary-foreground",
                current && "border-2 border-primary bg-background text-primary",
                !done && !current && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : item}
            </span>
            <span
              className={cn(
                "ml-2 hidden text-sm font-medium sm:block",
                current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(STEP_LABEL_KEYS[item])}
            </span>
            {index < 2 && (
              <span
                aria-hidden="true"
                className={cn("mx-3 h-0.5 flex-1", done ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function ImportWizard() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function loadPreview(selected: File): Promise<void> {
    setFile(selected);
    setPreview(null);
    setMapping(EMPTY_MAPPING);
    setOverrides({});
    setResult(null);
    setFeedback(null);
    setStep(1);
    setBusy("preview");

    try {
      const form = new FormData();
      form.append("file", selected);
      const response = await fetch("/api/import/preview", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as
        | (Preview & { ok?: boolean; message?: string })
        | null;
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (selected) {
      void loadPreview(selected);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    const selected = event.dataTransfer.files?.[0];
    if (selected) {
      void loadPreview(selected);
    }
  }

  function reset(): void {
    setStep(1);
    setFile(null);
    setPreview(null);
    setMapping(EMPTY_MAPPING);
    setOverrides({});
    setFeedback(null);
    setResult(null);
  }

  function goToMapping(): void {
    if (!preview) return;
    setFeedback(null);
    setStep(2);
  }

  function goToReview(): void {
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
    setFeedback(null);
    setStep(3);
  }

  async function handleImport(): Promise<void> {
    if (!file || !preview) return;

    setBusy("import");
    setResult(null);
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

      setResult({ inserted: body.inserted ?? 0, skipped: body.skipped ?? [] });
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

  const mappedFieldLabels = (Object.keys(FIELD_LABEL_KEYS) as FieldKey[])
    .filter((field) => mapping[field] !== "")
    .map((field) => t(FIELD_LABEL_KEYS[field]));

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">{t("import.uploadTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("import.uploadHint")}</p>

          <label
            htmlFor="import-file"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <FileUp className="size-9 text-muted-foreground" aria-hidden="true" />
            <span className="mt-3 text-sm font-semibold text-primary">{t("import.chooseFile")}</span>
            <span className="text-sm text-muted-foreground">{t("import.dropHint")}</span>
            <span className="mt-1 text-xs text-muted-foreground">{t("import.fileTypes")}</span>
            <input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {file && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileUp className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {preview ? ` · ${t("import.rowsCount", { count: preview.totalRows })}` : ""}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={busy !== null}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t("import.removeFile")}
              </Button>
            </div>
          )}

          {busy === "preview" && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              {t("import.reading")}
            </p>
          )}
        </section>
      )}

      {step === 2 && preview && (
        <>
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-4">
              <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                {t("import.mappingTitle")}
              </h2>
              <span className="truncate text-xs text-muted-foreground" title={file?.name}>
                {file?.name}
              </span>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {(Object.keys(FIELD_LABEL_KEYS) as FieldKey[]).map((field) => (
                <label
                  key={field}
                  className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"
                >
                  <span>
                    {t(FIELD_LABEL_KEYS[field])}
                    {REQUIRED_FIELDS.includes(field) && (
                      <span className="ml-1 text-destructive" aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  <select
                    value={mapping[field]}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field]: event.target.value === "" ? "" : Number(event.target.value),
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                  >
                    <option value="">{t("import.skipColumn")}</option>
                    {preview.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>
                        {headerLabel(header, index)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-4">
              <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                {t("import.previewTitle")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("import.previewInfo", {
                  shown: preview.rows.length,
                  total: preview.totalRows,
                })}
              </span>
            </div>

            <div
              className="overflow-x-auto"
              role="region"
              aria-label={t("common.dataTable")}
              tabIndex={0}
            >
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{t("import.fileLabel")}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="px-4 py-3">{t("import.rowNumber")}</th>
                    {preview.headers.map((header, index) => (
                      <th key={`${header}-${index}`} className="px-4 py-3">
                        {headerLabel(header, index)}
                      </th>
                    ))}
                    <th className="px-4 py-3">{t("import.directionOverride")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, rowIndex) => {
                    const override = overrides[rowIndex];
                    return (
                      <tr key={rowIndex} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">{rowIndex + 1}</td>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="max-w-[12rem] truncate px-4 py-3 text-foreground/80"
                          >
                            {cell}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div
                            role="group"
                            aria-label={`${t("import.directionOverride")} - ${rowIndex + 1}`}
                            className="flex items-center gap-1"
                          >
                            <button
                              type="button"
                              aria-pressed={override === true}
                              onClick={() =>
                                setOverrides((current) => ({ ...current, [rowIndex]: true }))
                              }
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-medium",
                                override === true
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "text-muted-foreground",
                              )}
                            >
                              {t("common.income")}
                            </button>
                            <button
                              type="button"
                              aria-pressed={override === false}
                              onClick={() =>
                                setOverrides((current) => ({ ...current, [rowIndex]: false }))
                              }
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-medium",
                                override === false
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                  : "text-muted-foreground",
                              )}
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
          </section>
        </>
      )}

      {step === 3 && preview && (
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Check className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">
                  {result ? t("import.importSuccess") : t("import.reviewTitle")}
                </h2>
                <p className="truncate text-sm text-muted-foreground" title={file?.name}>
                  {file?.name}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label={t("import.totalRows")} value={preview.totalRows} />
              <Stat label={t("import.previewRows")} value={preview.rows.length} />
              <Stat label={t("import.mappedFields")} value={mappedFieldLabels.length} />
            </div>

            {result === null ? (
              <p className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                {t("import.reviewHint")}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-positive">
                  {t("import.imported", { count: result.inserted })}
                </p>
                {result.skipped.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <p className="font-medium">
                      {t("import.skippedRows", { count: result.skipped.length })}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {result.skipped.map((row) => (
                        <li key={row.rowIndex}>
                          {t("import.rowDetail", {
                            row: row.rowIndex + 1,
                            reason: row.reason,
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={cn(
            "text-sm font-medium",
            feedback.kind === "error" ? "text-destructive" : "text-positive",
          )}
        >
          {feedback.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div>
          {step === 1 && file && (
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy !== null}>
              {t("common.cancel")}
            </Button>
          )}
          {step > 1 && result === null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFeedback(null);
                setStep((step - 1) as Step);
              }}
              disabled={busy !== null}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t("import.back")}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {step === 1 && (
            <Button
              type="button"
              onClick={goToMapping}
              disabled={!preview || busy !== null}
            >
              {busy === "preview" ? t("import.reading") : t("import.continueMapping")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
          {step === 2 && (
            <Button type="button" onClick={goToReview} disabled={busy !== null}>
              {t("import.continueReview")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
          {step === 3 && result === null && (
            <Button type="button" onClick={() => void handleImport()} disabled={busy === "import"}>
              {busy === "import" ? t("import.importing") : t("import.confirmImport")}
              <Check className="size-4" aria-hidden="true" />
            </Button>
          )}
          {step === 3 && result !== null && (
            <Button type="button" onClick={reset}>
              {t("import.importAnother")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
