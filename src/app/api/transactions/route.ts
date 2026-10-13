import { z } from "zod";

import { failureResponse } from "@/lib/diagnostics";
import { checkStartup } from "@/lib/startup-gate";
import { createManualTransaction } from "@/lib/transactions";

/**
 * POST /api/transactions
 * Body: { date: "YYYY-MM-DD", amount: decimal string, isIncome: boolean, category: string,
 *         project: string, description: string }
 * Signs amount by isIncome and persists integer minor units in DEFAULT_CURRENCY (manual entries never accept
 * a currency field). description persists to transactions.description.
 * Response: { ok: true, transactionId } | { ok: false, message } (400/500/503).
 */
const payloadSchema = z
  .object({
    date: z.string(),
    amount: z.string(),
    isIncome: z.boolean(),
    category: z.string(),
    project: z.string().optional().default(""),
    description: z.string().optional().default(""),
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
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");
      return Response.json({ ok: false, message: `Invalid transaction payload — ${detail}` }, { status: 400 });
    }

    const result = await createManualTransaction(parsed.data);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({ ok: true, transactionId: result.transaction.id });
  } catch (error) {
    const failure = failureResponse("manual transaction", error, "Creating the transaction failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}