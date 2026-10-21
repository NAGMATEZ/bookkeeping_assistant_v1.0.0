"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "success" | "error"; message: string };

export function ResetPanel() {
  const router = useRouter();
  const t = useT();
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const word = t("settings.confirmWord");
  const matches = confirmation.trim() === word;

  async function reset() {
    if (!matches) return;
    setStatus({ kind: "busy" });
    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, confirmation: confirmation.trim() }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || body?.ok !== true) {
        setStatus({
          kind: "error",
          message: body?.message ?? t("settings.resetFailedHttp", { status: response.status }),
        });
        return;
      }
      setConfirmation("");
      setStatus({ kind: "success", message: t("settings.resetSuccess") });
      router.refresh();
    } catch (error) {
      setStatus({
        kind: "error",
        message: t("settings.resetFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900/60 dark:bg-red-950/20">
      <h2 className="text-sm font-semibold tracking-wide text-red-800 uppercase dark:text-red-300">
        {t("settings.resetTitle")}
      </h2>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">{t("settings.resetWarning")}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {t("settings.resetTypePrompt", { word })}
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="h-9 w-44 rounded-lg border border-input bg-background px-3 font-mono text-sm text-foreground"
          />
        </label>
        <Button
          type="button"
          variant="destructive"
          disabled={!matches || status.kind === "busy"}
          onClick={reset}
        >
          {status.kind === "busy" ? t("settings.resetting") : t("settings.resetButton")}
        </Button>
        {status.kind === "success" && (
          <p role="status" className="text-sm font-medium text-positive">
            {status.message}
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {status.message}
          </p>
        )}
      </div>
    </section>
  );
}
