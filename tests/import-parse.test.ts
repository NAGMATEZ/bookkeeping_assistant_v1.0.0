// spec: CSV import auto-detects delimiter and handles UTF-8/ISO-8859-2; XLSX import reads the first sheet.
// expected (hand-derived): semicolon CSV bytes in ISO-8859-2 → headers ["dátum","leírás","összeg"] and row
//   ["2026-01-15","Kávé","500"]; comma UTF-8 CSV → same shape; a 10-data-row .xlsx → 10 rows, Date cell "2026-01-15".
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseCsv, parseImportFile, parseXlsx } from "@/lib/import-parse";

const LATIN2_CSV = new Uint8Array([
  0x64, 0xe1, 0x74, 0x75, 0x6d, 0x3b, 0x6c, 0x65, 0xed, 0x72, 0xe1, 0x73, 0x3b, 0xf6, 0x73, 0x73, 0x7a, 0x65,
  0x67, 0x0a, 0x32, 0x30, 0x32, 0x36, 0x2d, 0x30, 0x31, 0x2d, 0x31, 0x35, 0x3b, 0x4b, 0xe1, 0x76, 0xe9, 0x3b,
  0x35, 0x30, 0x30, 0x0a,
]);

describe("parseCsv", () => {
  it("parses a semicolon-delimited ISO-8859-2 file", () => {
    const parsed = parseCsv(LATIN2_CSV);

    expect(parsed.headers).toEqual(["dátum", "leírás", "összeg"]);
    expect(parsed.rows).toEqual([["2026-01-15", "Kávé", "500"]]);
  });

  it("auto-detects a comma-delimited UTF-8 file", () => {
    const bytes = new TextEncoder().encode("date,description,amount\n2026-01-15,Coffee,5.00\n");

    const parsed = parseCsv(bytes);

    expect(parsed.headers).toEqual(["date", "description", "amount"]);
    expect(parsed.rows).toEqual([["2026-01-15", "Coffee", "5.00"]]);
  });
});

describe("parseXlsx", () => {
  it("parses a 10-row sheet with native date cells", () => {
    const data: unknown[][] = [["date", "description", "amount"]];
    for (let i = 1; i <= 10; i += 1) {
      data.push([new Date(Date.UTC(2026, 0, i)), `Row ${i}`, i * 10]);
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), "Sheet1");
    const bytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);

    const parsed = parseXlsx(bytes);

    expect(parsed.rows).toHaveLength(10);
    expect(parsed.rows[0]).toEqual(["2026-01-01", "Row 1", "10"]);
  });
});

describe("parseImportFile", () => {
  it("dispatches by extension and rejects unknown types", () => {
    expect(parseImportFile("data.csv", LATIN2_CSV).rows).toHaveLength(1);
    expect(() => parseImportFile("data.txt", LATIN2_CSV)).toThrow(
      'Unsupported import file "data.txt". Upload a .csv, .xlsx, or .xls file.',
    );
  });
});