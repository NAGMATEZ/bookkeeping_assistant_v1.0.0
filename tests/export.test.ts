// spec: CSV export is UTF-8 semicolon-delimited `date;description;amount;currency;category;project`;
//   XLSX export uses native date/numeric cells with a currency column.
// expected (hand-derived): transaction date 20260115 / -1234 / HUF / description `Kávé; special` →
//   `2026-01-15;"Kávé; special";-12.34;HUF;Office;P1`; XLSX read-back has A2 type "d" and C2 type "n" with -12.34.
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { transactionsToCsv, transactionsToXlsx } from "@/lib/export";
import type { TransactionRow } from "@/lib/transactions";

function row(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: "tx-1",
    date: 20260115,
    amount_minor: -1234,
    currency_code: "HUF",
    category: "Office",
    project: "P1",
    description: "Kávé; special",
    source_invoice_id: null,
    created_at: 1768000000,
    ...overrides,
  };
}

describe("transactionsToCsv", () => {
  it("exports the exact semicolon-delimited row format", () => {
    const csv = transactionsToCsv([row({ description: "Coffee" })]);

    expect(csv).toBe(
      "date;description;amount;currency;category;project\n2026-01-15;Coffee;-12.34;HUF;Office;P1\n",
    );
  });

  it("quotes fields containing semicolons", () => {
    const csv = transactionsToCsv([row()]);

    expect(csv.split("\n")[1]).toBe('2026-01-15;"Kávé; special";-12.34;HUF;Office;P1');
  });
});

describe("transactionsToXlsx", () => {
  it("produces native date and numeric cells", () => {
    const bytes = transactionsToXlsx([row()]);

    const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    expect(sheet["A2"].t).toBe("d");
    expect(sheet["C2"].t).toBe("n");
    expect(sheet["C2"].v).toBe(-12.34);
    expect(sheet["D2"].v).toBe("HUF");
  });
});