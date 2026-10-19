import { isAllowedCalendarDate, toDateInt } from "@/lib/dates";
import { MAX_AMOUNT_MINOR } from "@/lib/invoice-parse";
import { parseDecimalToMinorUnits } from "@/lib/money";

export type ColumnMapping = {
  date: number;
  amount: number;
  description?: number;
  category?: number;
  project?: number;
  direction?: number;
};

export type MappedImportRecord = {
  rowIndex: number;
  date: string;
  dateInt: number;
  description: string;
  amountMinor: number;
  category: string;
  project: string;
};

export type SkippedRow = { rowIndex: number; reason: string };
export type MapRowsResult = { records: MappedImportRecord[]; skipped: SkippedRow[] };

const INCOME_TOKENS = new Set([
  "income",
  "credit",
  "in",
  "be",
  "bevetel",
  "bev",
  "jovairas",
  "kovetel",
  "igen",
  "+",
  "1",
]);

const EXPENSE_TOKENS = new Set([
  "expense",
  "debit",
  "out",
  "kiadas",
  "terheles",
  "kifizetes",
  "koltseg",
  "tartozik",
  "nem",
  "-",
  "0",
]);

// Strip Hungarian accents so "bevétel", "BEVÉTEL", and "bevetel" all resolve identically.
function normalizeDirectionToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function tokenIsIncome(value: string): boolean | null {
  const token = normalizeDirectionToken(value);
  if (INCOME_TOKENS.has(token)) {
    return true;
  }
  if (EXPENSE_TOKENS.has(token)) {
    return false;
  }
  return null;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined || index < 0) {
    return "";
  }
  return (row[index] ?? "").trim();
}

export function resolveRowIsIncome(
  amountMinor: number,
  directionValue: string,
  override?: boolean,
): boolean {
  if (override !== undefined) {
    return override;
  }
  if (directionValue !== "") {
    const fromColumn = tokenIsIncome(directionValue);
    if (fromColumn !== null) {
      return fromColumn;
    }
  }
  // A plain amount with no explicit signal is income (replaces the old expense default).
  return amountMinor >= 0;
}

export function mapImportRows(
  rows: string[][],
  mapping: ColumnMapping,
  overrides: Record<number, boolean> = {},
): MapRowsResult {
  const records: MappedImportRecord[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, rowIndex) => {
    const rawDate = cell(row, mapping.date);
    if (!isAllowedCalendarDate(rawDate)) {
      skipped.push({ rowIndex, reason: `Invalid or missing date "${rawDate}"` });
      return;
    }

    let parsedAmount: number;
    try {
      parsedAmount = parseDecimalToMinorUnits(cell(row, mapping.amount));
    } catch (error) {
      skipped.push({
        rowIndex,
        reason: error instanceof Error ? error.message : "Invalid amount",
      });
      return;
    }

    if (parsedAmount === 0) {
      skipped.push({ rowIndex, reason: "Amount must not be zero" });
      return;
    }
    if (Math.abs(parsedAmount) > MAX_AMOUNT_MINOR) {
      skipped.push({ rowIndex, reason: `Amount exceeds the ${MAX_AMOUNT_MINOR} minor-unit cap` });
      return;
    }

    const isIncome = resolveRowIsIncome(
      parsedAmount,
      cell(row, mapping.direction),
      overrides[rowIndex],
    );

    records.push({
      rowIndex,
      date: rawDate,
      dateInt: toDateInt(rawDate),
      description: cell(row, mapping.description),
      amountMinor: isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount),
      category: cell(row, mapping.category),
      project: cell(row, mapping.project),
    });
  });

  return { records, skipped };
}