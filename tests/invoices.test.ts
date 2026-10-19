// spec: idempotent upload (same content hash → existing invoice, no duplicate row); confirming an eligible
//   invoice sets status=confirmed AND creates amount_minor=-total_minor / copied currency / suggested_category
//   (fallback "Invoice"), atomically; a non-default-currency invoice is rejected before any DB writes and stays
//   needs_review; inline total-edit updates the linked transaction's amount to -newTotal atomically.
// expected (hand-derived): total_minor 5000 (USD) → transaction amount_minor -5000, currency USD, category "Office
//   supplies"; empty suggested_category → "Invoice"; EUR invoice with DEFAULT_CURRENCY USD → exact multi-currency
//   rejection message, 0 transactions, status unchanged; total 5000→6000 → linked transaction amount -6000.
//   An invoice stores net/VAT/gross and the uploaded bytes; deleting it nulls the linked transaction's
//   source_invoice_id (FK ON DELETE SET NULL) and keeps the transaction.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { invoices, settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import {
  confirmInvoice,
  createInvoiceFromLlm,
  deleteInvoice,
  getInvoiceImage,
  listInvoices,
  updateInvoiceAmounts,
  updateInvoiceTotal,
} from "@/lib/invoices";

function invoiceJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    vendor: "Acme Kft",
    date: "2026-01-15",
    total_minor: 5000,
    currency_code: "USD",
    line_items: [{ description: "Widget", amount_minor: 5000 }],
    suggested_category: "Office supplies",
    project: "P1",
    ...overrides,
  });
}

async function setDefaultCurrency(code: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "DEFAULT_CURRENCY", value: code })
    .onConflictDoUpdate({ target: settings.key, set: { value: code } });
}

async function invoicesWithContentHash(contentHash: string) {
  return db.select().from(invoices).where(eq(invoices.content_hash, contentHash));
}

async function transactionsForInvoice(invoiceId: string) {
  return db.select().from(transactions).where(eq(transactions.source_invoice_id, invoiceId));
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createInvoiceFromLlm", () => {
  it("returns the same invoice id for a repeated content hash and creates no duplicate row", async () => {
    const hash = "a".repeat(64);
    const input = { contentHash: hash, rawLlmResponse: invoiceJson(), defaultCurrency: "USD" };

    const first = await createInvoiceFromLlm(input);
    const second = await createInvoiceFromLlm(input);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.invoice.id).toBe(first.invoice.id);
    expect(first.invoice.content_hash).toBe(hash);
    expect(first.invoice).toMatchObject({ net_minor: 5000, vat_minor: 0, gross_minor: 5000 });
    expect(await invoicesWithContentHash(hash)).toHaveLength(1);
  });

  it("stores the uploaded source file and exposes it for preview", async () => {
    const bytes = Buffer.from("fake-png-bytes").toString("base64");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "a2".repeat(32),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
      sourceImage: bytes,
      sourceImageMime: "image/png",
    });

    const image = await getInvoiceImage(invoice.id);
    expect(image).toEqual({ base64: bytes, mime: "image/png" });
    const listed = await listInvoices({ vendor: "Acme" });
    expect(listed.find((row) => row.id === invoice.id)?.hasSourceImage).toBe(true);
  });
});

describe("confirmInvoice", () => {
  it("creates the linked transaction with negated total, copied currency, and suggested category", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "b".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });

    const result = await confirmInvoice(invoice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction).toMatchObject({
      amount_minor: -5000,
      currency_code: "USD",
      category: "Office supplies",
      project: "P1",
      description: "Acme Kft",
      source_invoice_id: invoice.id,
      date: invoice.date,
    });

    const refreshed = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(refreshed[0].status).toBe("confirmed");
  });

  it("falls back to the category \"Invoice\" when the raw LLM output has none", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "c".repeat(64),
      rawLlmResponse: invoiceJson({ suggested_category: "" }),
      defaultCurrency: "USD",
    });

    const result = await confirmInvoice(invoice.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.category).toBe("Invoice");
  });

  it("rejects a non-default-currency invoice before any DB write and leaves it needs_review", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "d".repeat(64),
      rawLlmResponse: invoiceJson({ currency_code: "EUR" }),
      defaultCurrency: "USD",
    });

    const result = await confirmInvoice(invoice.id);

    expect(result).toEqual({
      ok: false,
      status: 400,
      message:
        "Multi-currency support is coming in a future release. This invoice is in EUR but the active currency is USD. Non-USD invoices cannot be confirmed yet.",
    });
    expect(await transactionsForInvoice(invoice.id)).toHaveLength(0);
    const refreshed = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(refreshed[0].status).toBe("needs_review");
  });
});

