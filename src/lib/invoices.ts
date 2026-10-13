import { createHash } from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";

import { invoices, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { extractJsonPayload, MAX_AMOUNT_MINOR, parseInvoiceLlmOutput } from "@/lib/invoice-parse";
import { resolveSetting } from "@/lib/settings";

export type InvoiceRow = typeof invoices.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;

export type InvoiceFilters = {
  status?: "needs_review" | "confirmed";
  project?: string;
  vendor?: string;
};

export type CreateInvoiceInput = {
  contentHash: string;
  rawLlmResponse: string;
  defaultCurrency: string;
};

export type ConfirmResult =
  | { ok: true; transaction: TransactionRow }
  | { ok: false; status: number; message: string };

export type UpdateTotalResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; status: number; message: string };

export function hashUploadContent(content: Buffer | ArrayBuffer): string {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return createHash("sha256").update(buffer).digest("hex");
}

export function deriveSuggestedCategory(rawLlmResponse: string): string {
  try {
    const parsed: unknown = JSON.parse(extractJsonPayload(rawLlmResponse));
    if (typeof parsed === "object" && parsed !== null) {
      const category = (parsed as Record<string, unknown>).suggested_category;
      if (typeof category === "string") {
        return category.trim();
      }
    }
  } catch {
    // raw response was not parseable; caller falls back to the default category
  }
  return "";
}

export async function listInvoices(filters: InvoiceFilters = {}): Promise<InvoiceRow[]> {
  const conditions = [];
  if (filters.status) {
    conditions.push(eq(invoices.status, filters.status));
  }
  if (filters.project) {
    conditions.push(like(invoices.project, `%${filters.project}%`));
  }
  if (filters.vendor) {
    conditions.push(like(invoices.vendor, `%${filters.vendor}%`));
  }

  return db
    .select()
    .from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoices.date), desc(invoices.created_at));
}

export async function getInvoiceByContentHash(contentHash: string): Promise<InvoiceRow | null> {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.source_image, `sha256:${contentHash}`))
    .limit(1);
  return rows[0] ?? null;
}

export async function createInvoiceFromLlm(
  input: CreateInvoiceInput,
): Promise<{ invoice: InvoiceRow; duplicate: boolean }> {
  const existing = await getInvoiceByContentHash(input.contentHash);
  if (existing) {
    return { invoice: existing, duplicate: true };
  }

  const parsed = parseInvoiceLlmOutput(input.rawLlmResponse, input.defaultCurrency);

  const [created] = await db
    .insert(invoices)
    .values({
      vendor: parsed.vendor,
      date: parsed.dateInt,
      total_minor: parsed.totalMinor,
      currency_code: parsed.currencyCode,
      project: parsed.project,
      status: "needs_review",
      // source_image is repurposed as the idempotency identity (see SUBMISSION_NOTES.md #7).
      source_image: `sha256:${input.contentHash}`,
      line_items: JSON.stringify(parsed.lineItems),
      raw_llm_response: input.rawLlmResponse,
    })
    .returning();

  return { invoice: created, duplicate: false };
}

export async function confirmInvoice(invoiceId: string): Promise<ConfirmResult> {
  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  const invoice = rows[0];

  if (!invoice) {
    return { ok: false, status: 404, message: "Invoice not found" };
  }
  if (invoice.status === "confirmed") {
    return { ok: false, status: 409, message: "Invoice is already confirmed" };
  }

  const defaultCurrency = await resolveSetting("DEFAULT_CURRENCY");
  if (!defaultCurrency) {
    return {
      ok: false,
      status: 503,
      message: "DEFAULT_CURRENCY is not set. Configure it in Settings before confirming invoices.",
    };
  }

  const activeCurrency = defaultCurrency.value;
  if (invoice.currency_code !== activeCurrency) {
    return {
      ok: false,
      status: 400,
      message: `Multi-currency support is coming in a future release. This invoice is in ${invoice.currency_code} but the active currency is ${activeCurrency}. Non-${activeCurrency} invoices cannot be confirmed yet.`,
    };
  }

  const category = deriveSuggestedCategory(invoice.raw_llm_response) || "Invoice";
  const transactionId = crypto.randomUUID();

  await db.batch([
    db.update(invoices).set({ status: "confirmed" }).where(eq(invoices.id, invoice.id)),
    db.insert(transactions).values({
      id: transactionId,
      date: invoice.date,
      amount_minor: -invoice.total_minor,
      currency_code: invoice.currency_code,
      category,
      project: invoice.project,
      description: invoice.vendor,
      source_invoice_id: invoice.id,
    }),
  ]);

  const created = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  return { ok: true, transaction: created[0] };
}

export async function updateInvoiceTotal(
  invoiceId: string,
  newTotalMinor: number,
): Promise<UpdateTotalResult> {
  if (!Number.isInteger(newTotalMinor) || Math.abs(newTotalMinor) > MAX_AMOUNT_MINOR) {
    return {
      ok: false,
      status: 400,
      message: `Total must be an integer number of minor units not exceeding ${MAX_AMOUNT_MINOR}`,
    };
  }

  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!rows[0]) {
    return { ok: false, status: 404, message: "Invoice not found" };
  }

  await db.batch([
    db.update(invoices).set({ total_minor: newTotalMinor }).where(eq(invoices.id, invoiceId)),
    db
      .update(transactions)
      .set({ amount_minor: -newTotalMinor })
      .where(eq(transactions.source_invoice_id, invoiceId)),
  ]);

  const updated = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  return { ok: true, invoice: updated[0] };
}