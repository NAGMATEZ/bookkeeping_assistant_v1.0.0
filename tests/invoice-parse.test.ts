// spec: LLM output contract is Zod-enforced and parsed defensively (markdown fences/prose stripped); Data Sanity
//       rejects dates outside 1900–2100 / invalid month-day and amounts over 100,000,000,000 minor units; a total
//       that differs from the line-item sum is flagged (not corrected); unrecognized currency falls back to default,
//       a recognized non-default code is stored as extracted. Invoices persist net/VAT/gross (not just a total);
//       zero-decimal currencies (HUF/JPY) arrive from the model in printed major units and are scaled to hundredths.
// expected (hand-derived): USD total=5000 & items 3000+2000 → totalMatchesLineItems true, net=5000, vat=0, gross=5000;
//   total=1000 & item 990 → false; "2024-02-30" and "1899-12-31" → invalid-date throw;
//   total_minor=100_000_000_001 → cap throw; "XYZ" → "USD"; "eur" → "EUR"; fenced JSON parses to dateInt 20260115;
//   HUF total 285750 with items 225000+60750 → 28,575,000 minor with items 22,500,000+6,075,000 (×100 once);
//   net_minor 100000 + vat_minor 27000 + gross 127000 → 100000/27000/127000; net 1000 + vat 270 + gross 1270
//   (major fields) → 100000/27000/127000; 1000+100 vs gross 1500 → totalsConsistent false.
import { describe, expect, it } from "vitest";

import { lineItemsMatchTotal, parseInvoiceLlmOutput } from "@/lib/invoice-parse";

function invoiceJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    vendor: "Acme Kft",
    date: "2026-01-15",
    total_minor: 5000,
    currency_code: "USD",
    line_items: [
      { description: "Widget", amount_minor: 3000 },
      { description: "Gadget", amount_minor: 2000 },
    ],
    suggested_category: "Office supplies",
    project: "P1",
    ...overrides,
  });
}

