import { eq } from "drizzle-orm";
import { z } from "zod";

import { settings } from "@/db/schema";
import { db } from "@/lib/db";
import { failureResponse } from "@/lib/diagnostics";
import { encryptSecret } from "@/lib/encryption";
import { parseDecimalToMinorUnits } from "@/lib/money";
import { resolveSetting } from "@/lib/settings";
import { checkStartup } from "@/lib/startup-gate";

/**
 * POST /api/settings
 * Body (all fields optional, unknown fields rejected):
 *   { PRIMARY_BASE_URL?, PRIMARY_MODEL?, PRIMARY_API_KEY?, SECONDARY_BASE_URL?, SECONDARY_MODEL?,
 *     SECONDARY_API_KEY?, DEFAULT_CURRENCY?, OPENING_BALANCE? }
 * - Non-empty string values are upserted into the settings table.
 * - The primary provider is required: when any PRIMARY_* field is present, base URL, model, and an API key
 *   (new or previously stored) must all exist, otherwise the save is rejected.
 * - The secondary provider is clearable: an empty SECONDARY_* string deletes that stored key.
 * - *_API_KEY values are AES-256-GCM encrypted before storage; an empty primary key leaves it unchanged.
 * - DEFAULT_CURRENCY must be a 3-letter ISO 4217 code.
 * - OPENING_BALANCE is a decimal string converted to minor units at this boundary and stored under
 *   OPENING_BALANCE_<DEFAULT_CURRENCY>.
 * Response: { ok: true, updated: number } | { ok: false, message: string } (status 400/500/503).
 */

const payloadSchema = z
  .object({
    PRIMARY_BASE_URL: z.string().optional(),
    PRIMARY_MODEL: z.string().optional(),
    PRIMARY_API_KEY: z.string().optional(),
    SECONDARY_BASE_URL: z.string().optional(),
    SECONDARY_MODEL: z.string().optional(),
    SECONDARY_API_KEY: z.string().optional(),
    DEFAULT_CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/, "DEFAULT_CURRENCY must be a 3-letter ISO 4217 code (e.g. USD)")
      .optional(),
    OPENING_BALANCE: z.string().optional(),
  })
  .strict();

const PRIMARY_KEYS = ["PRIMARY_BASE_URL", "PRIMARY_MODEL", "PRIMARY_API_KEY"] as const;
const SECONDARY_TEXT_KEYS = ["SECONDARY_BASE_URL", "SECONDARY_MODEL"] as const;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return json({ ok: false, message: startup.reason }, 503);
    }

    const raw: unknown = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");
      return json({ ok: false, message: `Invalid settings payload — ${detail}` }, 400);
    }

    const payload = parsed.data;
    const updates = new Map<string, string>();
    const deletes = new Set<string>();

    const primaryTouched = PRIMARY_KEYS.some((key) => payload[key] !== undefined);
    if (primaryTouched) {
      const checks = [
        ["PRIMARY_BASE_URL", "Primary base URL"],
        ["PRIMARY_MODEL", "Primary model"],
        ["PRIMARY_API_KEY", "Primary API key"],
      ] as const;
      for (const [key, label] of checks) {
        const submitted = payload[key]?.trim();
        const resolved = submitted ? { value: submitted } : await resolveSetting(key);
        if (!resolved?.value) {
          return json({ ok: false, message: `${label} is required` }, 400);
        }
      }
    }

    for (const key of [
      "PRIMARY_BASE_URL",
      "PRIMARY_MODEL",
      "SECONDARY_BASE_URL",
      "SECONDARY_MODEL",
      "DEFAULT_CURRENCY",
    ] as const) {
      const submitted = payload[key];
      if (submitted === undefined) {
        continue;
      }
      const value = submitted.trim();
      if (value) {
        updates.set(key, value);
      } else if ((SECONDARY_TEXT_KEYS as readonly string[]).includes(key)) {
        deletes.add(key);
      }
    }

    if (payload.PRIMARY_API_KEY !== undefined && payload.PRIMARY_API_KEY !== "") {
      updates.set("PRIMARY_API_KEY", encryptSecret(payload.PRIMARY_API_KEY));
    }

    if (payload.SECONDARY_API_KEY !== undefined) {
      if (payload.SECONDARY_API_KEY.trim() === "") {
        deletes.add("SECONDARY_API_KEY");
      } else {
        updates.set("SECONDARY_API_KEY", encryptSecret(payload.SECONDARY_API_KEY));
      }
    }

    const openingBalance = payload.OPENING_BALANCE?.trim();
    if (openingBalance) {
      const currency =
        payload.DEFAULT_CURRENCY?.trim() ?? (await resolveSetting("DEFAULT_CURRENCY"))?.value;
      if (!currency) {
        return json(
          { ok: false, message: "DEFAULT_CURRENCY must be set before saving an opening balance" },
          400,
        );
      }

      let minorUnits: number;
      try {
        minorUnits = parseDecimalToMinorUnits(openingBalance);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return json({ ok: false, message: `Invalid opening balance — ${detail}` }, 400);
      }
      updates.set(`OPENING_BALANCE_${currency}`, String(minorUnits));
    }

    if (deletes.size > 0) {
      const [first, ...rest] = [...deletes].map((key) =>
        db.delete(settings).where(eq(settings.key, key)),
      );
      if (first) {
        await db.batch([first, ...rest]);
      }
    }
    if (updates.size > 0) {
      const [first, ...rest] = [...updates].map(([key, value]) =>
        db
          .insert(settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: settings.key, set: { value } }),
      );
      if (first) {
        await db.batch([first, ...rest]);
      }
    }

    return json({ ok: true, updated: updates.size + deletes.size });
  } catch (error) {
    const failure = failureResponse("settings save", error, "Saving settings failed");
    return json({ ok: false, message: failure.message }, failure.status);
  }
}
