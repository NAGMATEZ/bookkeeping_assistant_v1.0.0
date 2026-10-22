// spec: inline total-edit PATCHes and atomically updates the linked transaction (amount_minor = -newTotal).
// expected: edit total 5000→6000 → 200 { ok:true, total_minor:6000, net_minor:6000, vat_minor:0, gross_minor:6000 }
//   and linked transaction amount_minor -6000; non-integer total → 400 invalid-payload; unknown id → 404.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { PATCH } from "@/app/api/invoices/[id]/route";
import { invoices, settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { confirmInvoice, createInvoiceFromLlm } from "@/lib/invoices";

function invoiceJson(): string {
  return JSON.stringify({
    vendor: "Acme Kft",
    date: "2026-01-15",
    total_minor: 5000,
    currency_code: "USD",
    line_items: [{ description: "Widget", amount_minor: 5000 }],
    suggested_category: "Office supplies",
    project: "P1",
  });
}

function callPatch(id: string, body: unknown): Promise<Response> {
  return PATCH(
    new Request("http://localhost/api/invoices/x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db
    .insert(settings)
    .values({ key: "DEFAULT_CURRENCY", value: "USD" })
    .onConflictDoUpdate({ target: settings.key, set: { value: "USD" } });
});

describe("PATCH /api/invoices/[id]", () => {
  it("updates the invoice total and the linked transaction amount", async () => {
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "3".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });
    await confirmInvoice(invoice.id);

    const response = await callPatch(invoice.id, { total_minor: 6000 });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      total_minor: 6000,
      net_minor: 6000,
      vat_minor: 0,
      gross_minor: 6000,
    });
    const linked = await db
      .select()
      .from(transactions)
      .where(eq(transactions.source_invoice_id, invoice.id));
    expect(linked).toHaveLength(1);
    expect(linked[0].amount_minor).toBe(-6000);
  });

  it("replaces line items while keeping the amount response shape", async () => {
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "4".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });

    const response = await callPatch(invoice.id, {
      line_items: [
        { description: "  Widget A  ", net_minor: 3000, vat_minor: 810, gross_minor: 3810 },
        { description: "Widget B", net_minor: 1000, vat_minor: 190 },
      ],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      total_minor: 5000,
      net_minor: 5000,
      vat_minor: 0,
      gross_minor: 5000,
    });
    const refreshed = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(refreshed[0].line_items).toBe(
      JSON.stringify([
        { description: "Widget A", net_minor: 3000, vat_minor: 810, gross_minor: 3810 },
        { description: "Widget B", net_minor: 1000, vat_minor: 190, gross_minor: 1190 },
      ]),
    );
  });

  it("maps the legacy amount_minor alias to net=gross with zero VAT", async () => {
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "5".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "USD",
    });

    const response = await callPatch(invoice.id, {
      line_items: [{ description: "Legacy line", amount_minor: 5000 }],
    });

    expect(response.status).toBe(200);
    const refreshed = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(refreshed[0].line_items).toBe(
      JSON.stringify([
        { description: "Legacy line", net_minor: 5000, vat_minor: 0, gross_minor: 5000 },
      ]),
    );
  });

  it("rejects an over-long line-item description with a specific message", async () => {
    const response = await callPatch("any-id", {
      line_items: [
        { description: "x".repeat(501), net_minor: 100, vat_minor: 0, gross_minor: 100 },
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Line item 1 description must not exceed 500 characters",
    });
  });

  it("rejects a non-integer total with a specific message", async () => {
    const response = await callPatch("any-id", { total_minor: 12.5 });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Invalid invoice payload — total_minor: Invalid input: expected int, received number",
    });
  });

  it("returns 404 for an unknown invoice", async () => {
    const response = await callPatch("missing-invoice", { total_minor: 100 });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "Invoice not found" });
  });
});