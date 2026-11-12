import Papa from "papaparse";
import * as XLSX from "xlsx";

export type TabularData = {
  headers: string[];
  rows: string[][];
};

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type ImportFileCheck = { ok: true } | { ok: false; message: string };

export function checkImportFile(file: { name: string; size: number }): ImportFileCheck {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return {
      ok: false,
      message: `Unsupported import file "${file.name}". Upload a .csv, .xlsx, or .xls file.`,
    };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      message: `File is too large (${megabytes} MB). The import limit is 10 MB.`,
    };
  }
  return { ok: true };
}

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }
  return new TextDecoder("iso-8859-2").decode(bytes);
}

function cellToString(cell: unknown): string {
  if (cell instanceof Date) {
    // XLSX builds date cells from the sheet's calendar components in local time, so read them back the same
    // way; toISOString() would shift the calendar day for users east/west of UTC.
    const year = String(cell.getFullYear()).padStart(4, "0");
    const month = String(cell.getMonth() + 1).padStart(2, "0");
    const day = String(cell.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(cell ?? "");
}

export function parseCsv(bytes: Uint8Array): TabularData {
  const text = decodeText(bytes);
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  // A single-column file is valid but has no detectable delimiter; that diagnosis is informational.
  const fatal = result.errors.find((error) => error.code !== "UndetectableDelimiter");
  if (fatal) {
    throw new Error(`CSV parse error: ${fatal.message}`);
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