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
 * - *_API_KEY values are AES-256-GCM encrypted before storage; an empty/missing value leaves the stored key unchanged.
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

    for (const key of [
      "PRIMARY_BASE_URL",
      "PRIMARY_MODEL",
      "SECONDARY_BASE_URL",
      "SECONDARY_MODEL",
      "DEFAULT_CURRENCY",
    ] as const) {
      const value = payload[key]?.trim();
      if (value) {
        updates.set(key, value);
      }
    }

    for (const key of ["PRIMARY_API_KEY", "SECONDARY_API_KEY"] as const) {
      const value = payload[key];
      if (value !== undefined && value !== "") {
        updates.set(key, encryptSecret(value));
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

    if (updates.size > 0) {
      const statements = [...updates].map(([key, value]) =>
        db
          .insert(settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: settings.key, set: { value } }),
      );
      const [first, ...rest] = statements;
      await db.batch([first, ...rest]);
    }

    return json({ ok: true, updated: updates.size });
  } catch (error) {
    const failure = failureResponse("settings save", error, "Saving settings failed");
    return json({ ok: false, message: failure.message }, failure.status);
  }
}