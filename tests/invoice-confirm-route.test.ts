// spec: confirm endpoint — eligible invoice → 200 and a linked transaction with amount_minor = -total_minor;
//   non-default-currency invoice → 400 with the multi-currency message and zero DB writes.
// expected: total 5000 HUF (printed forints, corrected ×100) + DEFAULT_CURRENCY HUF → transactionId returned and
//   transaction amount_minor -500000 with net/gross 500000; EUR invoice while active currency is USD → exact
//   rejection message, 0 transactions; unknown id → 404.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { POST } from "@/app/api/invoices/[id]/confirm/route";
import { settings, transactions } from "@/db/schema";
import { db } from "@/lib/db";
import { createInvoiceFromLlm } from "@/lib/invoices";

function invoiceJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    vendor: "Acme Kft",
    date: "2026-01-15",
    total_minor: 5000,
    currency_code: "HUF",
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

function callConfirm(id: string): Promise<Response> {
  return POST(new Request("http://localhost/api/invoices/x/confirm", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});

describe("POST /api/invoices/[id]/confirm", () => {
  it("confirms an eligible invoice and returns the created transaction id", async () => {
    await setDefaultCurrency("HUF");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "1".repeat(64),
      rawLlmResponse: invoiceJson(),
      defaultCurrency: "HUF",
    });

    const response = await callConfirm(invoice.id);
    const body = (await response.json()) as { ok: boolean; transactionId: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const linked = await db.select().from(transactions).where(eq(transactions.id, body.transactionId));
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({
      amount_minor: -500000,
      net_minor: 500000,
      gross_minor: 500000,
      source: "invoice",
    });
  });

  it("rejects a non-default-currency invoice and creates no transaction", async () => {
    await setDefaultCurrency("USD");
    const { invoice } = await createInvoiceFromLlm({
      contentHash: "2".repeat(64),
      rawLlmResponse: invoiceJson({ currency_code: "EUR" }),
      defaultCurrency: "USD",
    });

    const response = await callConfirm(invoice.id);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message:
        "Multi-currency support is coming in a future release. This invoice is in EUR but the active currency is USD. Non-USD invoices cannot be confirmed yet.",
    });
    expect(await db.select().from(transactions).where(eq(transactions.source_invoice_id, invoice.id))).toHaveLength(0);
  });

  it("returns 404 for an unknown invoice", async () => {
    const response = await callConfirm("does-not-exist");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "Invoice not found" });
  });
});