"use client";

import { useState, type FormEvent } from "react";

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
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus-visible:ring-zinc-700";

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
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className={INPUT_CLASS}
      />
      {hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: SettingsFormInitialValues }) {
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
          message: body?.message ?? `Saving settings failed with HTTP ${response.status}`,
        });
        return;
      }

      if (payload.PRIMARY_API_KEY) setPrimaryApiKeySet(true);
      if (payload.SECONDARY_API_KEY) setSecondaryApiKeySet(true);
      setPrimaryApiKey("");
      setSecondaryApiKey("");
      setStatus({ kind: "success", message: "Settings saved" });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error ? `Saving settings failed: ${error.message}` : "Saving settings failed",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          Primary LLM provider
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Base URL" value={primaryBaseUrl} onChange={setPrimaryBaseUrl} placeholder="https://api.example.com/v1" />
          <TextField label="Model" value={primaryModel} onChange={setPrimaryModel} placeholder="vision-model-name" />
        </div>
        <TextField
          label="API key"
          type="password"
          autoComplete="off"
          value={primaryApiKey}
          onChange={setPrimaryApiKey}
          placeholder={primaryApiKeySet ? "•••••••• (saved)" : "Not set"}
          hint="Required. Stored AES-256-GCM encrypted. Leave empty to keep the saved key."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          Secondary LLM provider (optional)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Base URL" value={secondaryBaseUrl} onChange={setSecondaryBaseUrl} placeholder="https://api.example.com/v1" />
          <TextField label="Model" value={secondaryModel} onChange={setSecondaryModel} placeholder="vision-model-name" />
        </div>
        <TextField
          label="API key"
          type="password"
          autoComplete="off"
          value={secondaryApiKey}
          onChange={setSecondaryApiKey}
          placeholder={secondaryApiKeySet ? "•••••••• (saved)" : "Not set"}
          hint="Optional fallback. Clear all secondary fields to remove it; an empty key keeps the saved one."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold tracking-wide text-zinc-900 uppercase dark:text-zinc-50">
          Currency
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Default currency"
            value={defaultCurrency}
            onChange={(value) => setDefaultCurrency(value.toUpperCase())}
            placeholder="USD"
            maxLength={3}
            hint="ISO 4217 code. The one currency invoices can be confirmed into."
          />
          <TextField
            label="Opening balance"
            value={openingBalance}
            onChange={setOpeningBalance}
            placeholder="1000.00"
            hint="Decimal amount; converted to minor units on save."
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save settings"}
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