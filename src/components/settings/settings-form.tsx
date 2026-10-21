"use client";

import { useState, type FormEvent } from "react";

import { useT } from "@/components/layout/i18n-provider";
import { Button } from "@/components/ui/button";

export type SettingsFormInitialValues = {
  primaryBaseUrl: string;
  primaryModel: string;
  secondaryBaseUrl: string;
  secondaryModel: string;
  defaultCurrency: string;
  openingBalance: string;
  primaryApiKeySet: boolean;
  secondaryApiKeySet: boolean;
};

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground";

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  maxLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password";
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className={INPUT_CLASS}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: SettingsFormInitialValues }) {
  const t = useT();
  const [primaryBaseUrl, setPrimaryBaseUrl] = useState(initial.primaryBaseUrl);
  const [primaryModel, setPrimaryModel] = useState(initial.primaryModel);
  const [primaryApiKey, setPrimaryApiKey] = useState("");
  const [primaryApiKeySet, setPrimaryApiKeySet] = useState(initial.primaryApiKeySet);
  const [secondaryBaseUrl, setSecondaryBaseUrl] = useState(initial.secondaryBaseUrl);
  const [secondaryModel, setSecondaryModel] = useState(initial.secondaryModel);
  const [secondaryApiKey, setSecondaryApiKey] = useState("");
  const [secondaryApiKeySet, setSecondaryApiKeySet] = useState(initial.secondaryApiKeySet);
  const [defaultCurrency, setDefaultCurrency] = useState(initial.defaultCurrency);
  const [openingBalance, setOpeningBalance] = useState(initial.openingBalance);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "saving" });

    const payload: Record<string, string> = {
      PRIMARY_BASE_URL: primaryBaseUrl.trim(),
      PRIMARY_MODEL: primaryModel.trim(),
      SECONDARY_BASE_URL: secondaryBaseUrl.trim(),
      SECONDARY_MODEL: secondaryModel.trim(),
    };
    if (defaultCurrency.trim()) payload.DEFAULT_CURRENCY = defaultCurrency.trim().toUpperCase();
    if (openingBalance.trim()) payload.OPENING_BALANCE = openingBalance.trim();
    if (primaryApiKey !== "") payload.PRIMARY_API_KEY = primaryApiKey;
    // Empty secondary fields clear the optional fallback provider, including its stored key.
    if (secondaryApiKey !== "" || (secondaryBaseUrl.trim() === "" && secondaryModel.trim() === "")) {
      payload.SECONDARY_API_KEY = secondaryApiKey;
    }

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (!response.ok || body?.ok !== true) {
        setStatus({
          kind: "error",
          message: body?.message ?? t("settings.saveFailedHttp", { status: response.status }),
        });
        return;
      }

      if (payload.PRIMARY_API_KEY) setPrimaryApiKeySet(true);
      if (payload.SECONDARY_API_KEY) setSecondaryApiKeySet(true);
      setPrimaryApiKey("");
      setSecondaryApiKey("");
      setStatus({ kind: "success", message: t("settings.saved") });
    } catch (error) {
      setStatus({
        kind: "error",
        message: t("settings.saveFailed", {
          detail: error instanceof Error ? error.message : t("errors.unknown"),
        }),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold tracking-wide text-foreground uppercase">
          {t("settings.primary")}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("settings.baseUrl")}
            value={primaryBaseUrl}
            onChange={setPrimaryBaseUrl}
            placeholder="https://api.example.com/v1"
          />
          <TextField
            label={t("settings.model")}
            value={primaryModel}
            onChange={setPrimaryModel}
            placeholder="vision-model-name"
          />
        </div>
        <TextField
          label={t("settings.apiKey")}
          type="password"
          autoComplete="off"
          value={primaryApiKey}
          onChange={setPrimaryApiKey}
          placeholder={primaryApiKeySet ? t("settings.apiKeySaved") : t("settings.apiKeyNotSet")}
          hint={t("settings.apiKeyHint")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold tracking-wide text-foreground uppercase">
          {t("settings.secondary")}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("settings.baseUrl")}
            value={secondaryBaseUrl}
            onChange={setSecondaryBaseUrl}
            placeholder="https://api.example.com/v1"
          />
          <TextField
            label={t("settings.model")}
            value={secondaryModel}
            onChange={setSecondaryModel}
            placeholder="vision-model-name"
          />
        </div>
        <TextField
          label={t("settings.apiKey")}
          type="password"
          autoComplete="off"
          value={secondaryApiKey}
          onChange={setSecondaryApiKey}
          placeholder={secondaryApiKeySet ? t("settings.apiKeySaved") : t("settings.apiKeyNotSet")}
          hint={t("settings.secondaryHint")}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold tracking-wide text-foreground uppercase">
          {t("settings.currency")}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t("settings.defaultCurrency")}
            value={defaultCurrency}
            onChange={(value) => setDefaultCurrency(value.toUpperCase())}
            placeholder="USD"
            maxLength={3}
            hint={t("settings.defaultCurrencyHint")}
          />
          <TextField
            label={t("settings.openingBalance")}
            value={openingBalance}
            onChange={setOpeningBalance}
            placeholder="1000.00"
            hint={t("settings.openingBalanceHint")}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={status.kind === "saving"}>
          {status.kind === "saving" ? t("common.saving") : t("settings.save")}
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
    </form>
  );
}
