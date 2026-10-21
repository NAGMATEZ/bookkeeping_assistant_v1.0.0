import { z } from "zod";

import { failureResponse } from "@/lib/diagnostics";
import { deleteInvoice, updateInvoiceAmounts } from "@/lib/invoices";
import { checkStartup } from "@/lib/startup-gate";

/**
 * PATCH /api/invoices/:id
 * Body: any of { total_minor, net_minor, vat_minor, gross_minor, line_items } — integer minor units
 * within the 100,000,000,000 cap. total_minor is treated as gross. line_items replaces the stored
 * JSON array with [{ description, net_minor, vat_minor, gross_minor }]; amount_minor is accepted as
 * a legacy gross-only alias. Atomically updates the invoice and, when a linked transaction exists,
 * its amount_minor/net_minor/gross_minor.
 * Response: { ok: true, total_minor, net_minor, vat_minor, gross_minor } | { ok: false, message }
 * (400/404/500/503).
 *
 * DELETE /api/invoices/:id
 * Removes the invoice; the linked transaction survives with source_invoice_id = NULL (FK).
 */
const lineItemSchema = z
  .object({
    description: z.string().trim().min(1),
    net_minor: z.number().int().optional(),
    vat_minor: z.number().int().optional(),
    gross_minor: z.number().int().optional(),
    amount_minor: z.number().int().optional(),
  })
  .strict()
  .refine(
    (item) =>
      item.net_minor !== undefined ||
      item.vat_minor !== undefined ||
      item.gross_minor !== undefined ||
      item.amount_minor !== undefined,
    { message: "Provide net_minor, vat_minor, gross_minor or amount_minor" },
  );

type LineItemPayload = z.infer<typeof lineItemSchema>;

function normalizeLineItem(item: LineItemPayload) {
  const grossMinor =
    item.gross_minor ?? item.amount_minor ?? (item.net_minor ?? 0) + (item.vat_minor ?? 0);
  const netMinor =
    item.net_minor ??
    (item.gross_minor === undefined && item.amount_minor === undefined
      ? 0
      : grossMinor - (item.vat_minor ?? 0));
  const vatMinor = item.vat_minor ?? grossMinor - netMinor;
  return { description: item.description, netMinor, vatMinor, grossMinor };
}

const patchSchema = z
  .object({
    total_minor: z.number().int().optional(),
    net_minor: z.number().int().optional(),
    vat_minor: z.number().int().optional(),
    gross_minor: z.number().int().optional(),
    line_items: z.array(lineItemSchema).max(200).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.total_minor !== undefined ||
      value.net_minor !== undefined ||
      value.vat_minor !== undefined ||
      value.gross_minor !== undefined ||
      value.line_items !== undefined,
    {
      message:
        "Provide at least one of total_minor, net_minor, vat_minor, gross_minor, line_items",
    },
  );

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams): Promise<Response> {
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
      return Response.json({ ok: false, message: `Invalid invoice payload — ${detail}` }, { status: 400 });
    }

    const { id } = await params;
    const result = await updateInvoiceAmounts(id, {
      totalMinor: parsed.data.total_minor,
      netMinor: parsed.data.net_minor,
      vatMinor: parsed.data.vat_minor,
      grossMinor: parsed.data.gross_minor,
      lineItems: parsed.data.line_items?.map(normalizeLineItem),
    });
    if (!result.ok) {
      return Response.json({ ok: false, message: result.message }, { status: result.status });
    }

    return Response.json({
      ok: true,
      total_minor: result.invoice.total_minor,
      net_minor: result.invoice.net_minor,
      vat_minor: result.invoice.vat_minor,
      gross_minor: result.invoice.gross_minor,
    });
  } catch (error) {
    const failure = failureResponse("invoice update", error, "Updating the invoice failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const { id } = await params;
    const deleted = await deleteInvoice(id);
    if (!deleted) {
      return Response.json({ ok: false, message: "Invoice not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const failure = failureResponse("invoice delete", error, "Deleting the invoice failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}
