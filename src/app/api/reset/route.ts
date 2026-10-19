import { z } from "zod";

import { invoices, settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { failureResponse } from "@/lib/diagnostics";
import { checkStartup } from "@/lib/startup-gate";

/**
 * POST /api/reset
 * Body: { confirm: true, confirmation: "DELETE" } — the literal word is a deliberate guard against a
 * stray fetch/click. Deletes every transaction, invoice, and setting. Response:
 * { ok: true, deleted: { transactions, invoices, settings } } | { ok: false, message } (400/500/503).
 */
const payloadSchema = z
  .object({
    confirm: z.literal(true),
    confirmation: z.literal("DELETE"),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          message: 'Reset requires { "confirm": true, "confirmation": "DELETE" }',
        },
        { status: 400 },
      );
    }

    const deletedTransactions = await db.delete(transactions).returning({ id: transactions.id });
    const deletedInvoices = await db.delete(invoices).returning({ id: invoices.id });
    const deletedSettings = await db.delete(settings).returning({ key: settings.key });

    return Response.json({
      ok: true,
      deleted: {
        transactions: deletedTransactions.length,
        invoices: deletedInvoices.length,
        settings: deletedSettings.length,
      },
    });
  } catch (error) {
    const failure = failureResponse("reset", error, "Deleting all data failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}
