import { eq } from "drizzle-orm";

import { settings } from "@/db/schema";
import { db } from "@/lib/db";

export type SettingSource = "db" | "env" | "default";
export type ResolvedSetting = { value: string; source: SettingSource } | null;

// Fresh installs should be usable immediately instead of greeting the user with a guardrail.
const SETTING_DEFAULTS: Record<string, string> = { DEFAULT_CURRENCY: "HUF" };

export async function resolveSetting(key: string): Promise<ResolvedSetting> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const stored = rows[0]?.value;

  if (stored !== undefined && stored !== "") {
    return { value: stored, source: "db" };
  }

  const fromEnv = process.env[key];
  if (fromEnv !== undefined && fromEnv !== "") {
    return { value: fromEnv, source: "env" };
  }

  const fallback = SETTING_DEFAULTS[key];
  if (fallback !== undefined) {
    return { value: fallback, source: "default" };
  }

  return null;
}

export async function getOpeningBalanceMinor(currencyCode: string): Promise<number> {
  const resolved = await resolveSetting(`OPENING_BALANCE_${currencyCode}`);
  if (!resolved) {
    return 0;
  }

  const minorUnits = Number(resolved.value);
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`OPENING_BALANCE_${currencyCode} must be an integer number of minor units`);
  }
  return minorUnits;
}