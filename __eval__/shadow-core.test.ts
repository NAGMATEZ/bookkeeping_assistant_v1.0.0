/**
 * SHADOW CORE — M21 adapter of the canonical GLM 5.3 SHADOW_SPEC assertions.
 * Expected values are hand-derived from spec.md invariants + machine-verified fixture facts.
 * Only import paths / DB bootstrap are adapted; assertion values are not.
 * A1: [0.125, 0.125] full-precision sum 0.25 -> once-rounded half-up = 25 minor.
 * A2b: amount cap 1e11 minor inclusive, server-side.
 * A3: decimal parser rejects junk; "1 000,50" -> 100050; no Date rollover; 1900-2100 inclusive.
 * A4: Currency Guard exact message + zero transactions (real DB).
 * A5: atomic confirm -> tx -total, category preserved, fallback "Invoice".
 * A6: inline total edit syncs linked tx atomically.
 * A7: import precedence override > direction column > sign.
 * A8: FK ON DELETE SET NULL on the real migration + PRAGMA.
 * A9: dashboard math (MA excludes current month; projections pos + MA*k).
 * A10: settings save encrypts; dispatcher decrypts into the Authorization header.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

process.env.TURSO_DATABASE_URL = "file::memory:?cache=shared";
process.env.TURSO_AUTH_TOKEN = "shadow-token";
process.env.APP_ENCRYPTION_KEY = "5a44491e8e2e928b7bd6a78d86e7223d55ae5f1d21cdf85eeefbd7d942745442";
process.env.NODE_ENV = "test";

let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/db/schema");
let money: typeof import("@/lib/money");
let dates: typeof import("@/lib/dates");
let invoiceParse: typeof import("@/lib/invoice-parse");
let invoicesLib: typeof import("@/lib/invoices");
let transactionsLib: typeof import("@/lib/transactions");
let importMap: typeof import("@/lib/import-map");
let dashboard: typeof import("@/lib/dashboard");
let encryption: typeof import("@/lib/encryption");

async function seedSetting(key: string, value: string): Promise<void> {
  await dbMod.db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

async function countRows(table: "invoices" | "transactions"): Promise<number> {
  const rows = await dbMod.client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number((rows.rows[0] as Record<string, unknown>).c);
}

beforeAll(async () => {
  dbMod = await import("@/lib/db");
  schema = await import("@/db/schema");
  money = await import("@/lib/money");
  dates = await import("@/lib/dates");
  invoiceParse = await import("@/lib/invoice-parse");
  invoicesLib = await import("@/lib/invoices");
  transactionsLib = await import("@/lib/transactions");
  importMap = await import("@/lib/import-map");
  dashboard = await import("@/lib/dashboard");
  encryption = await import("@/lib/encryption");

  for (const file of ["drizzle/0000_nostalgic_punisher.sql", "drizzle/0001_version_update.sql"]) {
    const migration = await readFile(resolve(process.cwd(), file), "utf8");
    await dbMod.client.executeMultiple(migration);
  }
});

beforeEach(async () => {
  await dbMod.client.executeMultiple(
    "DELETE FROM transactions; DELETE FROM invoices; DELETE FROM settings;",
  );
  vi.restoreAllMocks();
});

describe("A1 money: round once at final sum", () => {
  it("two 12.5 halves sum to 25 minor, not 0/24/26", () => {
    expect(money.sumAndRoundOnce([12.5, 12.5])).toBe(25);
  });
  it("sign symmetry: [-12.5, -12.5] -> -25 minor", () => {
    expect(money.sumAndRoundOnce([-12.5, -12.5])).toBe(-25);
  });
  it("production path: parseDecimalToMinorUnits is exact (0.25 -> 25)", () => {
    expect(money.parseDecimalToMinorUnits("0.25")).toBe(25);
  });
});

describe("A2b amount cap 1e11 minor server-side", () => {
  it("manual entry rejects 100,000,000,001 minor and accepts exactly 100,000,000,000", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const base = {
      date: "2026-01-15",
      isIncome: false,
      category: "Office",
      project: "",
      description: "",
    };
    const over = await transactionsLib.createManualTransaction({ ...base, amount: "1000000000.01" });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.message).toContain("cap");
    const at = await transactionsLib.createManualTransaction({ ...base, amount: "1000000000.00" });
    expect(at.ok).toBe(true);
  });
  it("invoice parse rejects total over cap and accepts the boundary", () => {
    const raw = (total: number) =>
      JSON.stringify({
        vendor: "V",
        date: "2026-01-05",
        total_minor: total,
        currency_code: "USD",
        line_items: [],
        suggested_category: "",
        project: "",
      });
    expect(() => invoiceParse.parseInvoiceLlmOutput(raw(100_000_000_001), "USD")).toThrow(/cap/);
    expect(invoiceParse.parseInvoiceLlmOutput(raw(100_000_000_000), "USD").totalMinor).toBe(
      100_000_000_000,
    );
  });
});

describe("A3 parseDecimalToMinor + dates", () => {
  it("unparseable junk -> thrown/rejected", () => {
    expect(() => money.parseDecimalToMinorUnits("abc")).toThrow();
  });
  it("thousands separator handled (1 000,50 -> 100050 minor)", () => {
    expect(money.parseDecimalToMinorUnits("1 000,50")).toBe(100050);
  });
  it("2024-02-30 rejected (no rollover); bounds 1900-2100 inclusive", () => {
    expect(() => dates.toDateInt("2024-02-30")).toThrow();
    expect(() => dates.toDateInt("1899-12-31")).toThrow();
    expect(() => dates.toDateInt("2101-01-01")).toThrow();
    expect(dates.toDateInt("1900-01-01")).toBe(19000101);
    expect(dates.toDateInt("2100-12-31")).toBe(21001231);
  });
});

describe("A4 currency guard blocks confirm (real DB)", () => {
  it("HUF invoice with DEFAULT USD -> exact message, zero transactions", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const raw = JSON.stringify({
      vendor: "T",
      date: "2026-01-15",
      total_minor: 285750000,
      currency_code: "HUF",
      line_items: [],
      suggested_category: "",
      project: "P",
    });
    const { invoice } = await invoicesLib.createInvoiceFromLlm({
      contentHash: "a4hash",
      rawLlmResponse: raw,
      defaultCurrency: "USD",
    });
    const r = await invoicesLib.confirmInvoice(invoice.id);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("Multi-currency support is coming in a future release.");
      expect(r.message).toContain("This invoice is in HUF but the active currency is USD.");
      expect(r.message).toContain("Non-USD invoices cannot be confirmed yet.");
    }
    expect(await countRows("transactions")).toBe(0);
  });
});

describe("A5 atomic confirm creates signed transaction (real DB)", () => {
  it("total 2345 -> tx -2345, category preserved, status confirmed", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const raw = JSON.stringify({
      vendor: "Acme",
      date: "2026-01-15",
      total_minor: 2345,
      currency_code: "USD",
      line_items: [],
      suggested_category: "Office Supplies",
      project: "P",
    });
    const { invoice } = await invoicesLib.createInvoiceFromLlm({
      contentHash: "a5hash",
      rawLlmResponse: raw,
      defaultCurrency: "USD",
    });
    const r = await invoicesLib.confirmInvoice(invoice.id);
    expect(r.ok).toBe(true);
    const invoiceRows = await dbMod.client.execute(
      `SELECT status FROM invoices WHERE id = '${invoice.id}'`,
    );
    expect((invoiceRows.rows[0] as Record<string, unknown>).status).toBe("confirmed");
    const tx = await dbMod.client.execute(
      `SELECT * FROM transactions WHERE source_invoice_id = '${invoice.id}'`,
    );
    expect(tx.rows.length).toBe(1);
    const row = tx.rows[0] as Record<string, unknown>;
    expect(Number(row.amount_minor)).toBe(-2345);
    expect(row.category).toBe("Office Supplies");
    expect(row.currency_code).toBe("USD");
  });
  it("empty suggested_category falls back to \"Invoice\"", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const raw = JSON.stringify({
      vendor: "Acme",
      date: "2026-01-15",
      total_minor: 1111,
      currency_code: "USD",
      line_items: [],
      suggested_category: "",
      project: "P",
    });
    const { invoice } = await invoicesLib.createInvoiceFromLlm({
      contentHash: "a5hash2",
      rawLlmResponse: raw,
      defaultCurrency: "USD",
    });
    const r = await invoicesLib.confirmInvoice(invoice.id);
    expect(r.ok).toBe(true);
    const tx = await dbMod.client.execute(
      `SELECT category FROM transactions WHERE source_invoice_id = '${invoice.id}'`,
    );
    expect((tx.rows[0] as Record<string, unknown>).category).toBe("Invoice");
  });
});

describe("A6 inline total-edit syncs linked transaction (real DB)", () => {
  it("2000 -> 2500: invoice 2500, tx -2500, exactly 1 tx", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const raw = JSON.stringify({
      vendor: "Acme",
      date: "2026-01-15",
      total_minor: 2000,
      currency_code: "USD",
      line_items: [],
      suggested_category: "Office",
      project: "P",
    });
    const { invoice } = await invoicesLib.createInvoiceFromLlm({
      contentHash: "a6hash",
      rawLlmResponse: raw,
      defaultCurrency: "USD",
    });
    const confirmed = await invoicesLib.confirmInvoice(invoice.id);
    expect(confirmed.ok).toBe(true);
    const edited = await invoicesLib.updateInvoiceTotal(invoice.id, 2500);
    expect(edited.ok).toBe(true);
    const invoiceRows = await dbMod.client.execute(
      `SELECT total_minor FROM invoices WHERE id = '${invoice.id}'`,
    );
    expect(Number((invoiceRows.rows[0] as Record<string, unknown>).total_minor)).toBe(2500);
    const tx = await dbMod.client.execute(
      `SELECT amount_minor FROM transactions WHERE source_invoice_id = '${invoice.id}'`,
    );
    expect(tx.rows.length).toBe(1);
    expect(Number((tx.rows[0] as Record<string, unknown>).amount_minor)).toBe(-2500);
  });
});

describe("A7 import override precedence", () => {
  const mapping = { date: 0, amount: 1, direction: 2 };
  it("r1 -150.00 sign inference -> -15000", () => {
    const { records } = importMap.mapImportRows([["2026-01-05", "-150.00", ""]], mapping);
    expect(records[0].amountMinor).toBe(-15000);
  });
  it("r2 +200.00 sign inference -> 20000", () => {
    const { records } = importMap.mapImportRows([["2026-01-06", "+200.00", ""]], mapping);
    expect(records[0].amountMinor).toBe(20000);
  });
  it("r3 75.00 mapped 'Expense' -> -7500", () => {
    const { records } = importMap.mapImportRows([["2026-01-07", "75.00", "Expense"]], mapping);
    expect(records[0].amountMinor).toBe(-7500);
  });
  it("r4 75.00 mapped 'Income' -> 7500", () => {
    const { records } = importMap.mapImportRows([["2026-01-08", "75.00", "Income"]], mapping);
    expect(records[0].amountMinor).toBe(7500);
  });
  it("r5 +300.00 mapped 'Expense' with override income -> 30000 (override beats both)", () => {
    const { records } = importMap.mapImportRows([["2026-01-09", "+300.00", "Expense"]], mapping, {
      0: true,
    });
    expect(records[0].amountMinor).toBe(30000);
  });
  it("r6 40.00 no direction with override expense -> -4000", () => {
    const { records } = importMap.mapImportRows([["2026-01-10", "40.00", ""]], mapping, {
      0: false,
    });
    expect(records[0].amountMinor).toBe(-4000);
  });
});

describe("A8 FK ON DELETE SET NULL (real migration + PRAGMA)", () => {
  it("deleting invoice nulls source_invoice_id, transaction survives", async () => {
    const pragma = await dbMod.client.execute("PRAGMA foreign_keys");
    const pragmaOn = Object.values(pragma.rows[0] as Record<string, unknown>)[0];
    expect(Number(pragmaOn)).toBe(1);

    await dbMod.client.execute(
      `INSERT INTO invoices (id, vendor, date, total_minor, currency_code, project, status, line_items, raw_llm_response)
       VALUES ('fk-invoice', 'V', 20260115, 500, 'USD', 'P', 'confirmed', '[]', '{}')`,
    );
    await dbMod.client.execute(
      `INSERT INTO transactions (id, date, amount_minor, currency_code, category, project, description, source_invoice_id)
       VALUES ('fk-tx', 20260115, -500, 'USD', 'Office', 'P', '', 'fk-invoice')`,
    );
    await dbMod.client.execute(`DELETE FROM invoices WHERE id = 'fk-invoice'`);
    const tx = await dbMod.client.execute(`SELECT * FROM transactions WHERE id = 'fk-tx'`);
    expect(tx.rows.length).toBe(1);
    expect((tx.rows[0] as Record<string, unknown>).source_invoice_id).toBeNull();
  });
});

describe("A9 dashboard math (real seeded DB)", () => {
  it("MA excludes current month, position includes opening + all tx, projections pos + MA*k, pending counts HUF", async () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const dateIntFor = (offset: number, day: number) => {
      const d = new Date(Date.UTC(year, now.getUTCMonth() - offset, day));
      return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    };

    await seedSetting("DEFAULT_CURRENCY", "USD");
    await seedSetting("OPENING_BALANCE_USD", "100000");

    const rows: Array<[number, number]> = [
      [dateIntFor(3, 10), 150000],
      [dateIntFor(3, 20), -50000],
      [dateIntFor(2, 10), 80000],
      [dateIntFor(2, 20), -30000],
      [dateIntFor(1, 10), 90000],
      [dateIntFor(1, 20), -40000],
      [dateIntFor(0, 5), -25000],
    ];
    for (const [date, amount] of rows) {
      await dbMod.db.insert(schema.transactions).values({
        date,
        amount_minor: amount,
        currency_code: "USD",
        category: "X",
        project: "P",
        description: "",
      });
    }
    await dbMod.db.insert(schema.invoices).values([
      {
        id: "pend-usd",
        vendor: "A",
        date: dateIntFor(0, 4),
        total_minor: 100,
        currency_code: "USD",
        project: "P",
        status: "needs_review",
        line_items: "[]",
        raw_llm_response: "{}",
      },
      {
        id: "pend-huf",
        vendor: "B",
        date: dateIntFor(0, 4),
        total_minor: 100,
        currency_code: "HUF",
        project: "P",
        status: "needs_review",
        line_items: "[]",
        raw_llm_response: "{}",
      },
    ]);

    const netDelta = await dashboard.getNetMonthlyDelta(now);
    const position = await dashboard.getCurrentPositionMinor();
    const movingAverage = await dashboard.getMovingAverageMinor(now);
    const pending = await dashboard.getPendingInvoiceStats();

    expect(netDelta).toBe(-25000);
    expect(position).toBe(275000);
    expect(Math.round(movingAverage)).toBeGreaterThanOrEqual(66666);
    expect(Math.round(movingAverage)).toBeLessThanOrEqual(66667);
    const projections = dashboard.computeProjections(position, movingAverage);
    expect(projections.d30).toBe(Math.round(position + movingAverage * (30 / 30)));
    expect(projections.d60).toBe(Math.round(position + movingAverage * (60 / 30)));
    expect(projections.d90).toBe(Math.round(position + movingAverage * (90 / 30)));
    expect(pending.total).toBe(2);
  });
});

describe("A10 secret encryption actually wired (real DB + mocked fetch)", () => {
  it("saved API key is stored non-plaintext and decrypts into the dispatch Authorization header", async () => {
    const { POST } = await import("@/app/api/settings/route");
    const res = await POST(
      new Request("http://shadow.test/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          PRIMARY_BASE_URL: "https://llm.shadow.test/v1",
          PRIMARY_MODEL: "shadow-model",
          PRIMARY_API_KEY: "sk-shadow-test-123",
        }),
      }),
    );
    expect(res.status).toBe(200);

    const stored = await dbMod.client.execute(
      "SELECT value FROM settings WHERE key = 'PRIMARY_API_KEY'",
    );
    const storedValue = String((stored.rows[0] as Record<string, unknown>).value);
    expect(storedValue).not.toContain("sk-shadow-test-123");
    expect(storedValue.startsWith("enc:v1:")).toBe(true);
    expect(encryption.decryptSecret(storedValue)).toBe("sk-shadow-test-123");

    let authHeader: string | undefined;
    (globalThis as { fetch: unknown }).fetch = vi.fn(
      async (_url: unknown, init: { headers: Record<string, string> }) => {
        authHeader = init.headers.Authorization;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );

    const llm = await import("@/lib/llm");
    await llm.dispatchChat([{ role: "user", content: "ping" }]);
    expect(authHeader).toBe("Bearer sk-shadow-test-123");
  });
});
