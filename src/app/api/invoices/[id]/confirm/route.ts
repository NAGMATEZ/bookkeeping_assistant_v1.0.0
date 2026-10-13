import { failureResponse } from "@/lib/diagnostics";
import { confirmInvoice } from "@/lib/invoices";
import { checkStartup } from "@/lib/startup-gate";

/**
 * POST /api/invoices/:id/confirm
 * Confirms a needs_review invoice whose currency equals DEFAULT_CURRENCY: atomically sets status=confirmed and
 * creates a linked transaction (amount_minor = -total_minor, currency copied, category = suggested_category
 * re-derived from raw_llm_response, falling back to "Invoice").
 * Rejects non-default-currency invoices with the multi-currency message before any DB write.
 * Response: { ok: true, transactionId } | { ok: false, message } (400/404/409/500/503).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const { id } = await params;
    const result = await confirmInvoice(id);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({ ok: true, transactionId: result.transaction.id });
  } catch (error) {
    const failure = failureResponse("invoice confirm", error, "Confirming the invoice failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}