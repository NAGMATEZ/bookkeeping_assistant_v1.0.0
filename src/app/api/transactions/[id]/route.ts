import { failureResponse } from "@/lib/diagnostics";
import { checkStartup } from "@/lib/startup-gate";
import { deleteTransaction } from "@/lib/transactions";

/**
 * DELETE /api/transactions/:id
 * Deletes the transaction row (a linked invoice keeps its row; source_invoice_id lives on the transaction side).
 * Response: { ok: true } | { ok: false, message } (500/503).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const { id } = await params;
    await deleteTransaction(id);
    return Response.json({ ok: true });
  } catch (error) {
    const failure = failureResponse("transaction delete", error, "Deleting the transaction failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}