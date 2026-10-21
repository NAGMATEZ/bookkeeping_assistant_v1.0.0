/**
 * SHADOW FIXTURES — M21 adapter of GLM 5.3 Section B (byte-identical fixtures).
 * Ground truth: sample_import.xlsx 26 rows net 3 067 251 minor (10 income / 16 expense);
 * ocr3.pdf (Billingo 285 750 HUF, 2026-09-01); ocr1.png (1 841 500 HUF).
 * The LLM is mocked at the network boundary; uploaded document bytes must travel as-is.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

process.env.TURSO_DATABASE_URL = "file::memory:?cache=shared";
process.env.TURSO_AUTH_TOKEN = "shadow-token";
process.env.APP_ENCRYPTION_KEY = "5a44491e8e2e928b7bd6a78d86e7223d55ae5f1d21cdf85eeefbd7d942745442";
process.env.PRIMARY_BASE_URL = "https://llm.shadow.test/v1";
process.env.PRIMARY_MODEL = "shadow-model";
process.env.PRIMARY_API_KEY = "sk-shadow-env-key";
process.env.NODE_ENV = "test";

const FIXTURES = resolve(process.cwd(), "__eval__/fixtures");

let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/db/schema");
let importParse: typeof import("@/lib/import-parse");
let importMap: typeof import("@/lib/import-map");
let importPersist: typeof import("@/lib/import-persist");

async function countInvoices(): Promise<number> {
  const rows = await dbMod.client.execute("SELECT COUNT(*) AS c FROM invoices");
  return Number((rows.rows[0] as Record<string, unknown>).c);
}

async function countTransactions(): Promise<number> {
  const rows = await dbMod.client.execute("SELECT COUNT(*) AS c FROM transactions");
  return Number((rows.rows[0] as Record<string, unknown>).c);
}

async function seedSetting(key: string, value: string): Promise<void> {
  await dbMod.db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

function mockLlm(invoiceJson: Record<string, unknown>): { body: string } {
  const captured = { body: "" };
  (globalThis as { fetch: unknown }).fetch = vi.fn(
    async (_url: unknown, init: { body?: unknown }) => {
      captured.body = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(invoiceJson) } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  return captured;
}

function uploadRequest(bytes: Buffer, name: string, type: string): Request {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], name, { type }));
  return new Request("http://shadow.test/api/invoices", { method: "POST", body: form });
}

function uploadedBase64(capturedBody: string): Buffer {
  const parsed = JSON.parse(capturedBody) as {
    messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
  };
  const part = parsed.messages[1].content.find((c) => c.type === "image_url");
  expect(part?.image_url?.url).toBeTruthy();
  const url = part!.image_url!.url;
  return Buffer.from(url.split(",")[1], "base64");
}

beforeAll(async () => {
  dbMod = await import("@/lib/db");
  schema = await import("@/db/schema");
  importParse = await import("@/lib/import-parse");
  importMap = await import("@/lib/import-map");
  importPersist = await import("@/lib/import-persist");
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

describe("B1 XLSX import (26 rows, net 3 067 251 minor)", () => {
  it("parses all 26 rows, persists exact net, signs and currency", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const bytes = await readFile(resolve(FIXTURES, "sample_import.xlsx"));
    const { headers, rows } = importParse.parseImportFile(
      "sample_import.xlsx",
      new Uint8Array(bytes),
    );
    expect(headers).toEqual(["Date", "Amount", "Description", "Category"]);
    expect(rows.length).toBe(26);

    const mapping = { date: 0, amount: 1, description: 2, category: 3 };
    const { records, skipped } = importMap.mapImportRows(rows, mapping);
    expect(skipped).toHaveLength(0);
    expect(records.length).toBe(26);

    const result = await importPersist.persistImport(records);
    expect(result.ok).toBe(true);

    const stats = await dbMod.client.execute(
      "SELECT COUNT(*) AS c, SUM(amount_minor) AS net, SUM(CASE WHEN amount_minor > 0 THEN 1 ELSE 0 END) AS inc, SUM(CASE WHEN amount_minor < 0 THEN 1 ELSE 0 END) AS exp FROM transactions",
    );
    const row = stats.rows[0] as Record<string, unknown>;
    expect(Number(row.c)).toBe(26);
    expect(Number(row.net)).toBe(3067251);
    expect(Number(row.inc)).toBe(10);
    expect(Number(row.exp)).toBe(16);
    const currencies = await dbMod.client.execute(
      "SELECT DISTINCT currency_code FROM transactions",
    );
    expect(currencies.rows.map((r) => (r as Record<string, unknown>).currency_code)).toEqual([
      "USD",
    ]);

    const reimport = await importPersist.persistImport(records);
    expect(reimport.ok).toBe(true);
    expect(await countTransactions()).toBe(52); // file re-import duplicates (recorded, not spec-mandated)
  });
});

describe("B2 OCR fixtures via the real upload route (mocked LLM)", () => {
  it("ocr3.pdf: bytes as-is, invoice stored needs_review HUF 285750, idempotent, guard blocks confirm", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const bytes = await readFile(resolve(FIXTURES, "ocr3.pdf"));
    const captured = mockLlm({
      vendor: "Billingo Demo Cég",
      date: "2026-09-01",
      total_minor: 285750,
      currency_code: "HUF",
      line_items: [
        { description: "Net", amount_minor: 225000 },
        { description: "VAT 27%", amount_minor: 60750 },
      ],
      suggested_category: "Software",
      project: "",
    });

    const { POST } = await import("@/app/api/invoices/route");
    const res = await POST(uploadRequest(bytes, "ocr3.pdf", "application/pdf"));
    const body = (await res.json()) as { ok: boolean; invoiceId: string; duplicate: boolean };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(false);

    expect(Buffer.compare(uploadedBase64(captured.body), bytes)).toBe(0);

    const stored = await dbMod.client.execute(
      `SELECT * FROM invoices WHERE id = '${body.invoiceId}'`,
    );
    const row = stored.rows[0] as Record<string, unknown>;
    expect(row.status).toBe("needs_review");
    expect(row.currency_code).toBe("HUF");
    expect(Number(row.total_minor)).toBe(28575000); // HUF is zero-decimal: LLM major amount scaled x100

    const res2 = await POST(uploadRequest(bytes, "ocr3.pdf", "application/pdf"));
    const body2 = (await res2.json()) as { duplicate: boolean; invoiceId: string };
    expect(body2.duplicate).toBe(true);
    expect(body2.invoiceId).toBe(body.invoiceId);
    expect(await countInvoices()).toBe(1);

    const confirm = await import("@/app/api/invoices/[id]/confirm/route");
    const confirmRes = await confirm.POST(
      new Request(`http://shadow.test/api/invoices/${body.invoiceId}/confirm`, { method: "POST" }),
      { params: Promise.resolve({ id: body.invoiceId }) },
    );
    expect(confirmRes.status).toBe(400);
    const confirmBody = (await confirmRes.json()) as { message: string };
    expect(confirmBody.message).toContain("Multi-currency support is coming in a future release.");
    expect(confirmBody.message).toContain("This invoice is in HUF but the active currency is USD.");
    expect(confirmBody.message).toContain("Non-USD invoices cannot be confirmed yet.");
    expect(await countTransactions()).toBe(0);
  });

  it("ocr1.png: bytes as-is, invoice stored needs_review HUF 1841500", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const bytes = await readFile(resolve(FIXTURES, "ocr1.png"));
    const captured = mockLlm({
      vendor: "Fixture Vendor Kft",
      date: "2026-09-10",
      total_minor: 1841500,
      currency_code: "HUF",
      line_items: [
        { description: "Net", amount_minor: 1450000 },
        { description: "VAT 27%", amount_minor: 391500 },
      ],
      suggested_category: "",
      project: "",
    });
    const { POST } = await import("@/app/api/invoices/route");
    const res = await POST(uploadRequest(bytes, "ocr1.png", "image/png"));
    const body = (await res.json()) as { ok: boolean; invoiceId: string };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Buffer.compare(uploadedBase64(captured.body), bytes)).toBe(0);
    const stored = await dbMod.client.execute(
      `SELECT total_minor, currency_code, status FROM invoices WHERE id = '${body.invoiceId}'`,
    );
    const row = stored.rows[0] as Record<string, unknown>;
    expect(Number(row.total_minor)).toBe(184150000);
    expect(row.currency_code).toBe("HUF");
    expect(row.status).toBe("needs_review");
  });

  it("oversized PDF >15MB rejected before dispatch, no invoice row", async () => {
    await seedSetting("DEFAULT_CURRENCY", "USD");
    const before = await countInvoices();
    const big = Buffer.alloc(15 * 1024 * 1024 + 1024, 0x41);
    const { POST } = await import("@/app/api/invoices/route");
    const res = await POST(uploadRequest(big, "big.pdf", "application/pdf"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message.toLowerCase()).toContain("too large");
    expect(await countInvoices()).toBe(before);
  });
});
