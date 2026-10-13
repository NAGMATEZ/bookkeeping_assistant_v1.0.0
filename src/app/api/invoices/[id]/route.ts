import { z } from "zod";

import { failureResponse } from "@/lib/diagnostics";
import { updateInvoiceTotal } from "@/lib/invoices";
import { checkStartup } from "@/lib/startup-gate";

/**
 * PATCH /api/invoices/:id
 * Body: { total_minor: number } — integer minor units within the 1,000,000,000 cap.
 * Atomically updates the invoice total and, when a linked transaction exists, the transaction's
 * amount_minor to -total_minor.
 * Response: { ok: true, total_minor } | { ok: false, message } (400/404/500/503).
 */
const patchSchema = z.object({ total_minor: z.number().int() }).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const raw: unknown = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");
      return Response.json({ ok: false, message: `Invalid total payload — ${detail}` }, { status: 400 });
    }

    const { id } = await params;
    const result = await updateInvoiceTotal(id, parsed.data.total_minor);
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({ ok: true, total_minor: result.invoice.total_minor });
  } catch (error) {
    const failure = failureResponse("invoice total update", error, "Updating the invoice total failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}