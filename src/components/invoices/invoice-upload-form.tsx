"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function InvoiceUploadForm() {
  const router = useRouter();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setStatus({ kind: "error", message: t("invoices.chooseFile") });
      return;
    }

    setStatus({ kind: "uploading" });
    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch("/api/invoices", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        duplicate?: boolean;
        message?: string;
      } | null;

      if (!response.ok || body?.ok !== true) {
        setStatus({
          kind: "error",
          message: body?.message ?? t("invoices.uploadFailedHttp", { status: response.status }),
        });
        return;
      }

      setStatus({
        kind: "success",
        message: body.duplicate ? t("invoices.uploadDuplicate") : t("invoices.uploadSuccess"),
      });
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message: t("invoices.uploadFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-200"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status.kind === "uploading"} className="shrink-0">
          {status.kind === "uploading" ? t("invoices.uploading") : t("invoices.upload")}
        </Button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("invoices.uploadHint")}</span>
      </div>
      {status.kind === "success" && (
        <p role="status" className="text-sm font-medium text-emerald-600 sm:ml-2 dark:text-emerald-400">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="text-sm font-medium text-red-600 sm:ml-2 dark:text-red-400">
          {status.message}
        </p>
      )}
    </form>
  );
}
