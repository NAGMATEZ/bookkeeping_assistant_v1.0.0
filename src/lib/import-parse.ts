import Papa from "papaparse";
import * as XLSX from "xlsx";

export type TabularData = {
  headers: string[];
  rows: string[][];
};

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }
  return new TextDecoder("iso-8859-2").decode(bytes);
}

function cellToString(cell: unknown): string {
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10);
  }
  return String(cell ?? "");
}

export function parseCsv(bytes: Uint8Array): TabularData {
  const text = decodeText(bytes);
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  if (result.errors.length > 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  const [headers = [], ...rows] = result.data;
  return {
    headers: headers.map((header) => cellToString(header).trim()),
    rows: rows.map((row) => row.map((cell) => cellToString(cell))),
  };
}

export function parseXlsx(bytes: Uint8Array): TabularData {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Spreadsheet has no sheets");
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const [headers = [], ...rows] = matrix;
  return {
    headers: headers.map((header) => cellToString(header).trim()),
    rows: rows.map((row) => row.map((cell) => cellToString(cell))),
  };
}

export function parseImportFile(fileName: string, bytes: Uint8Array): TabularData {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return parseCsv(bytes);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return parseXlsx(bytes);
  }
  throw new Error(`Unsupported import file "${fileName}". Upload a .csv, .xlsx, or .xls file.`);
}