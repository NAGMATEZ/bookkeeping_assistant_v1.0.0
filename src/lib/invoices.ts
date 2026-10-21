import { createHash } from "node:crypto";
import { and, desc, eq, like, sql } from "drizzle-orm";

import { invoices, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { extractJsonPayload, MAX_AMOUNT_MINOR, parseInvoiceLlmOutput } from "@/lib/invoice-parse";
import { resolveSetting } from "@/lib/settings";

export type InvoiceRow = typeof invoices.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;

const invoiceListColumns = {
  id: invoices.id,
  vendor: invoices.vendor,
  date: invoices.date,
  total_minor: invoices.total_minor,
  net_minor: invoices.net_minor,
  vat_minor: invoices.vat_minor,
  gross_minor: invoices.gross_minor,
  currency_code: invoices.currency_code,
  project: invoices.project,
  status: invoices.status,
  content_hash: invoices.content_hash,
  source_image_mime: invoices.source_image_mime,
  line_items: invoices.line_items,
  raw_llm_response: invoices.raw_llm_response,
  created_at: invoices.created_at,
  hasSourceImage: sql<number>`(${invoices.source_image} is not null)`,
};

export type InvoiceListRow = Omit<InvoiceRow, "source_image"> & { hasSourceImage: boolean };

export type InvoiceFilters = {
  status?: "needs_review" | "confirmed";
  project?: string;
  vendor?: string;
};

export type CreateInvoiceInput = {
  contentHash: string;
  rawLlmResponse: string;
  defaultCurrency: string;
  sourceImage?: string;
  sourceImageMime?: string;
};

export type InvoiceLineItemUpdate = {
  description: string;
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
};

export type InvoiceAmountUpdate = {
  totalMinor?: number;
  netMinor?: number;
  vatMinor?: number;
  grossMinor?: number;
  lineItems?: InvoiceLineItemUpdate[];
};

export type ConfirmResult =
  | { ok: true; transaction: TransactionRow }
  | { ok: false; status: number; message: string };

export type UpdateInvoiceResult =
  | { ok: true; invoice: InvoiceRow }
  | { ok: false; status: number; message: string };

export function hashUploadContent(content: ArrayBuffer | ArrayBufferView): string {
  const buffer =
    content instanceof ArrayBuffer
      ? Buffer.from(content)
      : Buffer.from(content.buffer, content.byteOffset, content.byteLength);
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

export async function listInvoices(filters: InvoiceFilters = {}): Promise<InvoiceListRow[]> {
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

  const rows = await db
    .select(invoiceListColumns)
    .from(invoices)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoices.date), desc(invoices.created_at));

  return rows.map((row) => ({ ...row, hasSourceImage: Boolean(row.hasSourceImage) }));
}

