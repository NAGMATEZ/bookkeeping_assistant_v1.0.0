import { failureResponse } from "@/lib/diagnostics";
import {
  createInvoiceFromLlm,
  getInvoiceByContentHash,
  hashUploadContent,
} from "@/lib/invoices";
import { dispatchChat, type ChatMessage } from "@/lib/llm";
import { resolveSetting } from "@/lib/settings";
import { checkStartup } from "@/lib/startup-gate";
import { checkUploadFile, checkUploadRateLimit } from "@/lib/upload-guard";

/**
 * POST /api/invoices
 * multipart/form-data with a single `file` field (PNG/JPEG/WEBP/PDF, ≤15MB pre-base64).
 * - Rejects unsupported/oversized files and rate-limited clients (10 uploads / 10 min per IP) before dispatch.
 * - Dedupes on the sha256 content hash: a repeated upload returns the existing invoice without re-dispatching.
 * - Sends the file as a base64 data URL to the primary/secondary LLM dispatcher, parses the JSON contract,
 *   validates data sanity, and stores the invoice as needs_review.
 * Response: { ok: true, invoiceId, duplicate, status } | { ok: false, message } (400/429/500/503).
 */

const OUTPUT_CONTRACT_PROMPT = `You extract structured data from invoice files. Respond with ONLY a JSON object matching exactly:
{"vendor": string, "date": "YYYY-MM-DD", "net_minor": integer, "vat_minor": integer, "gross_minor": integer, "total_minor": integer, "currency_code": string, "line_items": [{"description": string, "amount_minor": integer}], "suggested_category": string, "project": string}
Rules:
- net_minor is the pre-tax net, vat_minor is the tax, gross_minor is the final payable amount; total_minor must equal gross_minor.
- net_minor, vat_minor, gross_minor, total_minor and amount_minor are integer minor units (e.g. 1234 means 12.34 in the invoice currency). For zero-decimal currencies such as HUF, return the printed whole amount (the app normalizes it).
- If the invoice has no tax, set vat_minor to 0 and net_minor equal to gross_minor.
- currency_code must be the invoice's ISO 4217 code (e.g. "USD", "HUF").
- date must be the invoice date in YYYY-MM-DD form.
- suggested_category is a short expense category; use "" if you cannot tell.
- project is a short project label if identifiable; use "" otherwise.
No markdown fences, no commentary, JSON only.`;

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return json({ ok: false, message: startup.reason }, 503);
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientKey = forwardedFor?.split(",")[0]?.trim() || "local";
    const rate = checkUploadRateLimit(clientKey);
    if (!rate.allowed) {
      return json(
        { ok: false, message: `Too many uploads. Try again in ${rate.retryAfterSeconds} seconds.` },
        429,
        { "Retry-After": String(rate.retryAfterSeconds) },
      );
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return json(
        { ok: false, message: "No file was uploaded. Send a multipart/form-data request with a `file` field." },
        400,
      );
    }

    const verdict = checkUploadFile({ name: file.name, type: file.type, size: file.size });
    if (!verdict.ok) {
      return json({ ok: false, message: verdict.message }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentHash = hashUploadContent(buffer);

    const existing = await getInvoiceByContentHash(contentHash);
    if (existing) {
      return json({ ok: true, invoiceId: existing.id, duplicate: true, status: existing.status });
    }

    const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
    if (!defaultCurrency) {
      return json(
        {
          ok: false,
          message: "DEFAULT_CURRENCY is not set. Configure it in Settings before uploading invoices.",
        },
        503,
      );
    }

    const messages: ChatMessage[] = [
      { role: "system", content: OUTPUT_CONTRACT_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the invoice fields from the attached file and answer with the JSON object only.",
          },
          { type: "image_url", image_url: { url: `data:${file.type};base64,${buffer.toString("base64")}` } },
        ],
      },
    ];

    const dispatch = await dispatchChat(messages);
    const { invoice, duplicate } = await createInvoiceFromLlm({
      contentHash,
      rawLlmResponse: dispatch.text,
      defaultCurrency: defaultCurrency.value,
      sourceImage: buffer.toString("base64"),
      sourceImageMime: file.type,
    });

    return json({ ok: true, invoiceId: invoice.id, duplicate, status: invoice.status });
  } catch (error) {
    const failure = failureResponse("invoice upload", error, "Invoice upload failed");
    return json({ ok: false, message: failure.message }, failure.status);
  }
}