import { failureResponse } from "@/lib/diagnostics";
import { getInvoiceImage } from "@/lib/invoices";
import { checkStartup } from "@/lib/startup-gate";

/**
 * GET /api/invoices/:id/image
 * Streams the originally uploaded invoice file back for preview (image/* rendered inline, PDF embedded).
 * Response: raw bytes with the stored MIME type | 404 when the invoice has no stored source.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const { id } = await params;
    const image = await getInvoiceImage(id);
    if (!image) {
      return Response.json({ ok: false, message: "Invoice source file not found" }, { status: 404 });
    }

    return new Response(Buffer.from(image.base64, "base64"), {
      headers: {
        "Content-Type": image.mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const failure = failureResponse("invoice image", error, "Loading the invoice image failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}