describe("updateInvoiceTotal", () => {
  it("updates a confirmed invoice and its linked transaction atomically", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "e".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });
    await confirmInvoice(invoice.id);

    const result = await updateInvoiceTotal(invoice.id, 6000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.total_minor).toBe(6000);
    const linked = await transactionsForInvoice(invoice.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({ amount_minor: -6000, net_minor: 6000, gross_minor: 6000 });
  });

  it("updates net, VAT, and gross together and syncs the linked transaction", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "b2".repeat(32),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });
    await confirmInvoice(invoice.id);

    const result = await updateInvoiceAmounts(invoice.id, {
      netMinor: 1000,
      vatMinor: 270,
      grossMinor: 1270,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice).toMatchObject({
      net_minor: 1000,
      vat_minor: 270,
      gross_minor: 1270,
      total_minor: 1270,
    });
    const linked = await transactionsForInvoice(invoice.id);
    expect(linked[0]).toMatchObject({ amount_minor: -1270, net_minor: 1000, gross_minor: 1270 });
  });

  it("derives gross when only net and VAT are supplied", async () => {
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "b3".repeat(32),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });

    const result = await updateInvoiceAmounts(invoice.id, { netMinor: 1000, vatMinor: 270 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoice.gross_minor).toBe(1270);
  });

  it("rejects totals over the cap without touching rows", async () => {
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "f".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });

    const result = await updateInvoiceTotal(invoice.id, 100_000_000_001);

    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Total must be an integer number of minor units not exceeding 100000000000",
    });
    const refreshed = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(refreshed[0].total_minor).toBe(5000);
  });
});

describe("deleteInvoice", () => {
  it("deletes the invoice and leaves its transaction with source_invoice_id NULL", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "c2".repeat(32),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });
    await confirmInvoice(invoice.id);
    const linkedBefore = await transactionsForInvoice(invoice.id);

    expect(await deleteInvoice(invoice.id)).toBe(true);
    expect(await db.select().from(invoices).where(eq(invoices.id, invoice.id))).toEqual([]);
    const linked = await db.select().from(transactions).where(eq(transactions.id, linkedBefore[0].id));
    expect(linked).toHaveLength(1);
    expect(linked[0].source_invoice_id).toBeNull();
    expect(await deleteInvoice(invoice.id)).toBe(false);
  });
});

describe("listInvoices", () => {
  it("filters by status, project, and vendor", async () => {
    await db.insert(invoices).values([
      { vendor: "Filter Alpha Ltd", date: 20260110, total_minor: 100, currency_code: "HUF", project: "FilterAlpha", status: "needs_review", line_items: "[]", raw_llm_response: "{}" },
      { vendor: "Filter Beta Ltd", date: 20260111, total_minor: 200, currency_code: "HUF", project: "FilterBeta", status: "confirmed", line_items: "[]", raw_llm_response: "{}" },
      { vendor: "Filter Alphabet Kft", date: 20260112, total_minor: 300, currency_code: "HUF", project: "FilterAlpha", status: "needs_review", line_items: "[]", raw_llm_response: "{}" },
    ]);

    const reviewInAlpha = await listInvoices({ status: "needs_review", project: "FilterAlpha" });
    const beta = await listInvoices({ project: "FilterBeta" });
    const alphabetVendor = await listInvoices({ vendor: "Filter Alphabet" });

    expect(reviewInAlpha).toHaveLength(2);
    expect(beta).toHaveLength(1);
    expect(beta[0].vendor).toBe("Filter Beta Ltd");
    expect(alphabetVendor.map((row) => row.vendor)).toEqual(["Filter Alphabet Kft"]);
  });
});