export async function getInvoiceByContentHash(contentHash: string): Promise<InvoiceRow | null> {
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.content_hash, contentHash))
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
      net_minor: parsed.netMinor,
      vat_minor: parsed.vatMinor,
      gross_minor: parsed.grossMinor,
      currency_code: parsed.currencyCode,
      project: parsed.project,
      status: "needs_review",
      content_hash: input.contentHash,
      source_image: input.sourceImage ?? null,
      source_image_mime: input.sourceImageMime ?? null,
      line_items: JSON.stringify(
        parsed.lineItems.map((item) => ({
          description: item.description,
          net_minor: item.netMinor,
          vat_minor: item.vatMinor,
          gross_minor: item.grossMinor,
        })),
      ),
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
  const grossMinor = invoice.gross_minor || invoice.total_minor;

  await db.batch([
    db.update(invoices).set({ status: "confirmed" }).where(eq(invoices.id, invoice.id)),
    db.insert(transactions).values({
      id: transactionId,
      date: invoice.date,
      amount_minor: -grossMinor,
      net_minor: invoice.net_minor,
      gross_minor: grossMinor,
      currency_code: invoice.currency_code,
      category,
      project: invoice.project,
      description: invoice.vendor,
      source: "invoice",
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

const MAX_LINE_ITEMS = 200;
const MAX_LINE_ITEM_DESCRIPTION_LENGTH = 500;

function validateAmount(label: string, value: number): string | null {
  if (!Number.isInteger(value) || Math.abs(value) > MAX_AMOUNT_MINOR) {
    return `${label} must be an integer number of minor units not exceeding ${MAX_AMOUNT_MINOR}`;
  }
  return null;
}

function validateLineItems(lineItems: InvoiceLineItemUpdate[]): string | null {
  if (lineItems.length > MAX_LINE_ITEMS) {
    return `Line items must not contain more than ${MAX_LINE_ITEMS} entries`;
  }
  for (const [index, item] of lineItems.entries()) {
    const position = index + 1;
    if (item.description.trim() === "") {
      return `Line item ${position} description must not be empty`;
    }
    if (item.description.trim().length > MAX_LINE_ITEM_DESCRIPTION_LENGTH) {
      return `Line item ${position} description must not exceed ${MAX_LINE_ITEM_DESCRIPTION_LENGTH} characters`;
    }
    const amounts: Array<[string, number]> = [
      ["net amount", item.netMinor],
      ["VAT amount", item.vatMinor],
      ["gross amount", item.grossMinor],
    ];
    for (const [label, value] of amounts) {
      if (!Number.isInteger(value) || Math.abs(value) > MAX_AMOUNT_MINOR) {
        return `Line item ${position} ${label} must be an integer number of minor units not exceeding ${MAX_AMOUNT_MINOR}`;
      }
    }
  }
  return null;
}

export async function updateInvoiceAmounts(
  invoiceId: string,
  update: InvoiceAmountUpdate,
): Promise<UpdateInvoiceResult> {
  const checks: Array<[string, number | undefined]> = [
    ["Total", update.totalMinor],
    ["Net", update.netMinor],
    ["VAT", update.vatMinor],
    ["Gross", update.grossMinor],
  ];
  for (const [label, value] of checks) {
    if (value === undefined) {
      continue;
    }
    const error = validateAmount(label, value);
    if (error) {
      return { ok: false, status: 400, message: error };
    }
  }

  if (update.lineItems !== undefined) {
    const lineItemsError = validateLineItems(update.lineItems);
    if (lineItemsError) {
      return { ok: false, status: 400, message: lineItemsError };
    }
  }

  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  const invoice = rows[0];
  if (!invoice) {
    return { ok: false, status: 404, message: "Invoice not found" };
  }

  const grossProvided = update.grossMinor ?? update.totalMinor;
  let netMinor = update.netMinor ?? invoice.net_minor;
  let vatMinor = update.vatMinor ?? invoice.vat_minor;
  let grossMinor = grossProvided ?? invoice.gross_minor;

  if (grossProvided === undefined && (update.netMinor !== undefined || update.vatMinor !== undefined)) {
    grossMinor = netMinor + vatMinor;
  } else if (grossProvided !== undefined) {
    if (update.netMinor === undefined && update.vatMinor === undefined) {
      netMinor = grossMinor;
      vatMinor = 0;
    } else if (update.netMinor !== undefined && update.vatMinor === undefined) {
      vatMinor = grossMinor - netMinor;
    } else if (update.netMinor === undefined && update.vatMinor !== undefined) {
      netMinor = grossMinor - vatMinor;
    }
  }

  const persistedLineItems =
    update.lineItems === undefined
      ? invoice.line_items
      : JSON.stringify(
          update.lineItems.map((item) => ({
            description: item.description.trim(),
            net_minor: item.netMinor,
            vat_minor: item.vatMinor,
            gross_minor: item.grossMinor,
          })),
        );

  await db.batch([
    db
      .update(invoices)
      .set({
        total_minor: grossMinor,
        net_minor: netMinor,
        vat_minor: vatMinor,
        gross_minor: grossMinor,
        line_items: persistedLineItems,
      })
      .where(eq(invoices.id, invoiceId)),
    db
      .update(transactions)
      .set({ amount_minor: -grossMinor, net_minor: netMinor, gross_minor: grossMinor })
      .where(eq(transactions.source_invoice_id, invoiceId)),
  ]);

  const updated = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  return { ok: true, invoice: updated[0] };
}

export async function updateInvoiceTotal(
  invoiceId: string,
  newTotalMinor: number,
): Promise<UpdateInvoiceResult> {
  return updateInvoiceAmounts(invoiceId, { totalMinor: newTotalMinor });
}

export async function getInvoiceImage(
  invoiceId: string,
): Promise<{ base64: string; mime: string } | null> {
  const rows = await db
    .select({ image: invoices.source_image, mime: invoices.source_image_mime })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  const row = rows[0];
  if (!row?.image) {
    return null;
  }
  return { base64: row.image, mime: row.mime ?? "application/octet-stream" };
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  const deleted = await db
    .delete(invoices)
    .where(eq(invoices.id, invoiceId))
    .returning({ id: invoices.id });
  return deleted.length > 0;
}