describe("parseInvoiceLlmOutput", () => {
  it("parses a clean JSON response", () => {
    const parsed = parseInvoiceLlmOutput(invoiceJson(), "USD");

    expect(parsed).toEqual({
      vendor: "Acme Kft",
      dateInt: 20260115,
      totalMinor: 5000,
      netMinor: 5000,
      vatMinor: 0,
      grossMinor: 5000,
      currencyCode: "USD",
      lineItems: [
        { description: "Widget", amountMinor: 3000 },
        { description: "Gadget", amountMinor: 2000 },
      ],
      suggestedCategory: "Office supplies",
      project: "P1",
      totalMatchesLineItems: true,
      totalsConsistent: true,
    });
  });

  it("strips markdown fences and surrounding prose", () => {
    const fenced = `Here is the extraction:\n\`\`\`json\n${invoiceJson()}\n\`\`\`\nDone.`;

    const parsed = parseInvoiceLlmOutput(fenced, "USD");

    expect(parsed.dateInt).toBe(20260115);
    expect(parsed.totalMinor).toBe(5000);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseInvoiceLlmOutput('{"vendor": }', "USD")).toThrow(
      "LLM response was not valid JSON",
    );
    expect(() => parseInvoiceLlmOutput("no braces here", "USD")).toThrow(
      "LLM response did not contain a JSON object",
    );
  });

  it("rejects an invalid calendar date", () => {
    expect(() => parseInvoiceLlmOutput(invoiceJson({ date: "2024-02-30" }), "USD")).toThrow(
      'Invoice date is invalid or out of range (1900–2100): "2024-02-30"',
    );
  });

  it("rejects an out-of-range year", () => {
    expect(() => parseInvoiceLlmOutput(invoiceJson({ date: "1899-12-31" }), "USD")).toThrow(
      'Invoice date is invalid or out of range (1900–2100): "1899-12-31"',
    );
  });

  it("rejects amounts over the minor-unit cap", () => {
    expect(() =>
      parseInvoiceLlmOutput(
        invoiceJson({ total_minor: 100_000_000_001, line_items: [] }),
        "USD",
      ),
    ).toThrow("Invoice total exceeds the 100000000000 minor-unit cap (got 100000000001)");

    expect(() =>
      parseInvoiceLlmOutput(
        invoiceJson({ line_items: [{ description: "Huge", amount_minor: -100_000_000_001 }] }),
        "USD",
      ),
    ).toThrow('Line item "Huge" exceeds the 100000000000 minor-unit cap (got -100000000001)');
  });

  it("scales zero-decimal currencies (HUF/JPY) from printed major units exactly once", () => {
    const parsed = parseInvoiceLlmOutput(
      invoiceJson({
        currency_code: "HUF",
        total_minor: 285750,
        line_items: [
          { description: "Net", amount_minor: 225000 },
          { description: "VAT 27%", amount_minor: 60750 },
        ],
      }),
      "USD",
    );

    expect(parsed.totalMinor).toBe(28_575_000);
    expect(parsed.lineItems.map((item) => item.amountMinor)).toEqual([22_500_000, 6_075_000]);
    expect(parsed.totalMatchesLineItems).toBe(true);
  });

  it("uses net/VAT/gross when the model supplies them", () => {
    const parsed = parseInvoiceLlmOutput(
      invoiceJson({ net_minor: 100000, vat_minor: 27000, gross_minor: 127000, total_minor: 127000 }),
      "USD",
    );

    expect([parsed.netMinor, parsed.vatMinor, parsed.grossMinor]).toEqual([100000, 27000, 127000]);
    expect(parsed.totalsConsistent).toBe(true);
  });

  it("accepts major-unit net/VAT/gross fields and converts them", () => {
    const parsed = parseInvoiceLlmOutput(
      invoiceJson({ net: 1000, vat: 270, gross: 1270, total_minor: 127000 }),
      "USD",
    );

    expect([parsed.netMinor, parsed.vatMinor, parsed.grossMinor]).toEqual([100000, 27000, 127000]);
  });

  it("flags an inconsistent net+VAT/gross triple instead of silently correcting it", () => {
    const parsed = parseInvoiceLlmOutput(
      invoiceJson({ net_minor: 1000, vat_minor: 100, gross_minor: 1500, total_minor: 1500 }),
      "USD",
    );

    expect(parsed.totalsConsistent).toBe(false);
    expect([parsed.netMinor, parsed.vatMinor, parsed.grossMinor]).toEqual([1000, 100, 1500]);
  });

  it("flags a total that does not match the line-item sum", () => {
    const parsed = parseInvoiceLlmOutput(
      invoiceJson({ total_minor: 1000, line_items: [{ description: "Only", amount_minor: 990 }] }),
      "USD",
    );

    expect(parsed.totalMatchesLineItems).toBe(false);
    expect(parsed.totalMinor).toBe(1000);
  });

  it("falls back to the default currency for unrecognized codes and normalizes recognized ones", () => {
    expect(parseInvoiceLlmOutput(invoiceJson({ currency_code: "XYZ" }), "USD").currencyCode).toBe("USD");
    expect(parseInvoiceLlmOutput(invoiceJson({ currency_code: "eur" }), "USD").currencyCode).toBe("EUR");
    expect(parseInvoiceLlmOutput(invoiceJson({ currency_code: "EUR" }), "USD").currencyCode).toBe("EUR");
  });

  it("rejects output missing required contract fields", () => {
    expect(() => parseInvoiceLlmOutput('{"date": "2026-01-15"}', "USD")).toThrow(
      "Invoice data from the LLM failed validation",
    );
  });
});

describe("lineItemsMatchTotal", () => {
  it("returns true when the stored line-item sum equals the stored total", () => {
    const items = JSON.stringify([
      { description: "Widget", amount_minor: 3000 },
      { description: "Gadget", amount_minor: 2000 },
    ]);

    expect(lineItemsMatchTotal(items, 5000)).toBe(true);
    expect(lineItemsMatchTotal(items, 1000)).toBe(false);
    expect(lineItemsMatchTotal("not json", 5000)).toBe(false);
  });
});
